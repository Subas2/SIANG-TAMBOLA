/**
 * SIANG TAMBOLA – Firebase Cloud Functions (Phase 4)
 * Payment verification + wallet crediting (server-side)
 *
 * SETUP:
 *   npm install -g firebase-tools
 *   firebase login
 *   firebase init functions (select existing project: siang-tambola)
 *   npm install razorpay
 *   firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Razorpay = require('razorpay');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.database();

const razorpay = new Razorpay({
    key_id: 'rzp_live_REPLACE_WITH_KEY_ID',
    key_secret: 'REPLACE_WITH_KEY_SECRET'
});

// ──────────────────────────────────────────────
// CREATE Razorpay ORDER (called when player taps "Add Money")
// ──────────────────────────────────────────────

exports.createOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

    const { amount } = data; // INR
    if (!amount || amount < 10 || amount > 10000) {
        throw new functions.https.HttpsError('invalid-argument', 'Amount must be ₹10–₹10,000');
    }

    const order = await razorpay.orders.create({
        amount: amount * 100, // paise
        currency: 'INR',
        receipt: `rcpt_${context.auth.uid}_${Date.now()}`
    });

    return { orderId: order.id, amount, currency: 'INR' };
});

// ──────────────────────────────────────────────
// VERIFY PAYMENT + CREDIT WALLET
// ──────────────────────────────────────────────

exports.verifyPayment = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

    const { orderId, paymentId, signature, amount } = data;

    // Verify Razorpay signature
    const generated = crypto
        .createHmac('sha256', 'REPLACE_WITH_KEY_SECRET')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

    if (generated !== signature) {
        throw new functions.https.HttpsError('permission-denied', 'Invalid payment signature');
    }

    const uid = context.auth.uid;

    // Prevent double-credit: check if payment already processed
    const txRef = db.ref(`users/${uid}/transactions/${paymentId}`);
    const existing = await txRef.get();
    if (existing.exists()) {
        throw new functions.https.HttpsError('already-exists', 'Payment already processed');
    }

    // Atomic wallet increment
    await db.ref(`users/${uid}/wallet`).transaction((current) => (current || 0) + amount);

    // Log transaction
    await txRef.set({
        type: 'topup',
        amount,
        orderId,
        paymentId,
        timestamp: admin.database.ServerValue.TIMESTAMP,
        status: 'success'
    });

    return { success: true, newBalance: (await db.ref(`users/${uid}/wallet`).get()).val() };
});

// ──────────────────────────────────────────────
// SEND PUSH NOTIFICATION TO ALL PLAYERS
// ──────────────────────────────────────────────

exports.broadcastPush = functions.database.ref('broadcasts/{id}')
    .onCreate(async (snap) => {
        const broadcast = snap.val();
        if (!broadcast?.message) return;

        // Get all FCM tokens from users
        const usersSnap = await db.ref('users').get();
        const users = usersSnap.val() || {};
        const tokens = Object.values(users).map(u => u.fcmToken).filter(Boolean);

        if (tokens.length === 0) return;

        const message = {
            notification: {
                title: 'Siang Tambola 🎰',
                body: broadcast.message
            },
            data: { type: broadcast.type || 'info' },
            tokens
        };

        try {
            const result = await admin.messaging().sendMulticast(message);
            console.log(`Push sent: ${result.successCount}/${tokens.length} delivered`);
        } catch (err) {
            console.error('Push error:', err);
        }
    });

// ──────────────────────────────────────────────
// PHASE 5: AGENT COMMISSION AUTO-PAY + PLAYER STATS
// Triggered when admin sets claim status = 'approved'
// ──────────────────────────────────────────────

exports.onClaimApproved = functions.database
    .ref('games/{gameId}/claims/{claimId}/status')
    .onWrite(async (change, context) => {
        // Only trigger on transition to 'approved'
        if (change.after.val() !== 'approved' || change.before.val() === 'approved') return;

        const { gameId, claimId } = context.params;
        const claimSnap = await db.ref(`games/${gameId}/claims/${claimId}`).get();
        const claim = claimSnap.val();
        if (!claim || !claim.uid) return;

        const prize = claim.prize || 0;
        const winnerUid = claim.uid;

        // 1. Update winner's cumulative stats (atomic)
        await db.ref(`users/${winnerUid}/gamesWon`).transaction(v => (v || 0) + 1);
        await db.ref(`users/${winnerUid}/totalPrize`).transaction(v => (v || 0) + prize);
        await db.ref(`users/${winnerUid}/gamesPlayed`).transaction(v => (v || 0) + 1);

        // 2. Find referring agent
        const winnerSnap = await db.ref(`users/${winnerUid}`).get();
        const winner = winnerSnap.val() || {};
        const agentUid = winner.referredBy;

        if (!agentUid) return; // No referrer — done

        // 3. Get agent's commission rate
        const agentSnap = await db.ref(`users/${agentUid}`).get();
        const agent = agentSnap.val() || {};
        const commissionRate = agent.commissionRate || 8; // default 8%
        const commission = Math.floor(prize * (commissionRate / 100));

        if (commission <= 0) return;

        // 4. Credit agent earnings (atomic)
        await db.ref(`users/${agentUid}/earnings`).transaction(v => (v || 0) + commission);

        // 5. Log commission transaction
        await db.ref(`users/${agentUid}/commissions`).push({
            type: 'commission',
            fromUid: winnerUid,
            fromName: winner.name || winner.phone || 'Player',
            gameId,
            claimId,
            prizeAmount: prize,
            commissionRate,
            commission,
            timestamp: admin.database.ServerValue.TIMESTAMP
        });

        console.log(`Commission: ₹${commission} credited to agent ${agentUid} (${commissionRate}% of ₹${prize})`);

        // 6. Send push notification to winner
        const fcmToken = winner.fcmToken;
        if (fcmToken) {
            try {
                await admin.messaging().send({
                    token: fcmToken,
                    notification: {
                        title: '🏆 You Won!',
                        body: `Congratulations! ₹${prize} has been credited to your wallet!`
                    }
                });
            } catch (e) { /* FCM token may be expired */ }
        }
    });
