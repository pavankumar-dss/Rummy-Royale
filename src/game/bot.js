import { cardPoints, isWild, rankValue } from './cards.js';
import { createMeldScorer, findDeclaration } from './melds.js';

/*
 * Bots only ever see their own player view (no peeking at other hands or the deck).
 * Strategy: keep cards that are in melds or close to forming one, take the top
 * discard only when it completes or extends a meld, and declare as soon as possible.
 */

const WILD_KEEP_VALUE = 25;
const HIGH_CARD_DUMP_WEIGHT = 0.3;

// How strongly a card links to the rest of the hand (pairs that could become melds).
function connections(hand, index, wildRank) {
    const card = hand[index];
    if (isWild(card, wildRank)) return 0;
    let score = 0;
    hand.forEach((other, i) => {
        if (i === index || isWild(other, wildRank)) return;
        if (other.rank === card.rank && other.suit !== card.suit) score += 3;
        if (other.suit === card.suit) {
            const a = rankValue(card.rank);
            const b = rankValue(other.rank);
            let gap = Math.abs(a - b);
            // An ace also sits above the king (Q-K-A), but sequences never wrap K-A-2.
            if (a === 1 || b === 1) gap = Math.min(gap, Math.abs((a === 1 ? 14 : a) - (b === 1 ? 14 : b)));
            if (gap === 1) score += 4;
            else if (gap === 2) score += 2;
        }
    });
    return score;
}

// Scores each possible discard from a 14-card hand. Higher means better to throw away.
function rankDiscards(hand, wildRank, excludeId) {
    const scorer = createMeldScorer(hand, wildRank);
    const full = (1 << hand.length) - 1;
    return hand
        .map((card, i) => ({
            card,
            score:
                scorer(full ^ (1 << i)) -
                connections(hand, i, wildRank) -
                (isWild(card, wildRank) ? WILD_KEEP_VALUE : 0) +
                cardPoints(card, wildRank) * HIGH_CARD_DUMP_WEIGHT,
            keptMeldScore: scorer(full ^ (1 << i)),
        }))
        .filter(({ card }) => card.id !== excludeId)
        .sort((a, b) => b.score - a.score);
}

function shouldTakeDiscard(hand, top, wildRank) {
    if (isWild(top, wildRank)) return true;
    const withTop = [...hand, top];
    const scorer = createMeldScorer(withTop, wildRank);
    const full = (1 << withTop.length) - 1;
    const withoutTop = scorer(full ^ (1 << hand.length));
    const [best] = rankDiscards(withTop, wildRank, top.id);
    // Only worth it if keeping the card puts at least one more card into a meld.
    return best.keptMeldScore - withoutTop >= 10;
}

export function chooseBotAction(view) {
    const me = view.players[view.viewerId];
    const { wildRank } = view;

    if (view.phase === 'DRAW') {
        const top = view.discardTop;
        return { type: 'draw', source: top && shouldTakeDiscard(me.hand, top, wildRank) ? 'discard' : 'deck' };
    }

    if (findDeclaration(me.hand, wildRank)) return { type: 'declare' };

    const excludeId = view.drawnCard?.fromDiscard ? view.drawnCard.id : null;
    const [best] = rankDiscards(me.hand, wildRank, excludeId);
    return { type: 'discard', cardId: best.card.id };
}
