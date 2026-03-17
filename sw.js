
// This version number is incremented to trigger the 'install' event and update the cache.
const CACHE_NAME = 'lawyer-app-cache-v2026-02-26-16-37'; // Updated cache name with current timestamp

// The list of URLs to cache explicitly (App Shell)
const urlsToCache = [
  '/',
  '/index.html',
  '/index.js',
  '/manifest.json',
  '/icon.svg',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap',
  // Dependencies - using exact versions to match importmap and ensure reliability

];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');

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

      });
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  // Always fetch the service worker script from the network to ensure updates
  if (url.pathname.includes('sw.js')) {
    return fetch(event.request);
  }

  if (event.request.url.includes('supabase.co')) {
    return; // Bypass Service Worker for Supabase requests
  }

  const url = new URL(event.request.url);

  // Strategy 1: Stale-While-Revalidate for main scripts and local JS chunks.
  // We exclude sw.js itself from being intercepted by the service worker to avoid update loops or MIME type issues.
  // Strategy 1: Cache First, then Network for critical assets (index.html, index.js, manifest.json)
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/index.js' || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(event.request).then(response => {
        // Cache hit - return immediately
        if (response) {
          console.log('Service Worker: Cache hit for critical asset:', event.request.url);
          return response;
        }

        // No cache hit - fetch from network, cache, and return
        console.log('Service Worker: Fetching critical asset from network:', event.request.url);
        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            console.warn('Service Worker: Failed to fetch critical asset from network:', event.request.url, networkResponse?.status);
            return networkResponse; // Return whatever we got, even if it's an error
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(error => {
          console.error('Service Worker: Network fetch failed for critical asset:', event.request.url, error);
          // If both cache and network fail, try to fallback to index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html').then(fallbackResponse => {
              if (fallbackResponse) {
                console.log('Service Worker: Falling back to index.html for navigation.');
                return fallbackResponse;
              }
              // If even index.html is not cached, return a generic network error response
              return new Response('Offline: Failed to load application shell.', { status: 503, statusText: 'Service Unavailable' });
            });
          }
          // For other critical assets, if network fails and no cache, return a generic network error
          return new Response('Offline: Failed to load critical resource.', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
    return;
  }

  // Strategy 2: Stale-While-Revalidate for other JS and JSON files (excluding sw.js)
  if ((url.pathname.endsWith('.js') && !url.pathname.includes('sw.js')) || url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(e => {
             console.warn('Service Worker: Network fetch failed for JS/JSON (offline):', event.request.url, e);
             if (!cachedResponse) {
                 return new Response('Network error and no cache available for JS/JSON', { status: 503, statusText: 'Service Unavailable' });
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
        }).catch(err => console.warn('Failed to cache response:', err));
        return networkResponse;
      }).catch(error => {
          // Suppress "Failed to fetch" errors for non-essential assets to keep console clean
          if (event.request.destination === 'image' || event.request.destination === 'font') {
              console.warn('Fetch failed for asset, returning 404:', event.request.url);
              return new Response('Asset not found', { status: 404, statusText: 'Not Found' });
          }
          
          // If it's a script or module, returning a 408 might be better than letting it throw "Failed to fetch"
          if (event.request.destination === 'script') {
              console.error('Critical script failed to load:', event.request.url);
              return new Response('console.error("Critical script failed to load due to network error: ' + event.request.url + '");', { 
                  status: 200, 
                  headers: { 'Content-Type': 'application/javascript' } 
              });
          }

          return new Response('Network error', { status: 408, statusText: 'Request Timeout' });
      });
    })
  );
});
