// Keeps the game and the word list on the phone. Bump VERSION on every deploy so phones pick up the new files.
var VERSION = "wb-2026-10-30-8";
var FILES = ["./", "index.html", "game.css", "layout.css", "splash.css", "native.js", "i18n.js", "i18n/en.json", "i18n/nl.json", "i18n/fi.json", "i18n/sv.json", "i18n/fr.json", "i18n/it.json", "i18n/es.json", "runtime.js", "daily-boards.js", "logic.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "words/nsf-2026.txt"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Cache first for our own files; the fonts from Google are cached as they come.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).pathname.indexOf("/api/") === 0) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      if (res && (res.ok || res.type === "opaque") && /^https?:/.test(e.request.url)) {
        var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    });
  }));
});

// Push: the server says whose turn it is; a tap opens the game.
self.addEventListener("push", function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "WordBelow", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "WordBelow", {
    body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: d.game || "wordbelow", renotify: true, data: { game: d.game || null }
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var g = e.notification.data && e.notification.data.game, url = self.registration.scope + (g ? "?game=" + g : "");
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ("focus" in list[i]) { list[i].postMessage({ openGame: g }); return list[i].focus(); } }
    return self.clients.openWindow(url);
  }));
});
