// sw.js - Unified Service Worker for Offline-First Lawyer Management App
const CACHE_NAME = "lawyer-app-cache-v2026-08-22-offline-v4";

// The list of URLs to cache (App Shell). Will be populated dynamically during build.
const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "https://cdn.tailwindcss.com",
  "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap"
];

self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing and caching app shell assets.");
  self.skipWaiting(); // Force the waiting service worker to become active immediately.

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Fetch and cache all assets, but handle failures gracefully per asset
      const cachePromises = urlsToCache.map(async (url) => {
        try {
          const req = new Request(url, {
            mode: url.startsWith("http") ? "cors" : "no-cors",
          });
          const response = await fetch(req);
          if (response.ok || response.type === "opaque") {
            return await cache.put(url, response);
          }
          throw new Error(`Invalid response status: ${response.status}`);
        } catch (error) {
          console.warn(`Failed to precache ${url}:`, error);
        }
      });
      await Promise.all(cachePromises);
      console.log("Service Worker: Installation and caching completed.");
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating and cleaning old caches.");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Service Worker: Deleting obsolete cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("Service Worker: Claiming clients.");
        return self.clients.claim().then(() => {
          // Notify all open client tabs to reload and use the updated Service Worker
          return self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({ type: "RELOAD_PAGE_NOW" });
            });
          });
        });
      })
  );
});

self.addEventListener("fetch", (event) => {
  // Skip non-GET requests (e.g. POST, PUT, DELETE should never be cached)
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Bypass Service Worker completely for Supabase sync database calls & local APIs
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/api/")) {
    return;
  }

  // Bypass Vite Hot Module Replacement (HMR) and development compilation assets
  if (
    url.pathname.includes("@vite") ||
    url.pathname.includes("?import") ||
    url.pathname.includes("__vite_ping") ||
    url.pathname.endsWith(".ts") ||
    url.pathname.endsWith(".tsx")
  ) {
    return;
  }

  // Bypass the Service Worker script itself to prevent updates loop
  if (url.pathname.endsWith("sw.js")) {
    return;
  }

  // Handle Cross-Origin requests securely
  const isCrossOrigin = url.origin !== self.location.origin;
  const allowedOrigins = [
    "cdn.tailwindcss.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com"
  ];
  const isAllowedOrigin = allowedOrigins.some((origin) => url.hostname.includes(origin));

  if (isCrossOrigin && !isAllowedOrigin) {
    return;
  }

  // Navigation requests: Network first, then fallback to cached index.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match("/index.html") || caches.match("./index.html") || caches.match("/");
        })
    );
    return;
  }

  // Static Assets (JS, CSS, Images, Fonts, etc.): Cache-first with Network Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Cache successful responses (status 200 or opaque cross-origin)
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === "opaque")
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          console.warn("Fetch failed for asset:", url.href, error);
          // Return a basic offline fallback response for assets if they fail
          return new Response("Offline Resource Unavailable", {
            status: 408,
            statusText: "Request Timeout",
          });
        });
    })
  );
});
