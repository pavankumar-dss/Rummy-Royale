import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_RESHUFFLES, applyAction, createGame, getPlayerView } from './engine.js';
import { scoreRound } from './match.js';
import { chooseBotAction, handStrength } from './bot.js';
import { cards, seededRng } from './testUtils.js';

const NOW = 1_000_000;
const newGame = (n = 3) =>
    createGame({ players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isBot: i > 0 })), rng: seededRng(42), now: NOW });
const act = (state, playerId, action) => applyAction(state, playerId, action, { now: NOW, rng: seededRng(1) });

// --- Engine ---

test('dropping before ever drawing is a first drop; after drawing, a middle drop', () => {
    let g = newGame(3);
    g = act(g, 0, { type: 'drop' }).state;
    assert.equal(g.players[0].dropped, 'first');
    assert.equal(g.currentPlayer, 1);
    assert.equal(g.log.at(-1).type, 'drop');

    g = act(g, 1, { type: 'draw', source: 'deck' }).state;
    g = act(g, 1, { type: 'discard', cardId: g.players[1].hand[0].id }).state;
    assert.equal(g.currentPlayer, 2);
    g = act(g, 2, { type: 'draw', source: 'deck' }).state;
    g = act(g, 2, { type: 'discard', cardId: g.players[2].hand[0].id }).state;
    assert.equal(g.currentPlayer, 1, 'the dropped player is skipped');

    g = act(g, 1, { type: 'drop' }).state;
    assert.equal(g.players[1].dropped, 'middle');
});

test('you can only drop on your own turn, before drawing', () => {
    let g = newGame(3);
    assert.match(act(g, 1, { type: 'drop' }).error, /not your turn/);
    g = act(g, 0, { type: 'draw', source: 'deck' }).state;
    assert.match(act(g, 0, { type: 'drop' }).error, /before you draw/);
});

test('when everyone else has dropped, the last player in wins the round', () => {
    let g = newGame(3);
    g = act(g, 0, { type: 'drop' }).state;
    g = act(g, 1, { type: 'drop' }).state;
    assert.equal(g.status, 'FINISHED');
    assert.equal(g.winner.playerId, 2);
    assert.equal(g.winner.byDrops, true);
    assert.equal(g.log.at(-1).type, 'last-standing');
});

test('pick-ups and discards are recorded in the public history', () => {
    let g = newGame(2);
    const top = g.discardPile.at(-1);
    g = act(g, 0, { type: 'draw', source: 'discard' }).state;
    const thrown = g.players[0].hand[0];
    g = act(g, 0, { type: 'discard', cardId: thrown.id }).state;
    assert.deepEqual(
        g.history.map((h) => [h.playerId, h.type, h.card.id]),
        [
            [0, 'pick', top.id],
            [0, 'discard', thrown.id],
        ],
    );
    assert.equal(getPlayerView(g, 1).discards.at(-1).id, thrown.id);
});

// --- Scoring ---

test('drops cost 20 or 40 whatever happens next; the last player in scores 0', () => {
    let g = newGame(3);
    g = act(g, 0, { type: 'drop' }).state; // first drop
    g = act(g, 1, { type: 'draw', source: 'deck' }).state;
    g = act(g, 1, { type: 'discard', cardId: g.players[1].hand[0].id }).state;
    g = act(g, 2, { type: 'draw', source: 'deck' }).state;
    g = act(g, 2, { type: 'discard', cardId: g.players[2].hand[0].id }).state;
    g = act(g, 1, { type: 'drop' }).state; // middle drop, leaves player 2

    const results = scoreRound(g);
    assert.deepEqual(
        results.map((r) => [r.count, r.dropped ?? null, Boolean(r.winner)]),
        [
            [20, 'first', false],
            [40, 'middle', false],
            [0, null, true],
        ],
    );
    assert.equal(results[2].byDrops, true);
});

// --- Bots ---

const WILD = '5';
// No wilds, no melds and no same-suit pairs that one card would make pure.
const HOPELESS = 'A♠ 3♥ 7♣ 9♦ J♠ K♥ 2♣ 6♦ 8♠ 10♥ Q♣ 4♠ K♦';
const STRONG = 'A♥ 2♥ 3♥  9♠ 10♠ J♠  7♣ 7♦ 5♦  K♣ Q♦ 4♠ 2♣';

// A 3-player game where seat 0 holds `hand` and it's seat 0's turn.
function seatZero(hand, { phase = 'DRAW', turns = 0, history = [] } = {}) {
    const g = newGame(3);
    g.wildRank = WILD;
    g.players[0].hand = cards(hand);
    g.players[0].turns = turns;
    g.phase = phase;
    g.history = history;
    return getPlayerView(g, 0);
}

test('hand strength separates hopeless openers from promising ones', () => {
    assert.equal(handStrength(cards(HOPELESS), WILD).strength, 0);
    assert.ok(handStrength(cards(STRONG), WILD).strength >= 5);
});

test('medium and hard bots fold a hopeless opener; easy bots never drop', () => {
    const view = seatZero(HOPELESS);
    assert.equal(chooseBotAction(view, { level: 'hard' }).type, 'drop');
    assert.equal(chooseBotAction(view, { level: 'medium' }).type, 'drop');
    assert.equal(chooseBotAction(view, { level: 'easy', rng: seededRng(1) }).type, 'draw');
    assert.equal(chooseBotAction(seatZero(STRONG), { level: 'hard' }).type, 'draw');
});

test("bots don't drop when the penalty alone would put them over the limit", () => {
    const view = seatZero(HOPELESS);
    assert.equal(chooseBotAction(view, { level: 'hard', total: 190, limit: 200 }).type, 'draw');
    assert.equal(chooseBotAction(view, { level: 'hard', total: 180, limit: 200 }).type, 'drop');
});

test('hard bots make a middle drop only when a full count would knock them out', () => {
    const lifeless = 'K♠ Q♥ J♣ 10♦ 9♠ 8♥ K♦ Q♣ J♦ 10♠ 9♥ 7♣ A♦';
    const danger = { total: 150, limit: 200 }; // +80 would eliminate, +40 wouldn't
    assert.equal(chooseBotAction(seatZero(lifeless, { turns: 4 }), { level: 'hard', ...danger }).type, 'drop');
    assert.equal(chooseBotAction(seatZero(lifeless, { turns: 4 }), { level: 'hard' }).type, 'draw', 'not in danger');
    assert.equal(chooseBotAction(seatZero(lifeless, { turns: 1 }), { level: 'hard', ...danger }).type, 'draw', 'too early');
    assert.equal(chooseBotAction(seatZero(lifeless, { turns: 4 }), { level: 'medium', ...danger }).type, 'draw');
});

test("hard bots avoid discarding what the next player has been collecting", () => {
    // Everything is melded except two kings; either is an equally good discard on its own.
    const hand = 'A♥ 2♥ 3♥  4♠ 5♠ 6♠  7♥ 7♦ 7♣  9♥ 9♠ 9♣  K♣ K♦';
    const picked = (label) => ({ playerId: 1, type: 'pick', card: cards(label)[0] });
    const discard = (history) => {
        const view = seatZero(hand, { phase: 'DISCARD', turns: 3, history });
        return view.players[0].hand.find((c) => c.id === chooseBotAction(view, { level: 'hard' }).cardId);
    };
    assert.equal(discard([picked('Q♣')]).suit, '♦', 'keeps K♣ away from a player collecting clubs');
    assert.equal(discard([picked('Q♦')]).suit, '♣', 'keeps K♦ away from a player collecting diamonds');
});

test('the deck is rebuilt from the discards twice a round; the third time it runs out, nobody wins', () => {
    let g = newGame(2);
    for (let i = 0; i < MAX_RESHUFFLES; i++) {
        g.discardPile.push(...g.deck.splice(0)); // empty the deck
        g = act(g, g.currentPlayer, { type: 'draw', source: 'deck' }).state;
        assert.equal(g.status, 'PLAYING');
        assert.equal(g.reshuffles, i + 1);
        g = act(g, g.currentPlayer, { type: 'discard', cardId: g.players[g.currentPlayer].hand[0].id }).state;
    }
    g.discardPile.push(...g.deck.splice(0));
    g = act(g, g.currentPlayer, { type: 'draw', source: 'deck' }).state;
    assert.equal(g.status, 'FINISHED');
    assert.equal(g.winner, null);
    assert.equal(g.log.at(-1).type, 'deck-empty');
});
