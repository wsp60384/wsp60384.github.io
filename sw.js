const CACHE_NAME = 'nz-roadtrip-v5';

// 核心資源清單
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js'
];

// 1. 安裝階段：支援跨域 (cors) 抓取並存入快取
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        try {
          const req = new Request(url, { mode: 'cors' });
          const res = await fetch(req);
          if (res.status === 200 || res.type === 'opaque') {
            await cache.put(req, res);
          }
        } catch (err) {
          console.warn('預快取失敗項目:', url);
        }
      }
    })
  );
  self.skipWaiting();
});

// 2. 啟用階段：清除舊快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. 攔截請求：全面快取優先策略
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 天氣與匯率 API：略過快取走網路
  if (url.includes('open-meteo.com') || url.includes('open.er-api.com') || url.includes('sunrise-sunset.org')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({})))
    );
    return;
  }

  // 靜態資源與 CDN：Cache First
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
