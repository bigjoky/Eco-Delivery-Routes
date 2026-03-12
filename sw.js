const CACHE_NAME = 'eco-routes-v2';
const OFFLINE_URL = '/offline.html';
const STATIC_PATHS = [
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.svg',
  '/favicon-32.png',
  '/favicon-192.png',
  '/favicon-512.png',
  '/logo.svg',
];

function isStaticAsset(url) {
  return url.origin === self.location.origin
    && (
      url.pathname.startsWith('/build/assets/')
      || STATIC_PATHS.includes(url.pathname)
    );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_PATHS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      })
    );
    return;
  }

  if (!isStaticAsset(url)) {
    return;
  }

  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (!response || response.status !== 200 || response.type === 'opaque') {
        return response;
      }
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
      return response;
    } catch {
      return cached || Response.error();
    }
  }));
});
