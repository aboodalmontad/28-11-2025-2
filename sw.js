
// This version number is incremented to trigger the 'install' event and update the cache.
const CACHE_NAME = 'lawyer-app-cache-v22-02-2026-fix-v7';

// The list of URLs to cache explicitly (App Shell)
const urlsToCache = [
  '/',
  '/index.html',
  '/index.js',
  '/manifest.json',
  '/icon.svg',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap',
  // Dependencies
  'https://esm.sh/@google/genai@1.20.0',
  'https://esm.sh/@supabase/supabase-js@2.44.4',
  'https://esm.sh/react@19.0.0',
  'https://esm.sh/react@19.0.0/jsx-runtime',
  'https://esm.sh/react-dom@19.0.0',
  'https://esm.sh/react-dom@19.0.0/client',
  'https://esm.sh/recharts@2.12.7',
  'https://esm.sh/idb@8.0.0',
  'https://esm.sh/jszip@3.10.1',
  'https://unpkg.com/docx-preview@0.3.7/dist/docx-preview.mjs',
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('Service Worker: Caching app shell.');
        // Try to cache all, but don't fail installation if non-critical assets fail
        const cachePromises = urlsToCache.map(async url => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Status ${response.status}`);
                return cache.put(url, response);
            } catch (error) {
                console.warn(`Failed to cache ${url}:`, error);
                // We don't throw here so other assets can still be cached
            }
        });
        await Promise.all(cachePromises);
      })
      .catch(error => {
        console.warn('Service Worker: Failed to cache assets during install:', error);
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

  // Strategy 1: Stale-While-Revalidate for main scripts and local JS chunks.
  // We exclude sw.js itself from being intercepted by the service worker to avoid update loops or MIME type issues.
  if ((url.pathname.endsWith('.js') && !url.pathname.includes('sw.js')) || url.pathname.endsWith('.json') || event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            // Fallback for navigation if server returns error (e.g. 404 on SPA route)
            if (event.request.mode === 'navigate' && !networkResponse.ok) {
                return cache.match('/index.html').then(fallback => fallback || networkResponse);
            }

            // Update cache with new version
            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(e => {
             // Network failed
             console.warn('Network fetch failed for', event.request.url, '(offline)');
             
             // Fallback for navigation: return index.html if network fails and no cache match
             if (event.request.mode === 'navigate') {
                 return cache.match('/index.html');
             }

             // If we don't have a cached response and network fails, return a 404 instead of throwing
             // to keep the console clean of "Failed to fetch" errors.
             if (!cachedResponse) {
                 return new Response('Network error and no cache available', { status: 503, statusText: 'Service Unavailable' });
             }
             return cachedResponse;
          });

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy 2: Cache First for other assets (fonts, images, etc.)
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
      }).catch(error => {
          // Suppress "Failed to fetch" errors for non-essential assets to keep console clean
          console.warn('Fetch failed for asset, returning 404:', event.request.url);
          return new Response('Asset not found', { status: 404, statusText: 'Not Found' });
      });
    })
  );
});
