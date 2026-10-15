// HQ service worker — provides offline support.
//
// Strategy: network-first with cache fallback. When you're online, we go to
// the network so you always see the newest version, then quietly update the
// cache. When you're offline, we serve the most recent successful copy from
// the cache instead. Your session data lives in localStorage (separate from
// this cache) so it's offline-capable regardless.

const CACHE_NAME = "hq-shell-v1";
// Files we want available offline. We use relative paths so the same SW
// works whether the site is deployed at the root or in a subdirectory.
const APP_SHELL = ["./", "./index.html"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  // Only handle same-origin requests; let cross-origin (fonts, etc.) pass through.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(resp => {
        // Cache successful navigations + static assets so they're available next time.
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return resp;
      })
      .catch(() => caches.match(event.request).then(match => match || caches.match("./index.html")))
  );
});
