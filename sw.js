
// This version number is incremented to trigger the 'install' event and update the cache.
const CACHE_NAME = 'lawyer-app-cache-v27-12-2025-3-final';

// The list of URLs to cache explicitly (App Shell)
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Use addAll for internal assets, but catch errors to prevent install failure
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
  
  // NEVER cache supabase requests - critical for sync to work in browser
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Strategy: Network First for modules and HTML, Cache First for assets
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
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
          const resClone = netRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return netRes;
        });
      })
    );
  }
});