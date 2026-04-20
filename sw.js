
const CACHE_NAME = 'lawyer-app-cache-v2026-04-18'; // Force Refresh

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      const cachePromises = urlsToCache.map(async url => {
          try {
              const req = new Request(url, { mode: url.startsWith('http') ? 'cors' : 'no-cors' });
              const response = await fetch(req);
              if (response.ok || response.type === 'opaque') {
                  return cache.put(url, response);
              }
          } catch (error) {
              console.warn(`Failed to precache ${url}:`, error);
          }
      });
      await Promise.all(cachePromises);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
      })
    )).then(() => self.clients.claim().then(() => {
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'RELOAD_PAGE_NOW' }));
      });
    }))
  );
});

// Helper for fetch with timeout
const fetchWithTimeout = (request, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs);
    fetch(request).then(response => {
      clearTimeout(timeoutId);
      resolve(response);
    }).catch(err => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
};

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;

  const isNavigation = event.request.mode === 'navigate';
  const isHtml = url.pathname === '/' || url.pathname.endsWith('.html');
  const isViteHmr = url.pathname.includes('@vite') || url.pathname.includes('?import') || url.pathname.includes('.ts') || url.pathname.includes('.tsx');

  // Network First with Timeout for HTML and core scripts (to catch updates)
  if (isNavigation || isHtml || isViteHmr) {
    event.respondWith(
      fetchWithTimeout(event.request, 2000)
        .then(response => {
          if (!response || (response.status !== 200 && response.type !== 'opaque')) return response;
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request).then(res => res || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Stale-While-Revalidate for everything else (CSS, Fonts, Images, Tailwind CDN)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && (response.status === 200 || response.type === 'opaque')) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return response;
      }).catch(e => console.warn('Background fetch failed:', e));

      return cachedResponse || networkFetch;
    })
  );
});
