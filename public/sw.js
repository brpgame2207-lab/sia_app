// SIA PWA & SOS Notification Service Worker
const CACHE_NAME = 'sia-static-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json?v=2',
  '/icon.svg?v=2',
  '/icon-192.png?v=2',
  '/icon-512.png?v=2',
  '/sw.js'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Dynamic Offline Caching Handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip external APIs, Firebase services, and development HMR web sockets
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@react-refresh') ||
    url.pathname.includes('chrome-extension') ||
    event.request.url.includes('ws://') ||
    (event.request.url.includes('localhost') && url.pathname.includes('socket'))
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache, update in background (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch((err) => console.log('[SW] Background sync failed:', err));
        
        return cachedResponse;
      }

      // Network First strategy
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// --- SOS EMERGENCY NOTIFICATION HANDLERS ---
self.addEventListener('message', (event) => {
  console.log('[SW] Received message:', event.data);
  
  if (event.data && event.data.type === 'SOS_ALERT') {
    const { title, body, tag } = event.data;
    
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [300, 100, 300, 100, 300],
      tag: tag || 'sos-alert',
      renotify: true,
      requireInteraction: true,
      actions: [
        { action: 'acknowledge', title: 'Acknowledge' }
      ]
    });
  } else if (event.data && event.data.type === 'CANCEL_SOS_ALERT') {
    const tagToCancel = event.data.tag;
    console.log(`[SW] Attempting to cancel notification with tag: ${tagToCancel}`);
    self.registration.getNotifications({ tag: tagToCancel }).then((notifications) => {
      notifications.forEach((notification) => {
        notification.close();
        console.log(`[SW] Notification closed for tag: ${tagToCancel}`);
      });
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  
  const sosId = event.notification.tag;
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      let client = clientList.find(c => c.visibilityState === 'visible') || clientList[0];
      
      if (client) {
        client.postMessage({ type: 'SOS_ACKNOWLEDGED', sosId });
        return client.focus();
      }
      
      return self.clients.openWindow('/?sos_ack=' + sosId);
    })
  );
});

// --- WEB PUSH NOTIFICATION LISTENER (Wakes up service worker when app is closed) ---
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: '🚨 SIA ALERT 💗',
    body: 'Someone nearby requested sanitary support!',
    tag: 'sos-alert'
  };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [300, 100, 300, 100, 300],
    tag: data.tag || 'sos-alert',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'acknowledge', title: 'Acknowledge' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
