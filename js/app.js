/**
 * SIANG TAMBOLA - Main App Controller
 * Handles View logic, initializations, and global state
 */

const views = ['view-auth', 'view-lobby', 'view-game', 'view-wallet'];

const app = {
    state: {
        user: null, // null when not logged in
        role: 'guest', // guest | player | agent | admin
        wallet: 0
    },

    init() {
        console.log("🔥 SIANG TAMBOLA GOD LEVEL INITIALIZED!");
        this.bindEvents();
        // Custom request: Players bypass login completely
        this.loginDummy('guest');
    },

    bindEvents() {
        // Auth Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.target;

                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
                document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
            });
        });

        // Dummy Login
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.loginDummy('player');
        });

        // Dummy Join Room
        document.getElementById('btn-join-room').addEventListener('click', () => {
            this.showView('view-game');
        });
    },

    loginDummy(role) {
        this.state.user = { uid: '123', name: 'Elite Player' };
        this.state.role = role;
        this.state.wallet = 5000;

        document.getElementById('main-header').classList.remove('hidden');
        document.getElementById('user-wallet').innerHTML = `💎 ${this.state.wallet}`;

        this.showView('view-lobby');
    },

    showView(viewId) {
        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) {
                if (v === viewId) {
                    el.classList.remove('hidden');
                    // Trigger reflow for animations potentially
                    void el.offsetWidth;
                } else {
                    el.classList.add('hidden');
                }
            }
        });
        console.log(`Switched to view: ${viewId}`);
    }
};

// Expose app to window for inline onclick handlers (like back buttons)
window.app = app;

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
