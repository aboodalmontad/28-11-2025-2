// sw.js - Unified Service Worker for Offline-First Lawyer Management App
const CACHE_NAME = "lawyer-app-cache-v2026-08-22-offline-v3";

// App Shell URLs to precache during Service Worker installation
const urlsToCache = [
  "./",
  "./index.html",
  "./index.css",
  "./index.tsx",
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
      const cachePromises = urlsToCache.map(async (url) => {
        try {
          const req = new Request(url, {
            mode: url.startsWith("http") ? "cors" : "no-cors",
          });
          const response = await fetch(req);
          if (response.ok || response.type === "opaque") {
            return await cache.put(url, response);
          }
        } catch (error) {
          console.warn(`Failed to precache ${url}:`, error);
        }
      });
      await Promise.all(cachePromises);
      console.log("Service Worker: Precaching completed.");
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating and cleaning obsolete caches.");
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
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", (event) => {
  // Skip non-GET requests (e.g. POST, PUT, DELETE should never be cached)
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Bypass Service Worker completely for Supabase sync database calls & backend APIs
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/api/")) {
    return;
  }

  // Bypass Vite Hot Module Replacement (HMR) websocket pings
  if (
    url.pathname.includes("__vite_ping") ||
    url.pathname.includes("@vite/client")
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

  // Navigation requests: Network first with robust offline fallback to cached index.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
              cache.put("./index.html", responseToCache.clone());
            });
          }
          return response;
        })
        .catch(async () => {
          console.log("Offline navigation fallback requested for:", event.request.url);
          const cached =
            (await caches.match(event.request)) ||
            (await caches.match("./index.html")) ||
            (await caches.match("/index.html")) ||
            (await caches.match("./")) ||
            (await caches.match("/"));
          
          if (cached) return cached;

          // Search any matching cache key in CACHE_NAME ending with index.html or /
          try {
            const cache = await caches.open(CACHE_NAME);
            const keys = await cache.keys();
            for (const key of keys) {
              if (key.url.endsWith("index.html") || key.url.endsWith("/")) {
                const match = await cache.match(key);
                if (match) return match;
              }
            }
          } catch (e) {
            console.error("Cache lookup error during navigation:", e);
          }

          return new Response("Offline Page Unavailable", {
            status: 503,
            statusText: "Service Unavailable",
          });
        })
    );
    return;
  }

  // Static Assets & Code Modules: Stale-While-Revalidate / Cache-First when Offline
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // If we are offline and have a cached copy, return it immediately
      if (cachedResponse && (typeof navigator !== "undefined" && !navigator.onLine)) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
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
        .catch(async (error) => {
          console.warn("Fetch failed offline for asset:", url.href, error);
          if (cachedResponse) {
            return cachedResponse;
          }

          const altMatch = await caches.match(url.pathname);
          if (altMatch) return altMatch;

          // Safe fallback for stylesheets
          if (url.pathname.endsWith(".css")) {
            return new Response("", { headers: { "Content-Type": "text/css" } });
          }

          return new Response("Offline Resource Unavailable", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
    })
  );
});

// Background Sync: Triggered automatically by browser when connectivity is restored
self.addEventListener("sync", (event) => {
  console.log("Service Worker: Sync event triggered with tag:", event.tag);
  if (event.tag === "sync-lawyer-data" || event.tag === "sync-data") {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "TRIGGER_BACKGROUND_SYNC",
            tag: event.tag,
            reason: "service_worker_sync",
            timestamp: Date.now(),
          });
        });
      })
    );
  }
});

// Periodic Background Sync: Triggered periodically by browser when online
self.addEventListener("periodicsync", (event) => {
  console.log("Service Worker: Periodic Sync event triggered with tag:", event.tag);
  if (event.tag === "periodic-sync-lawyer-data") {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "TRIGGER_BACKGROUND_SYNC",
            tag: event.tag,
            reason: "service_worker_periodic_sync",
            timestamp: Date.now(),
          });
        });
      })
    );
  }
});
