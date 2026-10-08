import { JOKER, cardLabel, createDeck, decksForPlayers, shuffle } from './cards.js';
import { findDeclaration } from './melds.js';

/*
 * Pure game engine. State is plain JSON so it can later be held by a
 * peer-to-peer host and sent to each player via getPlayerView().
 * Nothing here touches the DOM, timers or randomness except through options.
 */

export const HAND_SIZE = 13;
const LOG_LIMIT = 6;

const deadlineFrom = (turnSeconds, now) => (turnSeconds ? now + turnSeconds * 1000 : null);

export function createGame({ players, turnSeconds = 0, rng = Math.random, now = Date.now() }) {
    if (players.length < 2 || players.length > 6) throw new Error('Rummy needs 2 to 6 players');

    const deck = shuffle(createDeck(decksForPlayers(players.length)), rng);
    const seated = players.map((p, id) => ({
        id,
        name: p.name,
        isBot: Boolean(p.isBot),
        hand: deck.splice(0, HAND_SIZE),
    }));

    // If the cut card is a printed joker, aces become wild.
    const wildCard = deck.pop();
    const wildRank = wildCard.rank === JOKER ? 'A' : wildCard.rank;

    return {
        id: Math.floor(rng() * 2 ** 32).toString(36),
        status: 'PLAYING',
        players: seated,
        deck,
        discardPile: [deck.pop()],
        wildCard,
        wildRank,
        currentPlayer: 0,
        phase: 'DRAW',
        drawnCard: null, // { id, fromDiscard } for the current turn
        turn: 1,
        turnSeconds,
        turnDeadline: deadlineFrom(turnSeconds, now),
        winner: null, // { playerId, melds } once someone declares
        eventSeq: 1,
        log: [{ seq: 1, turn: 1, playerId: null, type: 'deal', text: 'Cards dealt. Good luck!' }],
    };
}

// Every event gets a type and an increasing seq so the UI can react (sounds, animations) exactly once.
function addLog(state, playerId, type, text) {
    state.eventSeq += 1;
    state.log = [...state.log, { seq: state.eventSeq, turn: state.turn, playerId, type, text }].slice(-LOG_LIMIT);
}

function endTurn(state, now) {
    state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
    state.phase = 'DRAW';
    state.drawnCard = null;
    state.turn += 1;
    state.turnDeadline = deadlineFrom(state.turnSeconds, now);
}

function finish(state, winner) {
    state.status = 'FINISHED';
    state.phase = null;
    state.turnDeadline = null;
    state.winner = winner;
}

function discardCard(state, player, index) {
    const [card] = player.hand.splice(index, 1);
    state.discardPile.push(card);
    return card;
}

const handlers = {
    draw(state, playerId, { source }, { rng }) {
        if (state.phase !== 'DRAW') return 'You have already drawn. Discard a card to end your turn.';
        const player = state.players[playerId];

        if (source === 'discard') {
            if (state.discardPile.length === 0) return 'The discard pile is empty.';
            const card = state.discardPile.pop();
            player.hand.push(card);
            state.drawnCard = { id: card.id, fromDiscard: true };
            addLog(state, playerId, 'pick', `picked ${cardLabel(card)} from the discard pile`);
        } else {
            if (state.deck.length === 0) {
                // Reshuffle everything under the top discard into a new deck.
                const top = state.discardPile.pop();
                state.deck = shuffle(state.discardPile, rng);
                state.discardPile = top ? [top] : [];
            }
            if (state.deck.length === 0) {
                addLog(state, playerId, 'deck-empty', 'found the deck empty. The game ends in a draw');
                finish(state, null);
                return null;
            }
            const card = state.deck.pop();
            player.hand.push(card);
            state.drawnCard = { id: card.id, fromDiscard: false };
            addLog(state, playerId, 'draw', 'drew from the deck');
        }
        state.phase = 'DISCARD';
        return null;
    },

    discard(state, playerId, { cardId }, { now }) {
        if (state.phase !== 'DISCARD') return 'Draw a card first.';
        const player = state.players[playerId];
        const index = player.hand.findIndex((c) => c.id === cardId);
        if (index === -1) return 'That card is not in your hand.';
        if (state.drawnCard?.fromDiscard && state.drawnCard.id === cardId) {
            return "You can't discard the card you just picked from the discard pile.";
        }
        const card = discardCard(state, player, index);
        addLog(state, playerId, 'discard', `discarded ${cardLabel(card)}`);
        endTurn(state, now);
        return null;
    },

    declare(state, playerId) {
        if (state.phase !== 'DISCARD') return 'Draw a card first, then declare.';
        const player = state.players[playerId];
        const result = findDeclaration(player.hand, state.wildRank);
        if (!result) {
            return 'Not a valid hand yet. You need at least 2 sequences (1 of them pure) and every other card in sets or sequences.';
        }
        discardCard(state, player, player.hand.findIndex((c) => c.id === result.discard.id));
        player.hand = result.melds.flatMap((m) => m.cards);
        addLog(state, playerId, 'declare', `declared and discarded ${cardLabel(result.discard)}`);
        finish(state, { playerId, melds: result.melds });
        return null;
    },

    // Any player may rearrange their own hand at any time.
    reorder(state, playerId, { cardIds }) {
        const player = state.players[playerId];
        const byId = new Map(player.hand.map((c) => [c.id, c]));
        if (!Array.isArray(cardIds) || cardIds.length !== byId.size || new Set(cardIds).size !== byId.size) {
            return 'Invalid hand order.';
        }
        if (!cardIds.every((id) => byId.has(id))) return 'Invalid hand order.';
        player.hand = cardIds.map((id) => byId.get(id));
        return null;
    },

    // Anyone may trigger this once the deadline has passed. It acts on the current player.
    timeout(state, _playerId, _action, { now }) {
        if (!state.turnDeadline || now < state.turnDeadline) return 'The turn has not expired yet.';
        const playerId = state.currentPlayer;
        const player = state.players[playerId];

        if (state.phase === 'DISCARD') {
            // Throw back the card they drew, unless it came from the discard pile.
            const drawn = state.drawnCard;
            let index = drawn && !drawn.fromDiscard ? player.hand.findIndex((c) => c.id === drawn.id) : -1;
            if (index === -1) index = player.hand.findLastIndex((c) => c.id !== drawn?.id);
            const card = discardCard(state, player, index);
            addLog(state, playerId, 'timeout-discard', `ran out of time and discarded ${cardLabel(card)}`);
        } else {
            addLog(state, playerId, 'timeout-skip', 'ran out of time and missed a turn');
        }
        endTurn(state, now);
        return null;
    },
};

const TURN_ACTIONS = new Set(['draw', 'discard', 'declare']);

/**
 * Applies one player's action. Never mutates `state`.
 * Returns { state, error }; on error the original state is returned unchanged.
 */
export function applyAction(state, playerId, action, { now = Date.now(), rng = Math.random } = {}) {
    const handler = handlers[action?.type];
    if (!handler) return { state, error: 'Unknown action.' };
    if (state.status !== 'PLAYING') return { state, error: 'The game is over.' };
    if (!state.players[playerId]) return { state, error: 'Unknown player.' };
    if (TURN_ACTIONS.has(action.type) && state.currentPlayer !== playerId) {
        return { state, error: "It's not your turn." };
    }

    const next = structuredClone(state);
    const error = handler(next, playerId, action, { now, rng });
    return error ? { state, error } : { state: next, error: null };
}

/**
 * What one player is allowed to see: their own hand, the top discard and
 * opponents' card counts. All hands are revealed once the game is finished.
 */
export function getPlayerView(state, viewerId) {
    const revealAll = state.status === 'FINISHED';
    const { deck, discardPile, drawnCard, ...shared } = state;
    return {
        ...shared,
        viewerId,
        deckCount: deck.length,
        discardCount: discardPile.length,
        discardTop: discardPile.at(-1) ?? null,
        discardRecent: discardPile.slice(-3), // the pile is public; the UI shows a few cards peeking out
        drawnCard: state.currentPlayer === viewerId ? drawnCard : null,
        players: state.players.map(({ hand, ...p }) =>
            p.id === viewerId || revealAll ? { ...p, hand, handCount: hand.length } : { ...p, handCount: hand.length },
        ),
    };
}
