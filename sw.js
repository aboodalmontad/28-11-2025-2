// This version number is incremented to trigger the 'install' event and update the cache.
const CACHE_NAME = 'lawyer-app-cache-v15-12-2025-full-offline-v5';

// The list of URLs to cache explicitly (App Shell)
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap',
  // Google Fonts files
  'https://fonts.gstatic.com/s/tajawal/v10/Iura6YBj_oCad4k1nzSBC45I.woff2',
  'https://fonts.gstatic.com/s/tajawal/v10/Iura6YBj_oCad4k1nzGFC45I.woff2',
  'https://fonts.gstatic.com/s/tajawal/v10/Iura6YBj_oCad4k1nzGVC45I.woff2',
  'https://fonts.gstatic.com/s/tajawal/v10/Iura6YBj_oCad4k1nzGjC45I.woff2',
  // Dependencies
  'https://esm.sh/@google/genai@^1.20.0',
  'https://esm.sh/@supabase/supabase-js@^2.44.4',
  'https://esm.sh/react@^19.1.1',
  'https://esm.sh/react-dom@^19.1.1/client',
  'https://esm.sh/react@^19.1.1/jsx-runtime',
  'https://esm.sh/recharts@^2.12.7',
  'https://esm.sh/idb@^8.0.0',
  'https://esm.sh/docx-preview@^0.1.20',
];

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim().then(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'RELOAD_PAGE_NOW' }));
        });
      });
    })
  );
});

self.addEventListener('fetch', event => {
  // Exclude Supabase and non-GET requests
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
    return;
  }

  const url = new URL(event.request.url);

  // Strategy for scripts and nav: Stale-While-Revalidate
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.json') || event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
             // Silently fail fetch, return cache if available
             return cachedResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy for static assets: Cache First
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
          // Total failure (offline & no cache)
          return new Response('Network Error', { status: 408, statusText: 'Network Error' });
      });
    })
  );
});