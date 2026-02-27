/**
 * SIANG TAMBOLA – Prize Pool Module (Phase 5)
 * Dynamic prize pool based on ticket sales, shown live to all players
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, get, update, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const FB = { apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4", authDomain: "siang-tambola.firebaseapp.com", databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com", projectId: "siang-tambola", appId: "1:228062529046:web:caef7d77a7b0b2f4d65737" };
let db;
try { const app = initializeApp(FB, 'pp'); db = getDatabase(app); } catch (e) { db = getDatabase(); }

// Default prize split percentages
const DEFAULT_SPLIT = {
    early5: 10,
    topRow: 15,
    midRow: 15,
    botRow: 15,
    fullHouse: 45
};

const PATTERN_LABELS = {
    early5: 'Early 5', topRow: 'Top Row', midRow: 'Mid Row',
    botRow: 'Bot Row', fullHouse: 'Full House 🏠'
};

// ──────────────────────────────────────────────
// ADMIN: Save prize config to game
// ──────────────────────────────────────────────

/**
 * @param {string} gameId
 * @param {number} poolPercent - % of revenue that goes to prizes (e.g. 80)
 * @param {Object} split - { early5, topRow, midRow, botRow, fullHouse } (must add to 100)
 */
export async function savePrizeConfig(gameId, poolPercent = 80, split = DEFAULT_SPLIT) {
    await update(ref(db, `games/${gameId}`), {
        prizePoolPercent: poolPercent,
        prizeSplit: split,
        updatedAt: serverTimestamp()
    });
}

// ──────────────────────────────────────────────
// CALCULATE PRIZE POOL
// ──────────────────────────────────────────────

/**
 * @param {number} ticketPrice
 * @param {number} soldCount
 * @param {number} poolPercent
 * @param {Object} split
 * @returns {{ total, perPattern: { patternKey: amount } }}
 */
export function calculatePrizePool(ticketPrice, soldCount, poolPercent = 80, split = DEFAULT_SPLIT) {
    const revenue = ticketPrice * soldCount;
    const total = Math.floor(revenue * (poolPercent / 100));
    const perPattern = {};
    Object.entries(split).forEach(([pattern, pct]) => {
        perPattern[pattern] = Math.floor(total * (pct / 100));
    });
    return { total, revenue, perPattern };
}

// ──────────────────────────────────────────────
// LIVE LISTENER: Updates prize pool as tickets sell
// ──────────────────────────────────────────────

/**
 * Listen to a game and call callback whenever prize pool changes
 * @param {string} gameId
 * @param {Function} callback - called with { total, perPattern, soldCount }
 */
export function listenToPrizePool(gameId, callback) {
    onValue(ref(db, `games/${gameId}`), (snap) => {
        const game = snap.val();
        if (!game) return;

        const soldCount = game.seatConfig?.soldCount || Object.keys(game.players || {}).length || 0;
        const ticketPrice = game.ticketPrice || 100;
        const poolPercent = game.prizePoolPercent || 80;
        const split = game.prizeSplit || DEFAULT_SPLIT;

        const result = calculatePrizePool(ticketPrice, soldCount, poolPercent, split);
        callback({ ...result, soldCount, ticketPrice });
    });
}

// ──────────────────────────────────────────────
// UI: Render prize pool banner
// ──────────────────────────────────────────────

/**
 * Render a live prize pool display
 * @param {HTMLElement} container
 * @param {{ total, perPattern, soldCount, ticketPrice }} data
 * @param {string[]} activePatterns - patterns enabled for this game
 */
export function renderPrizePool(container, data, activePatterns = Object.keys(DEFAULT_SPLIT)) {
    if (!container) return;
    const { total, perPattern, soldCount, ticketPrice } = data;

    container.innerHTML = `
        <!-- Total pool banner -->
        <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.08));border:1px solid rgba(245,158,11,0.35);border-radius:16px;padding:18px;text-align:center;margin-bottom:12px;">
            <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:2px;color:var(--gold);font-weight:700;margin-bottom:4px;">🏆 Total Prize Pool</div>
            <div id="prize-total-num" style="font-size:2.6rem;font-weight:900;color:var(--gold);line-height:1;">${total > 0 ? '₹' + total.toLocaleString() : '—'}</div>
            <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-top:6px;">${soldCount} ticket${soldCount !== 1 ? 's' : ''} sold · ₹${ticketPrice} each</div>
        </div>

        <!-- Per-pattern breakdown -->
        <div style="display:flex;flex-direction:column;gap:6px;">
            ${activePatterns.map(p => `
            <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;">
                <div style="font-size:0.85rem;font-weight:700;">${PATTERN_LABELS[p] || p}</div>
                <div style="font-size:0.95rem;font-weight:900;color:var(--gold);">${perPattern[p] ? '₹' + perPattern[p].toLocaleString() : '—'}</div>
            </div>`).join('')}
        </div>`;

    // Animate total change
    const el = document.getElementById('prize-total-num');
    if (el && total > 0) {
        el.style.transform = 'scale(1.06)';
        setTimeout(() => { el.style.transform = 'scale(1)'; el.style.transition = 'transform 0.3s'; }, 50);
    }
}

// ──────────────────────────────────────────────
// ADMIN: Get exact prize for a pattern (on claim approval)
// ──────────────────────────────────────────────

export async function getPatternPrize(gameId, pattern) {
    const snap = await get(ref(db, `games/${gameId}`));
    const game = snap.val() || {};
    const soldCount = game.seatConfig?.soldCount || Object.keys(game.players || {}).length || 0;
    const result = calculatePrizePool(
        game.ticketPrice || 100, soldCount,
        game.prizePoolPercent || 80,
        game.prizeSplit || DEFAULT_SPLIT
    );
    return result.perPattern[pattern] || 0;
}
