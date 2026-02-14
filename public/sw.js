const CACHE_NAME = 'sortie-v3';
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

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: stale-while-revalidate for pages, network-first for everything else
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests (POST to API routes, etc.)
  if (request.method !== 'GET') return;

  // Skip API routes and Supabase calls — always go to network
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) return;

  // Skip non-http schemes
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Only cache successful same-origin responses
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Network failed — serve cached version if available
          if (cached) return cached;

          // For navigation requests, serve cached root as SPA fallback
          if (request.mode === 'navigate') {
            return caches.match('/').then((root) => {
              if (root) return root;
              return new Response(
                '<html><body style="background:#1a1f16;color:#c8d5a3;display:flex;align-items:center;justify-content:center;height:100vh;font-family:monospace"><div style="text-align:center"><h1>Offline</h1><p>You are offline. Please reconnect to continue.</p></div></body></html>',
                { status: 503, headers: { 'Content-Type': 'text/html' } }
              );
            });
          }

          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });

      // Stale-while-revalidate: return cached immediately, update in background
      return cached || networkFetch;
    })
  );
});
