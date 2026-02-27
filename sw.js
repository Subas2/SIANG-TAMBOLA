/**
 * SIANG TAMBOLA – Service Worker (Phase 4)
 * Offline caching + Push notification handler
 */

const CACHE_NAME = 'siang-tambola-v4';
const OFFLINE_URL = '/SIANG-TAMBOLA/offline.html';

// Assets to pre-cache
const PRECACHE_ASSETS = [
    '/SIANG-TAMBOLA/',
    '/SIANG-TAMBOLA/index.html',
    '/SIANG-TAMBOLA/offline.html',
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Poppins:wght@400;500;600;700&display=swap'
];

// ── Install: pre-cache key assets ──
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch(() => { });
        })
    );
    self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Fetch: network-first with offline fallback ──
self.addEventListener('fetch', (event) => {
    // Skip Firebase & Razorpay requests
    const url = event.request.url;
    if (url.includes('firebase') || url.includes('razorpay') || url.includes('googleapis.com/css')) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    // Cache-first for JS/CSS/fonts
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => caches.match(OFFLINE_URL));
        })
    );
});

// ── Push: show notification ──
self.addEventListener('push', (event) => {
    let data = { title: 'Siang Tambola', body: 'New update!', type: 'info' };
    try { data = event.data.json(); } catch (e) { }

    const icons = { game: '🎮', win: '🏆', warning: '⚠️', info: 'ℹ️' };
    const options = {
        body: data.body || data.message,
        icon: '/SIANG-TAMBOLA/icons/icon-192.png',
        badge: '/SIANG-TAMBOLA/icons/badge-72.png',
        tag: 'siang-tambola-' + data.type,
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: '/SIANG-TAMBOLA/' }
    };

    event.waitUntil(self.registration.showNotification(data.title || 'Siang Tambola 🎰', options));
});

// ── Notification click: open app ──
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (const c of clientList) {
                if (c.url.includes('SIANG-TAMBOLA') && 'focus' in c) return c.focus();
            }
            return clients.openWindow(event.notification.data?.url || '/SIANG-TAMBOLA/');
        })
    );
});
