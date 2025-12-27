
// This version number is incremented to trigger the 'install' event and update the cache.
const CACHE_NAME = 'lawyer-app-cache-v27-12-2025-2-rev-final';

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
  'https://esm.sh/pdfjs-dist@^4.4.178',
  'https://esm.sh/pdfjs-dist@4.4.178/build/pdf.worker.mjs',
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell.');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache assets during install:', error);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients.');
      return self.clients.claim().then(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'RELOAD_PAGE_NOW' }));
        });
      });
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
    return;
  }

  const url = new URL(event.request.url);

  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.json') || event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(e => {
             console.log('Network fetch failed for', event.request.url);
             if (!cachedResponse) throw e;
          });

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
