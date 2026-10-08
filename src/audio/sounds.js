/*
 * Game audio through the Web Audio API.
 * Card sounds are recorded samples (Kenney "Casino Audio", CC0, in public/sounds).
 * Musical cues (your turn, win, lose, timer tick…) are synthesized, so they need no files.
 * Browsers only allow audio after a user gesture, so call unlockAudio() from one.
 */

const BASE = `${import.meta.env.BASE_URL}sounds/`;
const MUTE_KEY = 'rummy-royale:muted';

const SAMPLES = {
    shuffle: ['card-shuffle'],
    packOpen: ['cards-pack-open-1'],
    deal: ['card-slide-1', 'card-slide-2', 'card-slide-3', 'card-slide-4', 'card-slide-5', 'card-slide-6'],
    draw: ['card-slide-1', 'card-slide-3', 'card-slide-5'],
    discard: ['card-place-1', 'card-place-2', 'card-place-3', 'card-place-4'],
    select: ['card-shove-1', 'card-shove-2'],
    fan: ['card-fan-1', 'card-fan-2'],
    chips: ['chips-stack-1', 'chips-stack-2', 'chips-stack-3'],
    chipsHandle: ['chips-handle-1'],
};

const SAMPLE_VOLUME = {
    shuffle: 0.7,
    packOpen: 0.7,
    deal: 0.45,
    draw: 0.65,
    discard: 0.85,
    select: 0.3,
    fan: 0.6,
    chips: 0.7,
    chipsHandle: 0.6,
};

let ctx = null;
let master = null;
const buffers = new Map();
let muted = readMuted();
const listeners = new Set();

function readMuted() {
    try {
        return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
        return false;
    }
}

function ensureContext() {
    if (ctx) return ctx;
    const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextClass) return null;
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    Object.values(SAMPLES).flat().forEach(loadSample);
    return ctx;
}

function loadSample(file) {
    if (!buffers.has(file)) {
        const promise = fetch(`${BASE}${file}.mp3`)
            .then((res) => res.arrayBuffer())
            .then((data) => ctx.decodeAudioData(data))
            .catch(() => null);
        buffers.set(file, promise);
    }
    return buffers.get(file);
}

export function unlockAudio() {
    const c = ensureContext();
    if (c && c.state === 'suspended') c.resume();
}

export const isMuted = () => muted;

export function setMuted(value) {
    muted = value;
    try {
        localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
        // Storage can be unavailable (private mode); muting still works for this visit.
    }
    listeners.forEach((fn) => fn(muted));
}

export function onMuteChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// --- Synthesized cues ---

function tone(c, start, { freq, to, type = 'sine', duration = 0.4, gain = 0.2, attack = 0.01 }) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
}

// A soft bell: fundamental plus a quieter octave and fifth above.
function bell(c, start, freq, gain = 0.16, duration = 0.9) {
    tone(c, start, { freq, duration, gain });
    tone(c, start, { freq: freq * 2, duration: duration * 0.6, gain: gain * 0.35 });
    tone(c, start, { freq: freq * 3, duration: duration * 0.35, gain: gain * 0.12 });
}

const SYNTHS = {
    turn(c, t, v) {
        bell(c, t, 659.25, 0.13 * v, 0.6);
        bell(c, t + 0.13, 987.77, 0.11 * v, 0.8);
    },
    tick(c, t, v) {
        tone(c, t, { freq: 1500, type: 'triangle', duration: 0.06, gain: 0.07 * v, attack: 0.002 });
    },
    invalid(c, t, v) {
        tone(c, t, { freq: 233, to: 196, type: 'triangle', duration: 0.18, gain: 0.16 * v });
        tone(c, t + 0.13, { freq: 196, to: 165, type: 'triangle', duration: 0.24, gain: 0.16 * v });
    },
    hint(c, t, v) {
        [1318.5, 1567.98, 2093].forEach((f, i) => tone(c, t + i * 0.07, { freq: f, duration: 0.35, gain: 0.06 * v }));
    },
    group(c, t, v) {
        tone(c, t, { freq: 880, to: 1320, duration: 0.15, gain: 0.05 * v });
    },
    win(c, t, v) {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(c, t + i * 0.12, f, 0.14 * v, 1.0));
        [523.25, 659.25, 783.99].forEach((f) => bell(c, t + 0.6, f * 2, 0.06 * v, 1.6));
    },
    lose(c, t, v) {
        [392, 311.13, 261.63].forEach((f, i) =>
            tone(c, t + i * 0.2, { freq: f, type: 'triangle', duration: 0.55, gain: 0.13 * v, attack: 0.02 }),
        );
    },
};

/**
 * play('discard'), play('deal', { delay: 0.3 }), play('shuffle', { duration: 1.2 }).
 * `duration` fades a long sample out early.
 */
export function play(name, { volume = 1, delay = 0, duration } = {}) {
    if (muted) return;
    const c = ensureContext();
    if (!c) return;
    // Sounds scheduled while the context is resuming simply start once it is running.
    if (c.state === 'suspended') c.resume();

    if (SYNTHS[name]) {
        SYNTHS[name](c, c.currentTime + delay, volume);
        return;
    }
    const files = SAMPLES[name];
    if (!files) return;
    const startAt = c.currentTime + delay;
    loadSample(files[Math.floor(Math.random() * files.length)]).then((buffer) => {
        if (!buffer || muted) return;
        const source = c.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 0.94 + Math.random() * 0.12; // tiny variation so repeats sound natural
        const gain = c.createGain();
        const level = (SAMPLE_VOLUME[name] ?? 1) * volume;
        const start = Math.max(startAt, c.currentTime);
        gain.gain.setValueAtTime(level, start);
        if (duration) {
            gain.gain.setValueAtTime(level, start + duration * 0.7);
            gain.gain.linearRampToValueAtTime(0, start + duration);
        }
        source.connect(gain).connect(master);
        source.start(start);
        if (duration) source.stop(start + duration + 0.05);
    });
}
