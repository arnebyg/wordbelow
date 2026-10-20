// Keeps the game and the word list on the phone. Bump VERSION on every deploy so phones pick up the new files.
var VERSION = "wb-2026-10-20-2";
var FILES = ["./", "index.html", "game.css", "layout.css", "runtime.js", "logic.js", "manifest.webmanifest",
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
