const CACHE_NAME = 'sortie-v2';
const STATIC_ASSETS = [
  '/',
  '/login',
  '/capture',
  '/captures',
  '/event-select',
  '/settings',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API routes and Supabase calls
  if (request.url.includes('/api/') || request.url.includes('supabase')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      // Stale-while-revalidate: serve cache immediately, update in background
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Network failed — return cached response if we have one
          if (cached) return cached;
          // For navigation requests, try to serve the root page as fallback
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });

      return cached || networkFetch;
    })
  );
});
