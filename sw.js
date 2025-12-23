
// This version number is incremented to trigger the 'install' event and update the cache.
const CACHE_NAME = 'lawyer-app-cache-v29-12-2025-v5';

const urlsToCache = [
  './',
  './index.html',
  './index.js', // Ensure bundled app logic is cached
  './manifest.json',
  './icon.svg',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap',
  // Dependencies
  'https://esm.sh/@supabase/supabase-js@^2.44.4',
  'https://esm.sh/react@^19.1.1',
  'https://esm.sh/react-dom@^19.1.1/client',
  'https://esm.sh/recharts@^2.12.7',
  'https://esm.sh/idb@^8.0.0',
  'https://esm.sh/docx-preview@^0.1.20',
];

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
        // Try caching all assets, but ignore individual failures to ensure the worker installs
        return Promise.allSettled(urlsToCache.map(url => cache.add(url)));
    })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Always allow Supabase and Data URLs to go direct to network/bypass cache
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co') || event.request.url.startsWith('data:')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then(networkResponse => {
        // Only cache valid GET responses with successful status
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(err => {
          // If offline and request is for navigation (HTML), fallback to root
          if (event.request.mode === 'navigate') {
              return caches.match('./');
          }
          console.error('Fetch failed for:', event.request.url, err);
          throw err;
      });
    })
  );
});
