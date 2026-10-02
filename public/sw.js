/* Sortie service worker.
 * Goal: after one online visit, the whole app opens and captures with no signal.
 *  - /_next/static/* and icons: cache-first (hashed filenames never go stale).
 *  - pages and route data: network-first with a short timeout, then the cached copy. A slow convention
 *    centre wifi counts as offline.
 *  - /api/*: never touched. The app's own queue handles offline.
 */
const PAGES = 'sortie-pages-v2';
const STATIC = 'sortie-static'; // not versioned: filenames are content hashes
const SHELL = ['/', '/leads', '/lead', '/events', '/settings'];
const EXTRA = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];
const NETWORK_TIMEOUT_MS = 2500;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES);
      const statics = await caches.open(STATIC);
      const assetUrls = new Set(EXTRA);
      for (const path of SHELL) {
        try {
          const res = await fetch(path, { cache: 'reload' });
          if (!res.ok) continue;
          const html = await res.clone().text();
          await pages.put(path, res);
          // Every JS/CSS chunk the page references, so other routes work offline on the first visit.
          for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\)]+/g)) assetUrls.add(m[0]);
        } catch {
          /* offline during install: the runtime cache will fill in later */
        }
      }
      await Promise.allSettled([...assetUrls].map((u) => statics.add(u)));
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC]);
      for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirst(request, isNavigation) {
  const cache = await caches.open(PAGES);
  try {
    const res = await Promise.race([fetch(request), timeout(NETWORK_TIMEOUT_MS)]);
    if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
    if (hit) return hit;
    if (isNavigation) {
      const shell = await cache.match('/');
      if (shell) return shell;
    }
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request, request.mode === 'navigate'));
});
