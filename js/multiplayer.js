/**
 * SIANG TAMBOLA - Multiplayer & Sync System
 * Handles interactions with Firebase Realtime Database
 */

class MultiplayerSystem {
    constructor() {
        this.roomId = null;
        this.playerId = null;
    }

    joinRoom(roomId) {
        console.log(`[Sync] Joining Room ${roomId}...`);
        this.roomId = roomId;
        // In real app: Attach Firebase listener on `rooms/${roomId}/state`
    }

    handleNumberCalled(number) {
        console.log(`[Sync] Number received from server: ${number}`);
        window.gameEngine.updateBoardUI(number);
    }

    claimPattern(patternType) {
        console.log(`[Sync] Attempting to claim ${patternType}...`);
        // Real app: push claim Request to `rooms/${roomId}/claims`
        // Server rules/cloud function validates the ticket hash and board called #s
        alert(`Claim request for ${patternType} sent to server for God Mode Verification!`);
    }
}

window.syncSystem = new MultiplayerSystem();

document.addEventListener('DOMContentLoaded', () => {
    // Bind Claim Buttons
    document.querySelectorAll('.btn-claim').forEach(btn => {
        btn.addEventListener('click', (e) => {
            let pattern = e.target.innerText.split('\n')[0];
            window.syncSystem.claimPattern(pattern);
        });
    });
});
