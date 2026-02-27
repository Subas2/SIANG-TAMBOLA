/**
 * SIANG TAMBOLA – Firebase Auth Module (Phase 3)
 * Handles Phone OTP (customer), Email/Password (admin & agent)
 */
import {
    getAuth, signInWithPhoneNumber, RecaptchaVerifier,
    signInWithEmailAndPassword, onAuthStateChanged, signOut,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4",
    authDomain: "siang-tambola.firebaseapp.com",
    databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com",
    projectId: "siang-tambola",
    storageBucket: "siang-tambola.firebasestorage.app",
    messagingSenderId: "228062529046",
    appId: "1:228062529046:web:caef7d77a7b0b2f4d65737"
};

let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
} catch (e) {
    // App already initialized
    app = initializeApp.app ? initializeApp.app() : null;
}

// ──────────────────────────────────────────────
// CUSTOMER: Phone OTP Authentication
// ──────────────────────────────────────────────

let confirmationResult = null;

/**
 * Set up invisible reCAPTCHA on a button element
 * @param {string} buttonId - ID of the send OTP button
 */
export function setupRecaptcha(buttonId) {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
            size: 'invisible',
            callback: () => { /* OTP sent */ }
        });
    }
}

/**
 * Send OTP to phone number
 * @param {string} phone - with country code e.g. +919876543210
 */
export async function sendOTP(phone) {
    try {
        confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
        return { success: true };
    } catch (err) {
        console.error('sendOTP error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Verify OTP code entered by user
 */
export async function verifyOTP(code) {
    try {
        if (!confirmationResult) throw new Error('No OTP request pending');
        const result = await confirmationResult.confirm(code);
        const user = result.user;
        // Save user profile to DB
        await set(ref(db, `users/${user.uid}`), {
            phone: user.phoneNumber,
            role: 'player',
            createdAt: Date.now(),
            wallet: 0
        });
        return { success: true, user };
    } catch (err) {
        console.error('verifyOTP error:', err);
        return { success: false, error: err.message };
    }
}

// ──────────────────────────────────────────────
// ADMIN: Email/Password + UID Whitelist
// ──────────────────────────────────────────────

// Hardcoded admin UIDs (replace with yours after first Firebase login)
const ADMIN_UIDS = ['REPLACE_WITH_YOUR_ADMIN_UID'];

export async function adminLogin(email, password) {
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;
        // Check admin role in DB (more flexible than hardcoded UIDs)
        const snap = await get(ref(db, `admins/${uid}`));
        if (!snap.exists() && !ADMIN_UIDS.includes(uid)) {
            await signOut(auth);
            return { success: false, error: 'Access denied. Not an admin account.' };
        }
        return { success: true, user: cred.user };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ──────────────────────────────────────────────
// AGENT: Email/Password + Role Check from DB
// ──────────────────────────────────────────────

export async function agentLogin(email, password) {
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;
        const snap = await get(ref(db, `users/${uid}/role`));
        if (!snap.exists() || snap.val() !== 'agent') {
            await signOut(auth);
            return { success: false, error: 'Access denied. Not an agent account.' };
        }
        return { success: true, user: cred.user };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ──────────────────────────────────────────────
// SHARED: Auth State Listener
// ──────────────────────────────────────────────

/**
 * Listen to auth state changes
 * @param {Function} callback - called with (user | null)
 */
export function onAuth(callback) {
    if (auth) onAuthStateChanged(auth, callback);
}

/**
 * Register a new agent account (admin use only)
 */
export async function registerAgent(email, password, name, commissionRate = 8) {
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await set(ref(db, `users/${cred.user.uid}`), {
            name, email,
            role: 'agent',
            commissionRate,
            createdAt: Date.now(),
            earnings: 0
        });
        return { success: true, uid: cred.user.uid };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

export async function logout() {
    if (auth) await signOut(auth);
    location.reload();
}

export { auth, db };
