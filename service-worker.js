// 🚀 HVĚZDNÁ FLOTILA - SERVICE WORKER 🚀
// PWA Offline podpora pro správce hesel
// Vytvořeno admirálem Claude.AI pro více admirála Jiříka

const CACHE_NAME = 'sprava-hesel-v1.0.0';
const RUNTIME_CACHE = 'runtime-cache-v1';

// 📦 Soubory pro offline režim
const CACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './firebase-logic.js',
  
  // CDN knihovny (Firebase, CryptoJS)
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js'
];

// ========================================
// 📥 INSTALACE SERVICE WORKERU
// ========================================
self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker instalován - Warpový pohon online!');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cachování souborů pro offline režim...');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Všechny soubory úspěšně cachovány!');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Chyba při cachování:', error);
      })
  );
});

// ========================================
// 🔄 AKTIVACE SERVICE WORKERU
// ========================================
self.addEventListener('activate', (event) => {
  console.log('⚡ Service Worker aktivován - Flotila připravena!');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('🗑️ Mazání staré cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Staré cache vyčištěny!');
        return self.clients.claim();
      })
  );
});

// ========================================
// 🌐 FETCH - OFFLINE STRATEGIE
// ========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 🔥 FIREBASE API - vždy Network First
  if (url.origin.includes('firebaseio.com') || 
      url.origin.includes('googleapis.com') ||
      url.origin.includes('firestore.googleapis.com')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // 🌐 CDN knihovny - Cache First
  if (url.origin.includes('cdnjs.cloudflare.com') || 
      url.origin.includes('gstatic.com')) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((response) => {
            return caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, response.clone());
              return response;
            });
          });
        })
    );
    return;
  }
  
  // 📄 LOKÁLNÍ SOUBORY - Cache First s Network Fallback
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response);
              });
            }
          }).catch(() => {});
          
          return cachedResponse;
        }
        
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            if (request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// ========================================
// 📨 ZPRÁVY OD KLIENTA
// ========================================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('🖖 Service Worker načten - Hvězdná flotila online!');