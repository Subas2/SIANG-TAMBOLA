/**
 * SIANG TAMBOLA – Sound Engine (Phase 3)
 * Web Audio API tones + SpeechSynthesis voice announcer
 * No CDN or external files needed.
 */

const AudioContext = window.AudioContext || window.webkitAudioContext;
let ctx = null;

function getCtx() {
    if (!ctx) ctx = new AudioContext();
    return ctx;
}

// ──────────────────────────────────────────────
// Tone Generator
// ──────────────────────────────────────────────

function playTone(freq, type = 'sine', duration = 0.15, gain = 0.3) {
    try {
        const ac = getCtx();
        const osc = ac.createOscillator();
        const gainNode = ac.createGain();
        osc.connect(gainNode);
        gainNode.connect(ac.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ac.currentTime);
        gainNode.gain.setValueAtTime(gain, ac.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + duration);
    } catch (e) { /* audio blocked */ }
}

function playChord(freqs, duration = 0.25, gain = 0.2) {
    freqs.forEach(f => playTone(f, 'sine', duration, gain));
}

// ──────────────────────────────────────────────
// Sound Effects
// ──────────────────────────────────────────────

export const SFX = {
    /** Number drawn – short low-to-high sweep */
    numberDraw() {
        playTone(300, 'sine', 0.08, 0.2);
        setTimeout(() => playTone(500, 'sine', 0.12, 0.25), 80);
        setTimeout(() => playTone(700, 'sine', 0.18, 0.3), 180);
    },

    /** Player marks a cell on their ticket */
    ticketMark() {
        playTone(880, 'square', 0.06, 0.15);
        setTimeout(() => playTone(1100, 'square', 0.06, 0.1), 60);
    },

    /** Claim submitted */
    claimSubmit() {
        playChord([523, 659, 784], 0.3, 0.2);
    },

    /** Claim approved – WIN jingle */
    claimApproved() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.25, 0.35), i * 120));
    },

    /** Claim rejected */
    claimRejected() {
        playTone(200, 'sawtooth', 0.3, 0.4);
        setTimeout(() => playTone(150, 'sawtooth', 0.25, 0.3), 200);
    },

    /** Game starts */
    gameStart() {
        [262, 330, 392, 523].forEach((f, i) =>
            setTimeout(() => playTone(f, 'triangle', 0.3, 0.35), i * 150)
        );
    },

    /** Full house win – big fanfare */
    fullHouse() {
        const seq = [523, 659, 784, 1047, 784, 1047, 1319];
        seq.forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.3, 0.4), i * 100));
    },

    /** Error / invalid action */
    error() {
        playTone(220, 'sawtooth', 0.2, 0.4);
    }
};

// ──────────────────────────────────────────────
// Voice Number Announcer (SpeechSynthesis)
// ──────────────────────────────────────────────

const TAMBOLA_CALLS = {
    1: "Kelly's Eye – Number One",
    2: "One Little Duck – Two",
    3: "Cup of Tea – Three",
    4: "Knock at the Door – Four",
    5: "Man Alive – Five",
    6: "Half a Dozen – Six",
    7: "Lucky Seven",
    8: "One Fat Lady – Eight",
    9: "Doctor's Orders – Nine",
    10: "Prime Minister's Den – Ten",
    11: "Legs Eleven",
    13: "Unlucky for some – Thirteen",
    16: "Never been kissed – Sweet Sixteen",
    17: "Never been kissed – Seventeen",
    18: "Coming of age – Eighteen",
    21: "Key of the Door – Twenty One",
    22: "Two Little Ducks – Twenty Two",
    33: "Dirty Knees – Thirty Three",
    44: "Droopy Drawers – Forty Four",
    55: "Snakes Alive – Fifty Five",
    66: "Clickety Click – Sixty Six",
    69: "Either Way Up – Sixty Nine",
    77: "Sunset Strip – Double Seven",
    88: "Two Fat Ladies – Eighty Eight",
    90: "Top of the Shop – Ninety"
};

const numberWords = [
    '', 'One', 'Two', 'Three', 'Four', 'Five',
    'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
    'Twenty One', 'Twenty Two', 'Twenty Three', 'Twenty Four', 'Twenty Five',
    'Twenty Six', 'Twenty Seven', 'Twenty Eight', 'Twenty Nine', 'Thirty',
    'Thirty One', 'Thirty Two', 'Thirty Three', 'Thirty Four', 'Thirty Five',
    'Thirty Six', 'Thirty Seven', 'Thirty Eight', 'Thirty Nine', 'Forty',
    'Forty One', 'Forty Two', 'Forty Three', 'Forty Four', 'Forty Five',
    'Forty Six', 'Forty Seven', 'Forty Eight', 'Forty Nine', 'Fifty',
    'Fifty One', 'Fifty Two', 'Fifty Three', 'Fifty Four', 'Fifty Five',
    'Fifty Six', 'Fifty Seven', 'Fifty Eight', 'Fifty Nine', 'Sixty',
    'Sixty One', 'Sixty Two', 'Sixty Three', 'Sixty Four', 'Sixty Five',
    'Sixty Six', 'Sixty Seven', 'Sixty Eight', 'Sixty Nine', 'Seventy',
    'Seventy One', 'Seventy Two', 'Seventy Three', 'Seventy Four', 'Seventy Five',
    'Seventy Six', 'Seventy Seven', 'Seventy Eight', 'Seventy Nine', 'Eighty',
    'Eighty One', 'Eighty Two', 'Eighty Three', 'Eighty Four', 'Eighty Five',
    'Eighty Six', 'Eighty Seven', 'Eighty Eight', 'Eighty Nine', 'Ninety'
];

/**
 * Announce a drawn Tambola number using browser TTS
 * @param {number} num 
 * @param {string} lang - 'en-IN' or 'hi-IN' 
 */
export function announceNumber(num, lang = 'en-IN') {
    if (!window.speechSynthesis) return;
    const text = TAMBOLA_CALLS[num] || `Number ${numberWords[num] || num}`;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 0.88;
    utt.pitch = 1.1;
    utt.volume = 1;
    // Try to pick a natural-sounding voice
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith('en-IN') || v.lang.startsWith('en-GB'));
    if (preferred) utt.voice = preferred;
    window.speechSynthesis.cancel(); // Stop any in-progress
    window.speechSynthesis.speak(utt);
    SFX.numberDraw();
}

// Load voices on first call (async in Chrome)
if (window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = () => { speechSynthesis.getVoices(); };
}
