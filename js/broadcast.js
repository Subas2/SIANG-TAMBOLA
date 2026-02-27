/**
 * SIANG TAMBOLA – Broadcast Module (Phase 4)
 * Admin push announcements → all connected players via Firebase
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, query, orderByChild, limitToLast, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const FB = { apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4", authDomain: "siang-tambola.firebaseapp.com", databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com", projectId: "siang-tambola", appId: "1:228062529046:web:caef7d77a7b0b2f4d65737" };
let db;
try { const app = initializeApp(FB, 'broadcast'); db = getDatabase(app); } catch (e) { db = getDatabase(); }

// ──────────────────────────────────────────────
// ADMIN: Send a broadcast
// ──────────────────────────────────────────────

/**
 * Send a broadcast message to all players
 * @param {string} message
 * @param {'info'|'warning'|'game'|'win'} type
 * @param {string} adminName
 */
export async function sendBroadcast(message, type = 'info', adminName = 'Admin') {
    await push(ref(db, 'broadcasts'), {
        message,
        type,
        adminName,
        timestamp: serverTimestamp()
    });
}

// ──────────────────────────────────────────────
// PLAYER: Listen and show toast notifications
// ──────────────────────────────────────────────

let lastSeen = Date.now();

/**
 * Subscribe to broadcasts and display as toasts
 * Call this once on player page load.
 */
export function subscribeToBroadcasts() {
    const q = query(ref(db, 'broadcasts'), orderByChild('timestamp'), limitToLast(1));
    onValue(q, (snap) => {
        const raw = snap.val();
        if (!raw) return;
        const [id, broadcast] = Object.entries(raw)[0];
        // Only show if newer than page load time
        if (broadcast.timestamp && broadcast.timestamp > lastSeen) {
            lastSeen = broadcast.timestamp;
            showToast(broadcast.message, broadcast.type);
        }
    });
}

// ──────────────────────────────────────────────
// TOAST UI
// ──────────────────────────────────────────────

const TOAST_ICONS = { info: 'ℹ️', warning: '⚠️', game: '🎮', win: '🏆', error: '❌' };
const TOAST_COLORS = {
    info: 'linear-gradient(135deg,#1e1248,#251555)',
    warning: 'linear-gradient(135deg,#3d2a00,#4d3600)',
    game: 'linear-gradient(135deg,#1a0040,#2d0060)',
    win: 'linear-gradient(135deg,#1a3a00,#254d00)'
};
const TOAST_BORDERS = { info: 'rgba(139,92,246,0.5)', warning: 'rgba(245,158,11,0.5)', game: 'rgba(139,92,246,0.6)', win: 'rgba(16,185,129,0.5)' };

let toastContainer = null;

function getToastContainer() {
    if (toastContainer) return toastContainer;
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;width:calc(100% - 32px);max-width:420px;pointer-events:none;';
    document.body.appendChild(el);
    toastContainer = el;
    return el;
}

export function showToast(message, type = 'info', duration = 4000) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    const icon = TOAST_ICONS[type] || 'ℹ️';
    const bg = TOAST_COLORS[type] || TOAST_COLORS.info;
    const border = TOAST_BORDERS[type] || TOAST_BORDERS.info;

    toast.style.cssText = `background:${bg};border:1px solid ${border};border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;pointer-events:all;box-shadow:0 8px 32px rgba(0,0,0,0.5);backdrop-filter:blur(12px);transform:translateY(-20px);opacity:0;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);`;
    toast.innerHTML = `
        <div style="font-size:1.4rem;flex-shrink:0;">${icon}</div>
        <div style="flex:1;">
            <div style="font-size:0.85rem;font-weight:700;color:#e2d9f3;">${message}</div>
        </div>
        <div onclick="this.parentElement.remove()" style="cursor:pointer;color:rgba(255,255,255,0.3);font-size:0.8rem;flex-shrink:0;">✕</div>
    `;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });

    // Auto-dismiss
    setTimeout(() => {
        toast.style.transform = 'translateY(-20px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

// ──────────────────────────────────────────────
// QUICK BROADCAST TEMPLATES (admin shortcuts)
// ──────────────────────────────────────────────

export const BROADCAST_TEMPLATES = [
    { label: '🎮 Game Starting!', message: '🎮 Game is starting in 5 minutes! Buy your tickets now!', type: 'game' },
    { label: '🏆 Winner Declared', message: '🏆 We have a winner! Congratulations! Next game soon.', type: 'win' },
    { label: '⚠️ Maintenance', message: '⚠️ Short maintenance break. Back in 10 minutes!', type: 'warning' },
    { label: '💎 Special Offer', message: '💎 Special! Get 2 tickets for the price of 1 – next game only!', type: 'info' },
    { label: '🔥 Last Few Seats!', message: '🔥 Hurry! Only a few seats left for the current game!', type: 'warning' },
];
