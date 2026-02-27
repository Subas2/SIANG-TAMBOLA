/**
 * SIANG TAMBOLA – Ticket Booking Module (Phase 4)
 * Seat selection, reservation, wallet deduction, and real-time availability
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, runTransaction, onValue, get, set, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { deductWallet } from './payment.js';

const FB = { apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4", authDomain: "siang-tambola.firebaseapp.com", databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com", projectId: "siang-tambola", appId: "1:228062529046:web:caef7d77a7b0b2f4d65737" };
let db;
try { const app = initializeApp(FB, 'booking'); db = getDatabase(app); } catch (e) { db = getDatabase(); }

// ──────────────────────────────────────────────
// ADMIN: Create seat slots for a game
// ──────────────────────────────────────────────

/**
 * Initialize N seats for a game
 * @param {string} gameId
 * @param {number} totalSeats
 * @param {number} ticketPrice
 */
export async function initGameSeats(gameId, totalSeats = 50, ticketPrice = 100) {
    const seats = {};
    for (let i = 1; i <= totalSeats; i++) {
        seats[`seat_${String(i).padStart(2, '0')}`] = {
            status: 'available', // 'available' | 'reserved' | 'sold'
            seatNumber: i,
            uid: null,
            playerName: null,
            reservedAt: null
        };
    }
    await set(ref(db, `games/${gameId}/seats`), seats);
    await set(ref(db, `games/${gameId}/seatConfig`), { totalSeats, ticketPrice, soldCount: 0 });
}

// ──────────────────────────────────────────────
// PLAYER: Reserve a seat (atomic, race-condition safe)
// ──────────────────────────────────────────────

/**
 * Reserve a specific seat for a player
 * @param {string} gameId
 * @param {string} seatId - e.g. 'seat_05'
 * @param {string} uid
 * @param {string} playerName
 * @returns {{ success, error?, ticketGrid? }}
 */
export async function reserveSeat(gameId, seatId, uid, playerName) {
    const seatRef = ref(db, `games/${gameId}/seats/${seatId}`);

    // Atomic reservation (prevents two players booking same seat)
    let reserved = false;
    await runTransaction(seatRef, (seat) => {
        if (!seat || seat.status !== 'available') return; // abort
        reserved = true;
        return {
            ...seat,
            status: 'reserved',
            uid,
            playerName,
            reservedAt: Date.now()
        };
    });

    if (!reserved) return { success: false, error: 'Seat already taken! Choose another.' };

    // Deduct wallet
    const gameSnap = await get(ref(db, `games/${gameId}/seatConfig`));
    const price = gameSnap.val()?.ticketPrice || 100;
    const walletResult = await deductWallet(uid, price);
    if (!walletResult.success) {
        // Rollback seat
        await runTransaction(seatRef, (seat) => ({ ...seat, status: 'available', uid: null, playerName: null }));
        return { success: false, error: walletResult.error };
    }

    // Mark as sold
    await runTransaction(seatRef, (seat) => ({ ...seat, status: 'sold' }));
    // Increment sold count
    await runTransaction(ref(db, `games/${gameId}/seatConfig/soldCount`), (c) => (c || 0) + 1);

    // Generate a valid ticket grid and save it
    const { generateTicket } = await import('./tambola-engine.js');
    const grid = generateTicket();
    await set(ref(db, `games/${gameId}/tickets/${uid}/${seatId}`), {
        grid, seatId, purchasedAt: serverTimestamp()
    });

    return { success: true, ticketGrid: grid, seatId, price };
}

// ──────────────────────────────────────────────
// PLAYER: Get my booked tickets for a game
// ──────────────────────────────────────────────

export async function getMyTickets(gameId, uid) {
    const snap = await get(ref(db, `games/${gameId}/tickets/${uid}`));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([seatId, t]) => ({ seatId, ...t }));
}

// ──────────────────────────────────────────────
// LIVE: Seat availability listener
// ──────────────────────────────────────────────

/**
 * Listen to seat availability in real-time
 * @param {string} gameId
 * @param {Function} callback - called with seats object
 */
export function listenToSeats(gameId, callback) {
    onValue(ref(db, `games/${gameId}/seats`), (snap) => {
        callback(snap.val() || {});
    });
}

// ──────────────────────────────────────────────
// UI: Render seat grid
// ──────────────────────────────────────────────

/**
 * Render an interactive seat grid into a container
 * @param {HTMLElement} container
 * @param {Object} seats - Firebase seats object
 * @param {string} currentUid - to mark own seats
 * @param {Function} onSeatClick - called with (seatId, seat)
 */
export function renderSeatGrid(container, seats, currentUid, onSeatClick) {
    if (!container) return;
    const entries = Object.entries(seats).sort(([a], [b]) => a.localeCompare(b));

    container.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px;">
            ${entries.map(([seatId, seat]) => {
        const isMine = seat.uid === currentUid;
        const bg = seat.status === 'available' ? 'rgba(16,185,129,0.12)' :
            isMine ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.04)';
        const border = seat.status === 'available' ? 'rgba(16,185,129,0.4)' :
            isMine ? 'var(--accent)' : 'rgba(255,255,255,0.08)';
        const color = seat.status === 'available' ? 'var(--green)' :
            isMine ? 'var(--neon)' : 'var(--muted)';
        const cursor = seat.status === 'available' ? 'pointer' : 'not-allowed';
        const label = isMine ? '✓' : seat.seatNumber;
        return `<div 
                    data-seat="${seatId}"
                    onclick="${seat.status === 'available' ? `bookingSeatClick('${seatId}')` : ''}"
                    style="width:40px;height:40px;background:${bg};border:1px solid ${border};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;color:${color};cursor:${cursor};transition:all 0.2s;">
                    ${label}
                </div>`;
    }).join('')}
        </div>
        <div style="display:flex;gap:12px;margin-top:12px;padding:0 4px;font-size:0.72rem;">
            <div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;background:rgba(16,185,129,0.3);border:1px solid var(--green);border-radius:3px;"></div> Available</div>
            <div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;background:rgba(139,92,246,0.35);border:1px solid var(--accent);border-radius:3px;"></div> Mine</div>
            <div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:3px;"></div> Taken</div>
        </div>
    `;
}
