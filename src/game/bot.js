import { cardPoints, decksForPlayers, isWild, rankValue, RANKS } from './cards.js';
import { DROP_POINTS, nextActive } from './engine.js';
import { MELD, arrangeHand, createMeldScorer, findDeclaration } from './melds.js';

/*
 * Bots only ever see their own player view (no peeking at other hands or the deck).
 * Strategy: keep cards that are in melds or close to forming one, take the top
 * discard only when it completes or extends a meld, and declare as soon as possible.
 * Difficulty changes how carefully they do that:
 * - easy:   picks discards loosely, hoards high cards, only takes a discard that makes a meld, never drops.
 * - medium: sound but slightly loose discards; drops only hopeless opening hands.
 * - hard:   counts live cards (what's been discarded), avoids feeding the next player,
 *           sheds high cards as the round goes on, folds weak openers, and makes a
 *           middle drop when a full count would knock it out.
 * The drop thresholds come from simulated rounds: weak openers (strength ≤ 3) went on
 * to cost 34–50 points on average against a 20-point first drop. In simulated 3-player
 * matches against two medium bots, hard won about 39% and easy about 12%.
 */

export const BOT_LEVELS = {
    easy: { label: 'Easy', blurb: 'Loose discards, never drops' },
    medium: { label: 'Medium', blurb: 'Decent play, drops hopeless hands' },
    hard: { label: 'Hard', blurb: 'Counts cards, guards discards, drops smart' },
};

export const PROFILES = {
    easy: { noise: 12, pickGain: 30, dumpWeight: 0, lateDump: 0, liveCards: false, guard: 0, firstDrop: null, middleDrop: null },
    medium: {
        noise: 5,
        pickGain: 10,
        dumpWeight: 0.3,
        lateDump: 0,
        liveCards: false,
        guard: 0,
        firstDrop: { maxStrength: 1.5 },
        middleDrop: null,
    },
    hard: {
        noise: 0,
        pickGain: 10,
        dumpWeight: 0.25,
        lateDump: 0.08,
        liveCards: true,
        guard: 5,
        firstDrop: { maxStrength: 3 },
        middleDrop: { minTurns: 3, minCount: 60 },
    },
};

const WILD_KEEP_VALUE = 25;

// For a card the bot holds, how strongly it links to the rest of the hand
// (pairs that could become melds). `live` scales a pair by how many of the
// cards that would complete it are still unseen.
function connections(hand, index, wildRank, live) {
    const card = hand[index];
    if (isWild(card, wildRank)) return 0;
    let score = 0;
    hand.forEach((other, i) => {
        if (i === index || isWild(other, wildRank)) return;
        if (other.rank === card.rank && other.suit !== card.suit) {
            score += 3 * live.set(card.rank, [card.suit, other.suit]);
        }
        if (other.suit === card.suit) {
            let a = rankValue(card.rank);
            let b = rankValue(other.rank);
            // An ace also sits above the king (Q-K-A), but sequences never wrap K-A-2.
            if ((a === 1 || b === 1) && Math.abs((a === 1 ? 14 : a) - (b === 1 ? 14 : b)) < Math.abs(a - b)) {
                if (a === 1) a = 14;
                else b = 14;
            }
            const gap = Math.abs(a - b);
            if (gap === 1) score += 4 * live.run(card.suit, [Math.min(a, b) - 1, Math.max(a, b) + 1]);
            else if (gap === 2) score += 2 * live.run(card.suit, [Math.min(a, b) + 1]);
        }
    });
    return score;
}

const FULL_ODDS = { set: () => 1, run: () => 1 };

// How many copies of each card the bot can't have accounted for: not in its hand,
// not in the discard pile, not the cut wildcard, not picked up by an opponent.
function liveOdds(view, hand) {
    const decks = decksForPlayers(view.players.length);
    const seen = new Map();
    const see = (c) => seen.set(c.rank + c.suit, (seen.get(c.rank + c.suit) ?? 0) + 1);
    [...hand, ...view.discards, view.wildCard].forEach(see);
    const held = new Map(); // cards opponents picked from the pile and haven't thrown back
    for (const { playerId, type, card } of view.history) {
        if (playerId === view.viewerId) continue;
        if (type === 'pick') held.set(card.id, card);
        else held.delete(card.id);
    }
    held.forEach(see);
    const unseen = (rank, suit) => Math.max(0, decks - (seen.get(rank + suit) ?? 0));
    // Scaled so a dead draw still keeps a little value (wilds can complete anything).
    const scale = (outs, max) => (max ? 0.3 + (0.7 * outs) / max : 0.3);
    return {
        set(rank, suits) {
            const others = ['♠', '♥', '♣', '♦'].filter((s) => !suits.includes(s));
            return scale(
                others.reduce((n, s) => n + unseen(rank, s), 0),
                others.length * decks,
            );
        },
        run(suit, values) {
            const valid = values.filter((v) => v >= 1 && v <= 14);
            return scale(
                valid.reduce((n, v) => n + unseen(RANKS[(v - 1) % 13], suit), 0),
                valid.length * decks,
            );
        },
    };
}

// What the next player in turn has picked up and thrown away this round.
function nextPlayerTells(view) {
    const next = nextActive(view.players, view.viewerId);
    const picks = [];
    const throws = [];
    for (const { playerId, type, card } of view.history) {
        if (playerId !== next) continue;
        (type === 'pick' ? picks : throws).push(card);
    }
    return { picks, throws };
}

// `weight` is how much the bot cares: it trades off against keeping its own hand good.
function guardAdjustment(card, wildRank, tells, weight) {
    if (isWild(card, wildRank)) return 0;
    const v = rankValue(card.rank);
    const feeds = tells.picks.some(
        (p) => !isWild(p, wildRank) && (p.rank === card.rank || (p.suit === card.suit && Math.abs(rankValue(p.rank) - v) <= 2)),
    );
    const safe = tells.throws.some((t) => t.rank === card.rank);
    return ((safe ? 0.4 : 0) - (feeds ? 1 : 0)) * weight;
}

// Scores each possible discard from a 14-card hand. Higher means better to throw away.
function rankDiscards(hand, wildRank, excludeId, { profile, view, rng }) {
    const scorer = createMeldScorer(hand, wildRank);
    const full = (1 << hand.length) - 1;
    const live = profile.liveCards && view ? liveOdds(view, hand) : FULL_ODDS;
    const tells = profile.guard && view ? nextPlayerTells(view) : null;
    const turns = view?.players[view.viewerId].turns ?? 0;
    const dumpWeight = profile.dumpWeight + profile.lateDump * Math.min(turns, 10);
    return hand
        .map((card, i) => {
            const keptMeldScore = scorer(full ^ (1 << i));
            let score =
                keptMeldScore -
                connections(hand, i, wildRank, live) -
                (isWild(card, wildRank) ? WILD_KEEP_VALUE : 0) +
                cardPoints(card, wildRank) * dumpWeight;
            if (tells) score += guardAdjustment(card, wildRank, tells, profile.guard);
            if (profile.noise) score += rng() * profile.noise;
            return { card, score, keptMeldScore };
        })
        .filter(({ card }) => card.id !== excludeId)
        .sort((a, b) => b.score - a.score);
}

function shouldTakeDiscard(hand, top, wildRank, ctx) {
    if (isWild(top, wildRank)) return true;
    const withTop = [...hand, top];
    const scorer = createMeldScorer(withTop, wildRank);
    const full = (1 << withTop.length) - 1;
    const withoutTop = scorer(full ^ (1 << hand.length));
    const [best] = rankDiscards(withTop, wildRank, top.id, { ...ctx, profile: { ...ctx.profile, noise: 0 } });
    // Only worth it if keeping the card puts more cards into melds.
    return best.keptMeldScore - withoutTop >= ctx.profile.pickGain;
}

/**
 * A rough measure of a 13-card hand's promise: a pure sequence is worth the most
 * (it's the "life" that protects the rest), then wilds, other melds and
 * same-suit pairs that one card would turn into a pure sequence.
 */
export function handStrength(hand, wildRank) {
    const { melds, leftover } = arrangeHand(hand, wildRank);
    const wilds = hand.filter((c) => isWild(c, wildRank)).length;
    const hasPure = melds.some((m) => m.type === MELD.PURE);
    const otherMelds = melds.filter((m) => m.type !== MELD.PURE).length;
    let pureDraws = 0;
    const naturals = leftover.filter((c) => !isWild(c, wildRank));
    for (let i = 0; i < naturals.length; i++) {
        for (let j = i + 1; j < naturals.length; j++) {
            const [a, b] = [naturals[i], naturals[j]];
            if (a.suit !== b.suit) continue;
            const gap = Math.abs(rankValue(a.rank) - rankValue(b.rank));
            if (gap === 1 || gap === 2 || gap === 11 || gap === 12) pureDraws++;
        }
    }
    const strength = (hasPure ? 3 : 0) + wilds * 1.5 + otherMelds + Math.min(pureDraws, 3) * 0.5;
    return { strength, hasPure, wilds, otherMelds, pureDraws };
}

function shouldDrop(view, me, profile, { total = 0, limit = Infinity }) {
    const first = me.turns === 0;
    const rule = first ? profile.firstDrop : profile.middleDrop;
    if (!rule) return false;
    const penalty = DROP_POINTS[first ? 'first' : 'middle'];
    if (total + penalty > limit) return false; // dropping would knock us out anyway

    const hand = me.hand;
    // Close to the limit, a full count would knock us out: fold more readily.
    const danger = total + 80 > limit;
    if (first) return handStrength(hand, view.wildRank).strength <= rule.maxStrength + (danger && profile.middleDrop ? 0.5 : 0);

    // Middle drop: still no pure sequence well into the round, holding a big count, and a
    // full count would knock us out. Otherwise playing on costs less than 40 on average,
    // even for hands like this.
    if (!danger || me.turns < rule.minTurns) return false;
    const { hasPure } = handStrength(hand, view.wildRank);
    if (hasPure) return false;
    const count = hand.reduce((n, c) => n + cardPoints(c, view.wildRank), 0);
    return count >= rule.minCount;
}

/**
 * The bot's next move given only its own view.
 * `options`: { level: 'easy' | 'medium' | 'hard', total, limit, rng }, where total and limit
 * are its match score and the elimination limit (they make drops score-aware).
 */
export function chooseBotAction(view, { level = 'medium', total = 0, limit = Infinity, rng = Math.random } = {}) {
    const profile = PROFILES[level] ?? PROFILES.medium;
    const me = view.players[view.viewerId];
    const { wildRank } = view;
    const ctx = { profile, view, rng };

    if (view.phase === 'DRAW') {
        if (shouldDrop(view, me, profile, { total, limit })) return { type: 'drop' };
        const top = view.discardTop;
        return { type: 'draw', source: top && shouldTakeDiscard(me.hand, top, wildRank, ctx) ? 'discard' : 'deck' };
    }

    if (findDeclaration(me.hand, wildRank)) return { type: 'declare' };

    const excludeId = view.drawnCard?.fromDiscard ? view.drawnCard.id : null;
    const [best] = rankDiscards(me.hand, wildRank, excludeId, ctx);
    return { type: 'discard', cardId: best.card.id };
}
