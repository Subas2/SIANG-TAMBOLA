/**
 * SIANG TAMBOLA - Multiplayer & Sync System
 * Handles interactions with Firebase Realtime Database
 */

import { db, ref, onValue, update, set } from './firebase-config.js';

class MultiplayerSystem {
    constructor() {
        this.roomId = "global-room-1"; // Default room for Phase 3
        this.playerId = "player-" + Math.floor(Math.random() * 10000); // Temporary guest ID
        this.roomRef = null;
    }

    joinRoom(roomId) {
        console.log(`[Sync] Joining Room ${roomId}...`);
        this.roomId = roomId;
        this.roomRef = ref(db, `rooms/${this.roomId}`);

        // Listen for live number calls
        const latestNumberRef = ref(db, `rooms/${this.roomId}/currentNumber`);
        onValue(latestNumberRef, (snapshot) => {
            const num = snapshot.val();
            if (num) {
                this.handleNumberCalled(num);
            }
        });

        // Listen for full reset/state
        onValue(ref(db, `rooms/${this.roomId}/state`), (snapshot) => {
            const state = snapshot.val();
            if (state === 'reset') {
                console.log("Room reset triggered!");
                // Clear UI board in real app
            }
        });
    }

    handleNumberCalled(number) {
        console.log(`[Sync] Number received from server: ${number}`);
        if (window.gameEngine) {
            window.gameEngine.updateBoardUI(number);
        }
    }

    claimPattern(patternType) {
        console.log(`[Sync] Attempting to claim ${patternType}...`);

        // Write claim to database
        const claimRef = ref(db, `rooms/${this.roomId}/claims/${this.playerId}_${Date.now()}`);
        set(claimRef, {
            player: this.playerId,
            pattern: patternType,
            timestamp: Date.now(),
            status: "pending"
        });

        alert(`Claim request for ${patternType} sent to server for verification!`);
    }
}

window.syncSystem = new MultiplayerSystem();

document.addEventListener('DOMContentLoaded', () => {
    // Auto-join the global room for now
    setTimeout(() => {
        window.syncSystem.joinRoom(window.syncSystem.roomId);
    }, 1000);

    // Bind Claim Buttons
    document.querySelectorAll('.btn-claim').forEach(btn => {
        btn.addEventListener('click', (e) => {
            let pattern = e.target.innerText.split('\n')[0].trim();
            window.syncSystem.claimPattern(pattern);
        });
    });
});
