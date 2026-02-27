/**
 * SIANG TAMBOLA – Payment Module (Phase 4)
 * Razorpay UPI/Card checkout + wallet top-up via Firebase
 */

const RAZORPAY_KEY = 'rzp_test_REPLACE_WITH_YOUR_KEY'; // Replace with live key for production

/**
 * Load Razorpay SDK dynamically
 */
function loadRazorpaySDK() {
    return new Promise((resolve, reject) => {
        if (window.Razorpay) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
        document.head.appendChild(script);
    });
}

/**
 * Open Razorpay checkout for wallet top-up
 * @param {object} opts
 * @param {string} opts.uid - Firebase user UID
 * @param {string} opts.name - Player name
 * @param {string} opts.phone - Player phone number
 * @param {number} opts.amount - Amount in INR (e.g. 100 = ₹100)
 * @param {Function} opts.onSuccess - called with { paymentId, amount }
 * @param {Function} opts.onFailure - called with error message
 */
export async function openWalletTopUp({ uid, name, phone, amount, onSuccess, onFailure }) {
    try {
        await loadRazorpaySDK();

        const options = {
            key: RAZORPAY_KEY,
            amount: amount * 100, // Razorpay expects paise
            currency: 'INR',
            name: 'Siang Tambola',
            description: `Wallet Top-Up – ₹${amount}`,
            image: 'https://subas2.github.io/SIANG-TAMBOLA/icons/icon-192.png',
            prefill: {
                name: name || 'Player',
                contact: phone || ''
            },
            theme: { color: '#7c3aed' },
            modal: { backdropclose: false },
            handler: async function (response) {
                // Verify payment + credit wallet via Cloud Function
                await creditWalletAfterPayment(uid, amount, response.razorpay_payment_id);
                if (onSuccess) onSuccess({ paymentId: response.razorpay_payment_id, amount });
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
            if (onFailure) onFailure(response.error.description);
        });
        rzp.open();
    } catch (err) {
        if (onFailure) onFailure(err.message);
    }
}

/**
 * Credit wallet in Firebase after successful payment.
 * In production this should be done ONLY via Cloud Function
 * to prevent tampering. This client-side version is for dev/testing.
 */
async function creditWalletAfterPayment(uid, amount, paymentId) {
    try {
        const { getDatabase, ref, runTransaction, push, serverTimestamp } =
            await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");

        const FB = { apiKey: "AIzaSyCpikeD9xU8yugpeA67rL66awScd455uV4", authDomain: "siang-tambola.firebaseapp.com", databaseURL: "https://siang-tambola-default-rtdb.firebaseio.com", projectId: "siang-tambola", appId: "1:228062529046:web:caef7d77a7b0b2f4d65737" };
        let db;
        try { const app = initializeApp(FB, 'pay'); db = getDatabase(app); } catch (e) { db = getDatabase(); }

        // Atomic wallet increment
        await runTransaction(ref(db, `users/${uid}/wallet`), (current) => (current || 0) + amount);

        // Save transaction record
        await push(ref(db, `users/${uid}/transactions`), {
            type: 'topup',
            amount,
            paymentId,
            timestamp: serverTimestamp(),
            status: 'success'
        });
    } catch (err) {
        console.error('Wallet credit error:', err);
    }
}

/**
 * Deduct from wallet (for ticket purchase)
 * Returns { success, newBalance }
 */
export async function deductWallet(uid, amount) {
    try {
        const { getDatabase, ref, runTransaction, push, serverTimestamp } =
            await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
        const db = getDatabase();

        let newBalance = 0;
        await runTransaction(ref(db, `users/${uid}/wallet`), (current) => {
            if ((current || 0) < amount) return; // abort — insufficient
            newBalance = current - amount;
            return newBalance;
        });

        if (newBalance === 0 && amount > 0) return { success: false, error: 'Insufficient balance' };

        await push(ref(db, `users/${uid}/transactions`), {
            type: 'debit', amount, timestamp: serverTimestamp(), status: 'success'
        });

        return { success: true, newBalance };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(uid) {
    const { getDatabase, ref, get } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
    const snap = await get(ref(getDatabase(), `users/${uid}/wallet`));
    return snap.val() || 0;
}

/**
 * Get last N transactions
 */
export async function getTransactions(uid, limit = 10) {
    const { getDatabase, ref, query, orderByChild, limitToLast, get } =
        await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
    const snap = await get(query(ref(getDatabase(), `users/${uid}/transactions`), orderByChild('timestamp'), limitToLast(limit)));
    const data = snap.val() || {};
    return Object.values(data).reverse();
}
