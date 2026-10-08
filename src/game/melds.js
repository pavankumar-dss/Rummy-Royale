import { isPrintedJoker, isWild, rankValue } from './cards.js';

export const MELD = { NONE: 0, SET: 1, IMPURE: 2, PURE: 3 };
export const MELD_NAMES = { [MELD.SET]: 'Set', [MELD.IMPURE]: 'Sequence', [MELD.PURE]: 'Pure sequence' };

const MAX_MELD_SIZE = 13;

const aceHigh = (values) => values.map((v) => (v === 1 ? 14 : v));

function isRun(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
}

// Distinct values that fit inside a window of `length` consecutive ranks;
// wild cards fill whatever gaps are left.
function fitsRun(values, length) {
    return new Set(values).size === values.length && Math.max(...values) - Math.min(...values) < length;
}

// Same suit, consecutive, no printed jokers. A wildcard-rank card sitting in
// its natural position is fine. Ace can be low (A-2-3) or high (Q-K-A), never both.
function isPureSequence(cards) {
    if (cards.length < 3 || cards.some(isPrintedJoker)) return false;
    if (cards.some((c) => c.suit !== cards[0].suit)) return false;
    const values = cards.map((c) => rankValue(c.rank));
    return isRun(values) || (values.includes(1) && isRun(aceHigh(values)));
}

function isImpureSequence(cards, wildRank) {
    const naturals = cards.filter((c) => !isWild(c, wildRank));
    if (cards.length < 3 || naturals.length === 0) return false;
    if (naturals.some((c) => c.suit !== naturals[0].suit)) return false;
    const values = naturals.map((c) => rankValue(c.rank));
    return fitsRun(values, cards.length) || (values.includes(1) && fitsRun(aceHigh(values), cards.length));
}

// 3 or 4 cards of one rank, each natural card a different suit.
function isSet(cards, wildRank) {
    if (cards.length < 3 || cards.length > 4) return false;
    const naturals = cards.filter((c) => !isWild(c, wildRank));
    if (naturals.some((c) => c.rank !== naturals[0].rank)) return false;
    return new Set(naturals.map((c) => c.suit)).size === naturals.length;
}

export function classifyMeld(cards, wildRank) {
    if (isPureSequence(cards)) return MELD.PURE;
    if (isImpureSequence(cards, wildRank)) return MELD.IMPURE;
    if (isSet(cards, wildRank)) return MELD.SET;
    return MELD.NONE;
}

// --- Hand analysis over bitmasks (a hand is at most 14 cards) ---

const lowestIndex = (mask) => 31 - Math.clz32(mask & -mask);

function popcount(mask) {
    let n = 0;
    for (; mask; mask &= mask - 1) n++;
    return n;
}

function cardsIn(mask, cards) {
    const out = [];
    for (let i = 0; i < cards.length; i++) if (mask & (1 << i)) out.push(cards[i]);
    return out;
}

// Every valid meld in the hand, grouped by its lowest card index so a search
// can always extend from the first unplaced card.
function buildMeldIndex(cards, wildRank) {
    const n = cards.length;
    const types = new Uint8Array(1 << n);
    const byLowestCard = Array.from({ length: n }, () => []);
    for (let mask = 1; mask < 1 << n; mask++) {
        const size = popcount(mask);
        if (size < 3 || size > MAX_MELD_SIZE) continue;
        const type = classifyMeld(cardsIn(mask, cards), wildRank);
        if (type) {
            types[mask] = type;
            byLowestCard[lowestIndex(mask)].push(mask);
        }
    }
    return { types, byLowestCard };
}

/**
 * Can this hand be declared? Order doesn't matter: every partition is searched.
 * A 14-card hand (after drawing) leaves exactly one card out as the final discard.
 * Rules: every card in a meld, at least two sequences, at least one of them pure.
 * Returns { melds: [{ type, cards }], discard } or null.
 */
export function findDeclaration(hand, wildRank) {
    const n = hand.length;
    if (n !== 13 && n !== 14) return null;
    const { types, byLowestCard } = buildMeldIndex(hand, wildRank);
    const memo = new Map();

    const solve = (mask, skips, needPure, needSeq) => {
        if (mask === 0) return skips === 0 && !needPure && needSeq === 0 ? [] : null;
        const key = mask * 12 + skips * 6 + needPure * 3 + needSeq;
        if (memo.has(key)) return memo.get(key);

        const low = lowestIndex(mask);
        let result = skips > 0 ? solve(mask ^ (1 << low), skips - 1, needPure, needSeq) : null;
        for (const meld of byLowestCard[low]) {
            if (result) break;
            if ((meld & mask) !== meld) continue;
            const type = types[meld];
            const rest = solve(
                mask ^ meld,
                skips,
                type === MELD.PURE ? 0 : needPure,
                type >= MELD.IMPURE ? Math.max(0, needSeq - 1) : needSeq,
            );
            if (rest) result = [meld, ...rest];
        }
        memo.set(key, result);
        return result;
    };

    const full = (1 << n) - 1;
    const melds = solve(full, n - 13, 1, 2);
    if (!melds) return null;

    const used = melds.reduce((acc, m) => acc | m, 0);
    const discardIndex = n === 14 ? lowestIndex(full ^ used) : -1;
    return {
        melds: melds.map((m) => ({ type: types[m], cards: cardsIn(m, hand) })),
        discard: discardIndex >= 0 ? hand[discardIndex] : null,
    };
}

const MELD_BONUS = { [MELD.SET]: 0, [MELD.IMPURE]: 2, [MELD.PURE]: 10 };

// Best set of disjoint melds within any subset of `cards`, scored at 10 per melded
// card plus a bonus for sequences (mostly pure ones, since a declaration needs one).
function createMeldSolver(cards, wildRank) {
    const { types, byLowestCard } = buildMeldIndex(cards, wildRank);
    const memo = new Map();
    const EMPTY = { score: 0, melds: [] };

    const best = (mask) => {
        if (mask === 0) return EMPTY;
        if (memo.has(mask)) return memo.get(mask);
        const low = lowestIndex(mask);
        let result = best(mask ^ (1 << low));
        for (const meld of byLowestCard[low]) {
            if ((meld & mask) !== meld) continue;
            const rest = best(mask ^ meld);
            const score = popcount(meld) * 10 + MELD_BONUS[types[meld]] + rest.score;
            if (score > result.score) result = { score, melds: [meld, ...rest.melds] };
        }
        memo.set(mask, result);
        return result;
    };
    return { best, types };
}

/**
 * Scores subsets of `cards` by the best melds they contain. Used by bots to pick discards.
 * Returns (mask) => score, where bit i of mask means cards[i] is included.
 */
export function createMeldScorer(cards, wildRank) {
    const { best } = createMeldSolver(cards, wildRank);
    return (mask) => best(mask).score;
}

/**
 * Splits a hand into its best melds plus the leftover cards. Powers "Auto-arrange".
 * Returns { melds: [{ type, cards }], leftover: cards[] }.
 */
export function arrangeHand(cards, wildRank) {
    if (cards.length === 0) return { melds: [], leftover: [] };
    const { best, types } = createMeldSolver(cards, wildRank);
    const { melds } = best((1 << cards.length) - 1);
    const used = melds.reduce((acc, m) => acc | m, 0);
    return {
        melds: melds.map((m) => ({ type: types[m], cards: cardsIn(m, cards) })),
        leftover: cards.filter((_, i) => !(used & (1 << i))),
    };
}
