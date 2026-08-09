/* Qālā — offline.

   Not a nicety. The whole project is meant to keep working with no internet,
   no subscription and nobody's server: cache the four pages and the icons on
   first visit and the instrument runs on a plane, in a basement, or in ten
   years when whatever hosted it is gone.

   Nothing else is cached, and nothing is ever sent anywhere. There is no
   analytics, no font CDN, no third party. The plate does all its work in the
   browser, which is what makes this possible at all.

   Strategy: network-first for pages, so an update is picked up the moment the
   network allows and the cache is only the fallback. Cache-first for icons,
   which never change under a given version. */

/* Bump this on every shell change. It is the only thing that purges the old
   cache — a service worker only reinstalls when its own bytes differ. */
const VERSION = "qala-v4";
const SHELL = [
  "./",
  "./index.html",
  "./plate.html",
  "./science.html",
  "./studio.html",
  "./manifest.webmanifest",
  "./icons/qala-192.png",
  "./icons/qala-512.png",
  "./icons/qala-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // one bad URL must not sink the whole install
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // never touch anything off-site

  const isPage = req.mode === "navigate" || /\.html?$/.test(url.pathname) || url.pathname.endsWith("/");

  if (isPage) {
    e.respondWith(
      // no-cache, or the browser's own HTTP cache can hand the worker a stale
      // page and network-first quietly serves yesterday's build
      fetch(req, { cache: "no-cache" })
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./plate.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
