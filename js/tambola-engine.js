/**
 * SIANG TAMBOLA - Smart Game Engine
 * Handles Board Generation, Ticket Algorithm, and Call Logic
 */

class TambolaEngine {
    constructor() {
        this.board = Array.from({ length: 90 }, (_, i) => i + 1);
        this.calledNumbers = new Set();
        this.lastCalled = null;
    }

    initBoardUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        this.board.forEach(num => {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.id = `cell-${num}`;
            cell.textContent = num;
            container.appendChild(cell);
        });
    }

    // Call a random uncalled number
    drawNumber() {
        const available = this.board.filter(n => !this.calledNumbers.has(n));
        if (available.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * available.length);
        const number = available[randomIndex];

        this.calledNumbers.add(number);
        this.lastCalled = number;
        this.updateBoardUI(number);
        return number;
    }

    updateBoardUI(number) {
        const cell = document.getElementById(`cell-${number}`);
        if (cell) {
            cell.classList.add('called', 'glow-text');
        }
    }

    // Mathematical generation of a valid 9x3 Tambola Ticket
    generateTicket() {
        // Standard Tambola rules:
        // 3 rows, 9 columns. Each row has exactly 5 numbers. 
        // Total 15 numbers. Columns are sorted.
        // Col 1 (0): 1-9
        // Col 2 (1): 10-19... Col 9 (8): 80-90

        const ticket = Array(3).fill(null).map(() => Array(9).fill(0));
        const columnsData = Array(9).fill(null).map(() => []);

        // This is a simplified random generator for UI demo purposes, 
        // a rigorous 100% compliant algorithm is needed for production.
        for (let col = 0; col < 9; col++) {
            let count = (col === 0) ? 9 : (col === 8) ? 11 : 10;
            let start = (col === 0) ? 1 : col * 10;
            let pool = Array.from({ length: count }, (_, i) => start + i);

            // Pick 1-2 random values per col to distribute 15 items
            // Just for visual scaffolding right now
            let picks = Math.floor(Math.random() * 2) + 1;
            for (let i = 0; i < picks; i++) {
                let rIdx = Math.floor(Math.random() * pool.length);
                columnsData[col].push(pool.splice(rIdx, 1)[0]);
            }
        }

        // Ensure 15 numbers total - demo logic
        // Flat array of numbers mapped to their column bounds
        let flatNums = columnsData.flat();

        // Build the physical UI element
        return this._buildTicketUI(columnsData);
    }

    _buildTicketUI(dummyCols) {
        const ticketDiv = document.createElement('div');
        ticketDiv.className = 'tambola-ticket glass-panel';

        // Create 3x9 grid
        for (let r = 0; r < 3; r++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'ticket-row';
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.className = 'ticket-cell';
                // Fake logic for demo: randomly empty or number
                let isNum = Math.random() > 0.5;
                if (isNum) {
                    let val = (c === 0 ? 1 : c * 10) + Math.floor(Math.random() * 9);
                    cell.textContent = val;
                }

                cell.addEventListener('click', () => {
                    if (cell.textContent && cell.textContent !== "") {
                        cell.classList.toggle('marked');
                        // Sound effect here
                    }
                });

                rowDiv.appendChild(cell);
            }
            ticketDiv.appendChild(rowDiv);
        }

        return ticketDiv;
    }
}

// Expose instance
window.gameEngine = new TambolaEngine();

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => {
    window.gameEngine.initBoardUI('tambola-board');

    // Generate one ticket for player
    const ticketsArea = document.getElementById('my-tickets');
    if (ticketsArea) {
        ticketsArea.appendChild(window.gameEngine.generateTicket());
    }
});
