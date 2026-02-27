/**
 * SIANG TAMBOLA - core Firebase Configuration
 * To be replaced with actual Firebase project config
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4",
    authDomain: "siang-tambola.firebaseapp.com",
    databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com",
    projectId: "siang-tambola",
    storageBucket: "siang-tambola.firebasestorage.app",
    messagingSenderId: "228062529046",
    appId: "1:228062529046:web:caef7d77a7b0b2f4d65737",
    measurementId: "G-7MC2PZTYGT"
};

// Initialize Firebase
let app, db, auth;

try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    console.log("🔥 Firebase Live Connection Established");
} catch (e) {
    console.error("Firebase init error:", e);
}

export { db, auth, ref, set, onValue, update };
