// This version number is incremented to trigger the 'install' event and update the cache.
const CACHE_NAME = "lawyer-app-cache-v2026-04-12-10-57"; // Updated cache name for version 12-4-2026-5 (Force Refresh)

// The list of URLs to cache explicitly (App Shell)
const urlsToCache = ["/", "/index.html", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing...");
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log("Service Worker: Caching app shell.");
      // Try to cache all, but don't fail installation if non-critical assets fail
      const cachePromises = urlsToCache.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Status ${response.status}`);
          return cache.put(url, response);
        } catch (error) {
          console.warn(`Failed to cache ${url}:`, error);
        }
      });
      await Promise.all(cachePromises);
    }),
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Service Worker: Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        console.log("Service Worker: Claiming clients.");
        return self.clients.claim().then(() => {
          // Notify all clients to reload to get the latest version
          return self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({ type: "RELOAD_PAGE_NOW" });
            });
          });
        });
      }),
  );
});

self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Skip cross-origin requests (except for fonts/images if needed)
  if (url.origin !== self.location.origin) {
    // Special handling for Supabase or other known origins can go here
    if (url.hostname.includes("supabase.co")) {
      return; // Bypass SW for Supabase
    }
    return;
  }

  // Skip Service Worker script itself to avoid update loops
  if (url.pathname.endsWith("sw.js")) {
    return;
  }

  // Navigation requests: Network first, fallback to cache (index.html)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If valid response, cache it and return
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try to return index.html from cache
          return caches.match("/index.html");
        }),
    );
    return;
  }

  // Other assets: Cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          console.error("Fetch failed for:", event.request.url, error);
          // Return a basic error response for failed fetches
          return new Response("Network error", {
            status: 408,
            statusText: "Request Timeout",
          });
        });
    }),
  );
});
