import { JOKER } from './cards.js';

let nextId = 0;

// Builds cards from short labels: '7♥', '10♠', 'Q♦', 'JK' (printed joker).
export function cards(labels) {
    return labels.split(/\s+/).filter(Boolean).map((label) => {
        nextId += 1;
        if (label === 'JK') return { id: `t${nextId}-${JOKER}`, suit: null, rank: JOKER };
        return { id: `t${nextId}-${label}`, rank: label.slice(0, -1), suit: label.slice(-1) };
    });
}

// Deterministic RNG (mulberry32) so tests and simulations are reproducible.
export function seededRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
