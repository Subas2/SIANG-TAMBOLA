/**
 * SIANG TAMBOLA – Analytics Module (Phase 4)
 * Aggregates game history + stats from Firebase Realtime DB
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, query, orderByChild, limitToLast, onValue }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const FB = { apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4", authDomain: "siang-tambola.firebaseapp.com", databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com", projectId: "siang-tambola", appId: "1:228062529046:web:caef7d77a7b0b2f4d65737" };
let db;
try { const app = initializeApp(FB, 'analytics'); db = getDatabase(app); } catch (e) { db = getDatabase(); }

// ──────────────────────────────────────────────
// ADMIN ANALYTICS
// ──────────────────────────────────────────────

/**
 * Get platform-wide stats
 * @returns {Promise<{ totalGames, totalRevenue, totalPlayers, totalPrizes, recentGames[] }>}
 */
export async function getAdminStats() {
    const [gamesSnap, usersSnap] = await Promise.all([
        get(ref(db, 'games')),
        get(ref(db, 'users'))
    ]);

    const games = gamesSnap.val() || {};
    const users = usersSnap.val() || {};

    const gameList = Object.entries(games).map(([id, g]) => ({ id, ...g }));
    const totalGames = gameList.length;

    let totalRevenue = 0, totalPrizes = 0;
    gameList.forEach(g => {
        const players = Object.keys(g.players || {}).length;
        totalRevenue += (g.ticketPrice || 0) * players;
        // Sum approved prizes from claims
        Object.values(g.claims || {}).forEach(claim => {
            if (claim.status === 'approved') totalPrizes += (claim.prize || 0);
        });
    });

    const totalPlayers = Object.values(users).filter(u => u.role === 'player').length;
    const totalAgents = Object.values(users).filter(u => u.role === 'agent').length;

    // Revenue by day (last 7 days)
    const byDay = {};
    gameList.forEach(g => {
        if (!g.createdAt) return;
        const day = new Date(g.createdAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
        const players = Object.keys(g.players || {}).length;
        byDay[day] = (byDay[day] || 0) + (g.ticketPrice || 0) * players;
    });

    const recentGames = gameList
        .filter(g => g.createdAt)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10)
        .map(g => ({
            id: g.id,
            name: g.name || 'Tambola Room',
            players: Object.keys(g.players || {}).length,
            totalCalled: g.totalCalled || 0,
            ticketPrice: g.ticketPrice || 0,
            revenue: (g.ticketPrice || 0) * Object.keys(g.players || {}).length,
            claims: Object.values(g.claims || {}).length,
            date: g.createdAt ? new Date(g.createdAt).toLocaleDateString('en-IN') : '—'
        }));

    // Top agents by player count
    const agentStats = Object.entries(users)
        .filter(([_, u]) => u.role === 'agent')
        .map(([uid, u]) => {
            const referred = Object.values(users).filter(p => p.referredBy === uid).length;
            return { name: u.name || 'Agent', referred, earnings: u.earnings || 0 };
        })
        .sort((a, b) => b.referred - a.referred)
        .slice(0, 5);

    return { totalGames, totalRevenue, totalPrizes, totalPlayers, totalAgents, byDay, recentGames, agentStats };
}

// ──────────────────────────────────────────────
// PLAYER STATS
// ──────────────────────────────────────────────

/**
 * Get stats for a specific player
 */
export async function getPlayerStats(uid) {
    const [gamesSnap, userSnap] = await Promise.all([
        get(ref(db, 'games')),
        get(ref(db, `users/${uid}`))
    ]);

    const games = gamesSnap.val() || {};
    const user = userSnap.val() || {};

    let gamesPlayed = 0, gamesWon = 0, totalPrize = 0;
    Object.values(games).forEach(g => {
        if (g.players && g.players[uid]) {
            gamesPlayed++;
            // Any approved claim by this uid
            Object.values(g.claims || {}).forEach(c => {
                if (c.uid === uid && c.status === 'approved') {
                    gamesWon++;
                    totalPrize += (c.prize || 0);
                }
            });
        }
    });

    return {
        gamesPlayed,
        gamesWon,
        totalPrize,
        walletBalance: user.wallet || 0,
        winRate: gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0
    };
}

// ──────────────────────────────────────────────
// LIVE STATS LISTENER (for admin dashboard real-time updates)
// ──────────────────────────────────────────────

export function listenToLiveStats(callback) {
    onValue(ref(db, 'games'), async () => {
        const stats = await getAdminStats();
        callback(stats);
    });
}

// ──────────────────────────────────────────────
// RENDER HELPERS
// ──────────────────────────────────────────────

/**
 * Render a mini bar chart using HTML/CSS (no Chart.js dependency)
 * @param {HTMLElement} container
 * @param {Object} data - { label: value }
 * @param {string} color - CSS color
 */
export function renderBarChart(container, data, color = 'var(--accent)') {
    if (!container || !data) return;
    const entries = Object.entries(data);
    if (entries.length === 0) { container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;">No data yet</div>'; return; }

    const max = Math.max(...entries.map(([, v]) => v), 1);
    container.innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:6px;height:80px;padding:0 4px;">
            ${entries.map(([label, val]) => `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                    <div style="width:100%;background:${color};border-radius:4px 4px 0 0;height:${Math.max(4, Math.round((val / max) * 72))}px;opacity:0.85;transition:height 0.4s;"></div>
                    <div style="font-size:0.6rem;color:var(--muted);text-align:center;white-space:nowrap;">${label}</div>
                </div>
            `).join('')}
        </div>
    `;
}
