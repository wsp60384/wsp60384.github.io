const CACHE_NAME = 'nz-roadtrip-app';

// 靜態核心函式庫與資源
const STATIC_ASSETS = [
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of STATIC_ASSETS) {
        try {
          const req = new Request(url, { mode: 'cors' });
          const res = await fetch(req);
          if (res.status === 200 || res.type === 'opaque') {
            await cache.put(req, res);
          }
        } catch (err) {}
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. 即時 API（天氣/匯率）：直接走網路
  if (url.includes('open-meteo.com') || url.includes('open.er-api.com') || url.includes('sunrise-sunset.org')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({})))
    );
    return;
  }

  // 2. HTML 頁面：採用 Network First（有網路永遠抓最新，斷網才讀快取）
  if (event.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // 斷網時從快取讀取
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. 其他靜態資源（CSS、JS、圖示）：Cache First（快取優先）
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque') && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {});
    })
  );
});
