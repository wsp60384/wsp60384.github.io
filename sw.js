const CACHE_NAME = 'nz-roadtrip-v4';

// 核心必備檔案
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js'
];

// 1. 安裝階段：逐個載入，個別失敗不中斷整體安裝
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('快取略過項目:', url);
        }
      }
    })
  );
  self.skipWaiting();
});

// 2. 啟用階段：清除所有舊版本快取
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

// 3. 攔截請求：優先讀取快取，動態快取所有看過的圖片與字型
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 動態天氣與匯率 API：略過快取走網路
  if (url.includes('open-meteo.com') || url.includes('open.er-api.com') || url.includes('sunrise-sunset.org')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({})))
    );
    return;
  }

  // 靜態資源：快取優先 (Cache First)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // 如果網路請求成功，複製一份存入快取
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // 斷網且無快取時直接略過
      });
    })
  );
});
