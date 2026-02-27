/**
 * SIANG TAMBOLA – Live Chat Module (Phase 5)
 * Real-time in-game chat via Firebase Realtime DB
 * Includes profanity filter + admin badge + emoji picker
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, query, orderByChild, limitToLast, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const FB = { apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4", authDomain: "siang-tambola.firebaseapp.com", databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com", projectId: "siang-tambola", appId: "1:228062529046:web:caef7d77a7b0b2f4d65737" };
let db;
try { const app = initializeApp(FB, 'chat'); db = getDatabase(app); } catch (e) { db = getDatabase(); }

// ──────────────────────────────────────────────
// PROFANITY FILTER (basic)
// ──────────────────────────────────────────────

const BAD_WORDS = ['spam', 'abuse', 'hack', 'cheat']; // expand as needed
function filterText(text) {
    let clean = text.trim();
    if (clean.length > 200) clean = clean.slice(0, 200);
    BAD_WORDS.forEach(w => {
        const re = new RegExp(w, 'gi');
        clean = clean.replace(re, '***');
    });
    return clean;
}

// ──────────────────────────────────────────────
// SEND MESSAGE
// ──────────────────────────────────────────────

/**
 * Send a chat message
 * @param {string} gameId
 * @param {string} uid
 * @param {string} name
 * @param {string} text
 * @param {'player'|'admin'|'agent'} role
 */
export async function sendMessage(gameId, uid, name, text, role = 'player') {
    const clean = filterText(text);
    if (!clean) return;
    await push(ref(db, `games/${gameId}/chat`), {
        uid, name, text: clean, role,
        timestamp: serverTimestamp()
    });
}

// ──────────────────────────────────────────────
// LIVE LISTENER
// ──────────────────────────────────────────────

let chatUnsub = null;

/**
 * Subscribe to chat messages
 * @param {string} gameId
 * @param {Function} callback - called with messages[]
 * @param {number} limit
 */
export function listenToChat(gameId, callback, limit = 50) {
    if (chatUnsub) chatUnsub();
    const q = query(ref(db, `games/${gameId}/chat`), orderByChild('timestamp'), limitToLast(limit));
    onValue(q, (snap) => {
        const raw = snap.val() || {};
        const messages = Object.entries(raw).map(([id, m]) => ({ id, ...m }));
        callback(messages);
    });
}

// ──────────────────────────────────────────────
// UI BUILDER
// ──────────────────────────────────────────────

const QUICK_EMOJIS = ['👍', '🔥', '🎉', '😂', '😭', '🙏'];

/**
 * Mount a full chat UI into a container
 * @param {HTMLElement} container
 * @param {string} gameId
 * @param {{ uid, name, role }} user
 */
export function mountChat(container, gameId, user) {
    if (!container) return;

    container.innerHTML = `
        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px;min-height:0;"></div>
        <div style="border-top:1px solid rgba(255,255,255,0.06);padding:10px 12px;">
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                ${QUICK_EMOJIS.map(e => `<button onclick="chatSendEmoji('${e}')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;width:34px;height:34px;font-size:1.1rem;cursor:pointer;">${e}</button>`).join('')}
            </div>
            <div style="display:flex;gap:8px;">
                <input id="chat-input" placeholder="Type a message..." maxlength="200"
                    style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;color:#fff;font-family:'Nunito',sans-serif;font-size:0.88rem;outline:none;"
                    onkeydown="if(event.key==='Enter')chatSend()">
                <button onclick="chatSend()" style="background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 18px;color:#fff;font-family:'Nunito',sans-serif;font-weight:800;font-size:0.88rem;cursor:pointer;">Send</button>
            </div>
        </div>
    `;

    let prevCount = 0;

    listenToChat(gameId, (messages) => {
        const msgBox = document.getElementById('chat-messages');
        if (!msgBox) return;

        msgBox.innerHTML = messages.map(m => {
            const isMe = m.uid === user.uid;
            const isAdmin = m.role === 'admin';
            const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
            const bubble = isMe
                ? `rgba(139,92,246,0.2)` : isAdmin
                    ? `rgba(248,28,28,0.12)` : `rgba(255,255,255,0.05)`;
            const nameBadge = isAdmin
                ? `<span style="background:var(--red);color:#fff;font-size:0.6rem;font-weight:900;border-radius:4px;padding:1px 5px;margin-left:4px;">ADMIN</span>` : '';

            return `<div style="display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};">
                <div style="max-width:80%;background:${bubble};border-radius:${isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};padding:8px 12px;border:1px solid rgba(255,255,255,0.06);">
                    ${!isMe ? `<div style="font-size:0.68rem;font-weight:800;color:var(--muted);margin-bottom:3px;">${m.name || 'Player'}${nameBadge}</div>` : ''}
                    <div style="font-size:0.85rem;">${m.text}</div>
                    <div style="font-size:0.62rem;color:rgba(255,255,255,0.3);text-align:right;margin-top:3px;">${time}</div>
                </div>
            </div>`;
        }).join('');

        // Auto-scroll if new message
        if (messages.length > prevCount) {
            msgBox.scrollTop = msgBox.scrollHeight;
            prevCount = messages.length;
        }
    });

    // Expose send functions
    window.chatSend = async () => {
        const input = document.getElementById('chat-input');
        if (!input?.value?.trim()) return;
        await sendMessage(gameId, user.uid, user.name, input.value, user.role);
        input.value = '';
    };

    window.chatSendEmoji = async (emoji) => {
        await sendMessage(gameId, user.uid, user.name, emoji, user.role);
    };
}
