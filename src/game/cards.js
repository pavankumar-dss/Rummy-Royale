export const SUITS = ['♠', '♥', '♣', '♦'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const JOKER = 'JOKER';

const SUIT_ORDER = { '♠': 0, '♥': 1, '♣': 2, '♦': 3 };

// A = 1 … K = 13. Printed jokers have no rank value (0).
export const rankValue = (rank) => RANKS.indexOf(rank) + 1;

export const isPrintedJoker = (card) => card.rank === JOKER;

// Printed jokers and every card of the wildcard rank can stand in for any card.
export const isWild = (card, wildRank) => isPrintedJoker(card) || card.rank === wildRank;

export const cardLabel = (card) => (isPrintedJoker(card) ? 'Joker' : `${card.rank}${card.suit}`);

// Standard Indian Rummy points: face cards and aces are 10, wilds are free.
export function cardPoints(card, wildRank) {
    if (isWild(card, wildRank)) return 0;
    const value = rankValue(card.rank);
    return value === 1 || value > 10 ? 10 : value;
}

// 13 cards each + wildcard + first discard must fit in the deck.
export const decksForPlayers = (numPlayers) => (numPlayers <= 3 ? 1 : numPlayers <= 5 ? 2 : 3);

export function createDeck(numDecks) {
    const deck = [];
    for (let d = 0; d < numDecks; d++) {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                deck.push({ id: `${d}-${rank}${suit}`, suit, rank });
            }
        }
        deck.push({ id: `${d}-${JOKER}`, suit: null, rank: JOKER });
    }
    return deck;
}

export function shuffle(cards, rng = Math.random) {
    const out = [...cards];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

// Sort by suit then rank, or by rank then suit. Wilds always go to the right.
export function sortCards(cards, by, wildRank) {
    const key = (c) => {
        if (isWild(c, wildRank)) return [1, rankValue(c.rank), SUIT_ORDER[c.suit] ?? 4];
        return by === 'suit'
            ? [0, SUIT_ORDER[c.suit], rankValue(c.rank)]
            : [0, rankValue(c.rank), SUIT_ORDER[c.suit]];
    };
    return [...cards].sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    });
}
