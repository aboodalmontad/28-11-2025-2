
// This version number is incremented to trigger the 'install' event and update the cache.
const CACHE_NAME = 'lawyer-app-cache-v2026-04-12-10-57'; // Updated for version 12-4-2026-5 (Force Refresh)

// The list of URLs to cache explicitly (App Shell)
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // BYPASS CACHE for all API calls and external modules
  if (
    url.hostname.includes('supabase.co') || 
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('esm.sh')
  ) {
    return;
  }

  // Strategy: Network First for modules and HTML, Cache First for local static assets
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.includes('/index.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(netRes => {
          if (netRes && netRes.status === 200) {
            const resClone = netRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          }
          return netRes;
        }).catch(() => {
            // Return empty response or specific error if offline and not cached
            return new Response('Network error occurred', { status: 408 });
        });
      })
    );
  }
});
