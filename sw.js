// HQ service worker: keeps HQ working offline and shows new versions promptly.
//
// The app page: try the network first, skipping the browser's 10-minute cache
// so a new version shows straight away. If the network hasn't answered within
// 3 seconds (bad signal) or fails (no signal), use the saved copy instead.
// Every successful online load refreshes the saved copy.
// Fonts, icons and the home-screen manifest: saved copy first, refreshed quietly.
// Your data (sessions, drinks, weights, to-dos) is not here: it lives in the
// phone's local storage and is always the current data whichever copy loads.

const SHELL = "hq-shell-v2";
const ASSETS = "hq-assets-v2";
const PAGE_KEY = "./index.html";
const PRECACHE = ["./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const NET_TIMEOUT_MS = 3000;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL).then(cache =>
      Promise.all(PRECACHE.map(u => fetch(u, { cache: "no-store" }).then(r => r.ok && cache.put(u, r)).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  // Only tidy up HQ's own old caches: other apps on this site keep theirs.
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith("hq-") && k !== SHELL && k !== ASSETS).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isPage(req, url) {
  return req.mode === "navigate" || (url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname));
}

async function pageFromNetworkOrCache(req) {
  const cache = await caches.open(SHELL);
  const network = fetch(req.url, { cache: "no-store", credentials: "same-origin" })
    .then(res => { if (res && res.ok) cache.put(PAGE_KEY, res.clone()); return res; })
    .catch(() => null);
  const timeout = new Promise(resolve => setTimeout(() => resolve("timeout"), NET_TIMEOUT_MS));
  const first = await Promise.race([network, timeout]);
  if (first && first !== "timeout") return first;
  const saved = await cache.match(PAGE_KEY);
  if (saved) return saved;
  const late = await network;           // nothing saved yet: wait for the network after all
  return late || new Response("HQ is offline and hasn't been saved on this phone yet.", { status: 503, headers: { "Content-Type": "text/plain" } });
}

async function assetSavedFirst(req) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(req);
  const refresh = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => null);
  return saved || (await refresh) || (await caches.match(req)) || Response.error();
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isPage(req, url)) { event.respondWith(pageFromNetworkOrCache(req)); return; }
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  const isOwnAsset = url.origin === self.location.origin && /\.(png|json|svg|ico)$/.test(url.pathname) && !/(sw\.js|version\.json)$/.test(url.pathname);
  if (isFont || isOwnAsset) event.respondWith(assetSavedFirst(req));
});
