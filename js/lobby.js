/**
 * SIANG TAMBOLA – Game Room Lobby Module (Phase 5)
 * Multi-room support: browse active rooms, join with one tap
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, get, update, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const FB = { apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4", authDomain: "siang-tambola.firebaseapp.com", databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com", projectId: "siang-tambola", appId: "1:228062529046:web:caef7d77a7b0b2f4d65737" };
let db;
try { const app = initializeApp(FB, 'lobby'); db = getDatabase(app); } catch (e) { db = getDatabase(); }

const STATUS_META = {
    waiting: { label: 'Waiting', color: 'var(--gold)', icon: '⏳' },
    live: { label: 'LIVE', color: 'var(--green)', icon: '🔴' },
    ended: { label: 'Ended', color: 'var(--muted)', icon: '✅' }
};

// ──────────────────────────────────────────────
// LIVE LOBBY LISTENER
// ──────────────────────────────────────────────

/**
 * Listen to all active + recent game rooms
 * @param {Function} callback - called with rooms[]
 * @param {boolean} includeEnded - show ended rooms too
 */
export function listenToLobby(callback, includeEnded = false) {
    onValue(ref(db, 'games'), (snap) => {
        const raw = snap.val() || {};
        const rooms = Object.entries(raw)
            .map(([id, g]) => {
                const soldCount = g.seatConfig?.soldCount || Object.keys(g.players || {}).length || 0;
                const totalSeats = g.seatConfig?.totalSeats || 50;
                const revenue = (g.ticketPrice || 0) * soldCount;
                const prizePool = Math.floor(revenue * ((g.prizePoolPercent || 80) / 100));
                const status = !g.active ? 'ended' : (g.totalCalled || 0) > 0 ? 'live' : 'waiting';
                return {
                    id, status,
                    name: g.name || 'Tambola Room',
                    ticketPrice: g.ticketPrice || 100,
                    drawSpeed: g.drawSpeed || 10,
                    soldCount, totalSeats,
                    prizePool,
                    totalCalled: g.totalCalled || 0,
                    patterns: g.patterns || [],
                    createdAt: g.createdAt || 0
                };
            })
            .filter(r => includeEnded || r.status !== 'ended')
            .sort((a, b) => {
                // Live first, then waiting, then by time
                const order = { live: 0, waiting: 1, ended: 2 };
                return (order[a.status] - order[b.status]) || (b.createdAt - a.createdAt);
            });
        callback(rooms);
    });
}

// ──────────────────────────────────────────────
// ADMIN: End / Archive a room
// ──────────────────────────────────────────────

export async function endRoom(gameId) {
    await update(ref(db, `games/${gameId}`), {
        active: false,
        endedAt: serverTimestamp()
    });
}

// ──────────────────────────────────────────────
// UI: Render lobby room cards
// ──────────────────────────────────────────────

/**
 * Render lobby room list
 * @param {HTMLElement} container
 * @param {Object[]} rooms
 * @param {Function} onJoin - called with (gameId, room)
 * @param {boolean} isAdmin
 */
export function renderLobby(container, rooms, onJoin, isAdmin = false) {
    if (!container) return;

    if (rooms.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:48px 24px;">
                <div style="font-size:3.5rem;margin-bottom:16px;">🎰</div>
                <div style="font-weight:800;font-size:1.1rem;margin-bottom:8px;">No Active Rooms</div>
                <div style="color:var(--muted);font-size:0.85rem;">Wait for the admin to create a game room.</div>
            </div>`;
        return;
    }

    container.innerHTML = rooms.map(room => {
        const meta = STATUS_META[room.status] || STATUS_META.waiting;
        const filledPct = room.totalSeats > 0 ? Math.round((room.soldCount / room.totalSeats) * 100) : 0;
        const spotsLeft = room.totalSeats - room.soldCount;
        const canJoin = room.status !== 'ended' && spotsLeft > 0;

        return `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:18px;overflow:hidden;margin-bottom:12px;">
            <!-- Header -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div>
                    <div style="font-weight:900;font-size:1rem;">${room.name}</div>
                    <div style="font-size:0.7rem;color:var(--muted);margin-top:2px;">Draw: every ${room.drawSpeed}s</div>
                </div>
                <div style="background:rgba(255,255,255,0.06);border-radius:8px;padding:5px 10px;display:flex;align-items:center;gap:5px;font-size:0.75rem;font-weight:800;color:${meta.color};">
                    ${meta.icon} ${meta.label}
                </div>
            </div>
            <!-- Stats grid -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="padding:12px;text-align:center;border-right:1px solid rgba(255,255,255,0.06);">
                    <div style="font-weight:900;font-size:1.1rem;color:var(--gold);">₹${room.ticketPrice}</div>
                    <div style="font-size:0.65rem;color:var(--muted);">Ticket</div>
                </div>
                <div style="padding:12px;text-align:center;border-right:1px solid rgba(255,255,255,0.06);">
                    <div style="font-weight:900;font-size:1.1rem;color:var(--green);">₹${room.prizePool.toLocaleString()}</div>
                    <div style="font-size:0.65rem;color:var(--muted);">Prize Pool</div>
                </div>
                <div style="padding:12px;text-align:center;">
                    <div style="font-weight:900;font-size:1.1rem;">${room.soldCount}/${room.totalSeats}</div>
                    <div style="font-size:0.65rem;color:var(--muted);">Players</div>
                </div>
            </div>
            <!-- Fill bar + Actions -->
            <div style="padding:12px 16px;">
                <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:5px;margin-bottom:10px;overflow:hidden;">
                    <div style="width:${filledPct}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--cyan));transition:width 0.5s;"></div>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-size:0.75rem;color:var(--muted);">${spotsLeft > 0 ? spotsLeft + ' spots left' : 'Full'} · Numbers: ${room.totalCalled}/90</div>
                    <div style="display:flex;gap:6px;">
                        ${isAdmin ? `<button onclick="lobbyEndRoom('${room.id}')" style="padding:8px 12px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:var(--red);font-family:'Nunito',sans-serif;font-size:0.78rem;font-weight:700;cursor:pointer;">End</button>` : ''}
                        <button onclick="lobbyJoinRoom('${room.id}')" ${!canJoin ? 'disabled' : ''} style="padding:8px 18px;background:${canJoin ? 'linear-gradient(135deg,var(--accent),var(--accent2))' : 'rgba(255,255,255,0.06)'};border:none;border-radius:8px;color:${canJoin ? '#fff' : 'var(--muted)'};font-family:'Nunito',sans-serif;font-size:0.82rem;font-weight:800;cursor:${canJoin ? 'pointer' : 'not-allowed'};">${room.status === 'live' ? '▶ Watch' : canJoin ? '🎫 Join' : 'Full'}</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    // Wire callbacks to window so onclick works
    window.lobbyJoinRoom = (gameId) => {
        const room = rooms.find(r => r.id === gameId);
        if (room && onJoin) onJoin(gameId, room);
    };
    window.lobbyEndRoom = async (gameId) => {
        if (!confirm('End this room? Players will not be able to join.')) return;
        await endRoom(gameId);
    };
}
