/**
 * SIANG TAMBOLA – PWA Module (Phase 4)
 * Service Worker registration + FCM Push subscription
 */

// ──────────────────────────────────────────────
// SERVICE WORKER REGISTRATION
// ──────────────────────────────────────────────

export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        const reg = await navigator.serviceWorker.register('/SIANG-TAMBOLA/sw.js', { scope: '/SIANG-TAMBOLA/' });
        console.log('✅ SW registered:', reg.scope);
        return reg;
    } catch (err) {
        console.warn('SW registration failed:', err);
        return null;
    }
}

// ──────────────────────────────────────────────
// INSTALL PROMPT (Add to Home Screen)
// ──────────────────────────────────────────────

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install banner after 3s
    setTimeout(showInstallBanner, 3000);
});

window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    deferredPrompt = null;
});

export function showInstallBanner() {
    if (!deferredPrompt) return;
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:linear-gradient(135deg,#1e1248,#251555);
        border:1px solid rgba(139,92,246,0.4);border-radius:16px;
        padding:14px 18px;z-index:5000;
        display:flex;align-items:center;gap:12px;
        width:calc(100% - 32px);max-width:420px;
        box-shadow:0 8px 32px rgba(0,0,0,0.5);
        backdrop-filter:blur(12px);
        animation:slideUp 0.4s cubic-bezier(0.4,0,0.2,1);
    `;
    banner.innerHTML = `
        <div style="font-size:1.8rem;">📲</div>
        <div style="flex:1;">
            <div style="font-weight:800;font-size:0.9rem;">Install Siang Tambola</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.55);margin-top:2px;">Play faster, even offline!</div>
        </div>
        <button id="pwa-install-btn" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border:none;border-radius:10px;padding:9px 16px;color:#fff;font-family:'Nunito',sans-serif;font-weight:800;font-size:0.82rem;cursor:pointer;">Install</button>
        <div onclick="document.getElementById('pwa-install-banner').remove()" style="cursor:pointer;color:rgba(255,255,255,0.3);padding:4px;font-size:0.8rem;">✕</div>
    `;
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').onclick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') banner.remove();
        deferredPrompt = null;
    };

    // Add animation keyframes if not present
    if (!document.getElementById('pwa-styles')) {
        const style = document.createElement('style');
        style.id = 'pwa-styles';
        style.textContent = `@keyframes slideUp { from { transform: translateX(-50%) translateY(30px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }`;
        document.head.appendChild(style);
    }
}

export function hideInstallBanner() {
    document.getElementById('pwa-install-banner')?.remove();
}

// ──────────────────────────────────────────────
// PUSH NOTIFICATIONS (FCM via Firebase Messaging)
// ──────────────────────────────────────────────

const VAPID_KEY = 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY'; // Get from Firebase Console → Project Settings → Cloud Messaging

export async function subscribeToPushNotifications() {
    if (!('Notification' in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        const { getMessaging, getToken } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js");
        const { getDatabase, ref, set } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
        const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");

        const FB = { apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4", authDomain: "siang-tambola.firebaseapp.com", databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com", projectId: "siang-tambola", messagingSenderId: "228062529046", appId: "1:228062529046:web:caef7d77a7b0b2f4d65737" };
        let app;
        try { app = initializeApp(FB, 'pwa'); } catch (e) { app = initializeApp.app?.(); }

        const messaging = getMessaging(app);
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });

        if (token) {
            const auth = getAuth(app);
            const uid = auth.currentUser?.uid;
            if (uid) {
                await set(ref(getDatabase(app), `users/${uid}/fcmToken`), token);
            }
            console.log('📲 FCM Token registered');
        }
        return token;
    } catch (err) {
        console.warn('Push notification setup failed:', err.message);
        return null;
    }
}

// ──────────────────────────────────────────────
// INIT: Call both on startup
// ──────────────────────────────────────────────

export async function initPWA() {
    await registerServiceWorker();
    // Don't auto-request push permission — wait for user action
}
