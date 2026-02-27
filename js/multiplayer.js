/**
 * SIANG TAMBOLA – Multiplayer Sync Module v3.0 (Phase 3)
 * Firebase Realtime Database sync for:
 *  - Game state (called numbers, current number, game active)
 *  - Claims (player claim submissions)
 *  - Player presence
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, serverTimestamp, remove }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { SFX } from './sounds.js';

const firebaseConfig = {
    apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4",
    authDomain: "siang-tambola.firebaseapp.com",
    databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com",
    projectId: "siang-tambola",
    storageBucket: "siang-tambola.firebasestorage.app",
    messagingSenderId: "228062529046",
    appId: "1:228062529046:web:caef7d77a7b0b2f4d65737"
};

let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
} catch (e) { console.warn('Firebase already initialized'); }

// Active game ID (set by admin when creating a game)
let ACTIVE_GAME_ID = 'game_default';

// ──────────────────────────────────────────────
// ADMIN: Write game state to Firebase
// ──────────────────────────────────────────────

/**
 * Create a new game session in Firebase
 */
export async function createGame(gameId, config = {}) {
    ACTIVE_GAME_ID = gameId;
    await set(ref(db, `games/${gameId}`), {
        active: true,
        name: config.name || 'Tambola Room',
        ticketPrice: config.ticketPrice || 100,
        drawSpeed: config.drawSpeed || 10,
        patterns: config.patterns || ['early5', 'topRow', 'midRow', 'botRow', 'fullHouse'],
        calledNumbers: [],
        currentNumber: null,
        createdAt: serverTimestamp(),
        totalCalled: 0,
        wonPatterns: {}
    });
    console.log(`🎮 Game ${gameId} created`);
}

/**
 * Admin draws a number and pushes to Firebase
 * @param {number} number - the drawn number
 */
export async function adminDrawNumber(number) {
    const gameRef = ref(db, `games/${ACTIVE_GAME_ID}`);
    const snap = await get(gameRef);
    const game = snap.val();
    const existing = game?.calledNumbers || [];
    if (existing.includes(number)) return; // Already called

    await update(gameRef, {
        currentNumber: number,
        calledNumbers: [...existing, number],
        totalCalled: (game?.totalCalled || 0) + 1,
        lastUpdated: serverTimestamp()
    });
}

/**
 * Admin resets the game
 */
export async function adminResetGame() {
    await update(ref(db, `games/${ACTIVE_GAME_ID}`), {
        calledNumbers: [],
        currentNumber: null,
        totalCalled: 0,
        wonPatterns: {},
        lastUpdated: serverTimestamp()
    });
    // Clear all claims
    await remove(ref(db, `games/${ACTIVE_GAME_ID}/claims`));
}

/**
 * Admin approves or rejects a claim
 */
export async function adminResolveClaim(claimId, decision, prize = 0) {
    await update(ref(db, `games/${ACTIVE_GAME_ID}/claims/${claimId}`), {
        status: decision, // 'approved' | 'rejected'
        prize,
        resolvedAt: serverTimestamp()
    });
    if (decision === 'approved' && prize > 0) {
        // Give prize to player's wallet
        const claimSnap = await get(ref(db, `games/${ACTIVE_GAME_ID}/claims/${claimId}`));
        const claim = claimSnap.val();
        if (claim?.uid) {
            const walletRef = ref(db, `users/${claim.uid}/wallet`);
            const wSnap = await get(walletRef);
            await set(walletRef, (wSnap.val() || 0) + prize);
        }
    }
}

// ──────────────────────────────────────────────
// PLAYER: Listen to game state + submit claims
// ──────────────────────────────────────────────

/**
 * Listen to the live game — number calls, current number
 * @param {Function} onNumberCalled - called with (number, allCalledNumbers[])
 * @param {Function} onGameReset - called when game is reset
 */
export function listenToGame(onNumberCalled, onGameReset) {
    const gameRef = ref(db, `games/${ACTIVE_GAME_ID}`);
    let prevCalledCount = 0;

    onValue(gameRef, (snap) => {
        const game = snap.val();
        if (!game) return;

        const called = game.calledNumbers || [];
        const current = game.currentNumber;

        // Detect reset
        if (called.length < prevCalledCount) {
            prevCalledCount = 0;
            if (onGameReset) onGameReset();
            return;
        }

        // New number drawn
        if (called.length > prevCalledCount && current) {
            prevCalledCount = called.length;
            if (onNumberCalled) onNumberCalled(current, called);
        }
    });
}

/**
 * Listen to claims for admin panel
 * @param {Function} callback - called with claims array
 */
export function listenToClaims(callback) {
    const claimsRef = ref(db, `games/${ACTIVE_GAME_ID}/claims`);
    onValue(claimsRef, (snap) => {
        const data = snap.val() || {};
        const claims = Object.entries(data).map(([id, claim]) => ({ id, ...claim }));
        callback(claims.reverse()); // newest first
    });
}

/**
 * Player submits a claim
 * @param {string} uid - player UID
 * @param {string} playerName 
 * @param {string} pattern - e.g. 'topRow'
 * @param {number[]} matchedNumbers 
 * @param {string} ticketId 
 */
export async function submitClaim(uid, playerName, pattern, matchedNumbers, ticketId) {
    const claimsRef = ref(db, `games/${ACTIVE_GAME_ID}/claims`);
    const claimData = {
        uid,
        playerName,
        pattern,
        matchedNumbers,
        ticketId,
        status: 'pending',
        timestamp: serverTimestamp()
    };
    await push(claimsRef, claimData);
    SFX.claimSubmit();
}

// ──────────────────────────────────────────────
// PLAYER PRESENCE
// ──────────────────────────────────────────────

export function registerPresence(uid, name, gameId = ACTIVE_GAME_ID) {
    const presenceRef = ref(db, `games/${gameId}/players/${uid}`);
    set(presenceRef, { name, online: true, joinedAt: serverTimestamp() });
    // Remove on disconnect
    // onDisconnect(presenceRef).remove();
}

// ──────────────────────────────────────────────
// SET ACTIVE GAME
// ──────────────────────────────────────────────
export function setActiveGame(gameId) {
    ACTIVE_GAME_ID = gameId;
}

export { db, auth };
