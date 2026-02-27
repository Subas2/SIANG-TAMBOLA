/**
 * SIANG TAMBOLA – Leaderboard Module (Phase 5)
 * Real-time winner rankings across all/weekly/current game
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, onValue, query, orderByChild, limitToLast }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const FB = { apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4", authDomain: "siang-tambola.firebaseapp.com", databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com", projectId: "siang-tambola", appId: "1:228062529046:web:caef7d77a7b0b2f4d65737" };
let db;
try { const app = initializeApp(FB, 'lb'); db = getDatabase(app); } catch (e) { db = getDatabase(); }

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

// ──────────────────────────────────────────────
// DATA FETCHERS
// ──────────────────────────────────────────────

/**
 * Get all-time leaderboard (top 20 players)
 */
export async function getAllTimeLeaderboard() {
    const snap = await get(ref(db, 'users'));
    const users = snap.val() || {};
    return Object.entries(users)
        .filter(([, u]) => u.role === 'player' && (u.totalPrize || u.gamesWon))
        .map(([uid, u]) => ({
            uid,
            name: u.name || u.phone || 'Anonymous',
            gamesPlayed: u.gamesPlayed || 0,
            gamesWon: u.gamesWon || 0,
            totalPrize: u.totalPrize || 0,
            winRate: u.gamesPlayed ? Math.round((u.gamesWon / u.gamesPlayed) * 100) : 0,
            avatar: u.photoURL || null
        }))
        .sort((a, b) => b.totalPrize - a.totalPrize)
        .slice(0, 20);
}

/**
 * Get this week's leaderboard
 */
export async function getWeeklyLeaderboard() {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const [usersSnap, gamesSnap] = await Promise.all([
        get(ref(db, 'users')),
        get(ref(db, 'games'))
    ]);
    const users = usersSnap.val() || {};
    const games = gamesSnap.val() || {};

    // Aggregate wins from games created this week
    const weeklyStats = {};
    Object.values(games).forEach(g => {
        if (!g.createdAt || g.createdAt < weekAgo) return;
        Object.values(g.claims || {}).forEach(c => {
            if (c.status !== 'approved' || !c.uid) return;
            weeklyStats[c.uid] = weeklyStats[c.uid] || { wins: 0, prize: 0 };
            weeklyStats[c.uid].wins++;
            weeklyStats[c.uid].prize += c.prize || 0;
        });
    });

    return Object.entries(weeklyStats)
        .map(([uid, stats]) => ({
            uid,
            name: users[uid]?.name || users[uid]?.phone || 'Anonymous',
            gamesWon: stats.wins,
            totalPrize: stats.prize,
            winRate: 0
        }))
        .sort((a, b) => b.totalPrize - a.totalPrize)
        .slice(0, 20);
}

/**
 * Get leaderboard for a specific game (current game)
 */
export async function getGameLeaderboard(gameId) {
    const [usersSnap, claimsSnap] = await Promise.all([
        get(ref(db, 'users')),
        get(ref(db, `games/${gameId}/claims`))
    ]);
    const users = usersSnap.val() || {};
    const claims = claimsSnap.val() || {};

    const stats = {};
    Object.values(claims).forEach(c => {
        if (c.status !== 'approved' || !c.uid) return;
        stats[c.uid] = stats[c.uid] || { wins: 0, prize: 0, name: c.playerName };
        stats[c.uid].wins++;
        stats[c.uid].prize += c.prize || 0;
    });

    return Object.entries(stats)
        .map(([uid, s]) => ({
            uid, name: s.name || users[uid]?.name || 'Player',
            gamesWon: s.wins, totalPrize: s.prize, winRate: 0
        }))
        .sort((a, b) => b.totalPrize - a.totalPrize);
}

// ──────────────────────────────────────────────
// LIVE LISTENER
// ──────────────────────────────────────────────

export function listenToLeaderboard(callback) {
    // Re-compute on any user change
    onValue(ref(db, 'users'), async () => {
        const data = await getAllTimeLeaderboard();
        callback(data);
    });
}

// ──────────────────────────────────────────────
// UI RENDERER
// ──────────────────────────────────────────────

/**
 * Render leaderboard into a container element
 */
export function renderLeaderboard(container, entries, currentUid = null) {
    if (!container) return;
    if (!entries || entries.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
            <div style="font-size:3rem;margin-bottom:12px;">🏆</div>
            <div>No winners yet.<br>Be the first!</div>
        </div>`;
        return;
    }

    container.innerHTML = entries.map((p, i) => {
        const isMe = p.uid === currentUid;
        const medal = RANK_MEDALS[i] || `#${i + 1}`;
        const bg = isMe ? 'rgba(139,92,246,0.12)' : i === 0 ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)';
        const border = isMe ? 'rgba(139,92,246,0.4)' : i === 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)';
        const initials = (p.name || 'P').slice(0, 2).toUpperCase();

        return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:${bg};border:1px solid ${border};border-radius:12px;margin-bottom:6px;transition:all 0.2s;">
            <div style="font-size:1.3rem;width:28px;text-align:center;flex-shrink:0;">${medal}</div>
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--cyan));display:flex;align-items:center;justify-content:center;font-weight:900;font-size:0.78rem;flex-shrink:0;">${initials}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:800;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isMe ? p.name + ' (You)' : p.name}</div>
                <div style="font-size:0.7rem;color:var(--muted);">${p.gamesWon} win${p.gamesWon !== 1 ? 's' : ''} · ${p.winRate}% rate</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:1rem;font-weight:900;color:var(--gold);">₹${p.totalPrize.toLocaleString()}</div>
            </div>
        </div>`;
    }).join('');
}

// ──────────────────────────────────────────────
// UPDATE PLAYER STATS ON WIN
// ──────────────────────────────────────────────

/** Call after a claim is approved to increment player's cumulative stats */
export async function incrementPlayerStats(uid, prizeAmount) {
    const { runTransaction } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
    await runTransaction(ref(db, `users/${uid}/gamesWon`), (v) => (v || 0) + 1);
    await runTransaction(ref(db, `users/${uid}/totalPrize`), (v) => (v || 0) + prizeAmount);
}
