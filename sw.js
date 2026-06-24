/**
 * Chaser service worker (web/PWA only).
 *
 * Strategy:
 * - Navigations (HTML): network-first, fall back to the cached app shell when
 *   offline. This avoids ever getting stuck on a stale shell after a deploy.
 * - Static same-origin assets (hashed JS/CSS/images/fonts): stale-while-
 *   revalidate, so the app loads instantly and works offline while still
 *   refreshing in the background.
 * - sw.js and the manifest are never cached here (served no-cache by the
 *   server), and only same-origin GET requests are handled.
 *
 * Bump CACHE_VERSION to invalidate all previously cached assets.
 */
const CACHE_VERSION = "v1";
const CACHE = `chaser-cache-${CACHE_VERSION}`;
const APP_SHELL = "/";
const PRECACHE = [
  APP_SHELL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the service worker or the manifest.
  if (url.pathname === "/sw.js" || url.pathname === "/manifest.webmanifest") {
    return;
  }

  // Network-first for page navigations, fall back to the cached app shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(APP_SHELL, copy));
          return res;
        })
        .catch(() =>
          caches.match(APP_SHELL).then((cached) => cached || caches.match(req)),
        ),
    );
    return;
  }

  // Stale-while-revalidate for same-origin static assets.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
