// The game used to be played on wordbelow.app and kept itself on the phone with a service worker.
// The game is in the app now. This worker replaces the old one: it empties the old cache, removes
// itself, and reloads open pages, so a browser that kept the game shows the front page instead.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.registration.unregister(); }).then(function () {
    return self.clients.matchAll({ type: "window" });
  }).then(function (list) {
    list.forEach(function (c) { c.navigate(c.url); });
  }));
});
