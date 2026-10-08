import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, getPlayerView } from './engine.js';
import { chooseBotAction } from './bot.js';
import { cards, seededRng } from './testUtils.js';

const NOW = 1_000_000;
const players = (n) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isBot: i > 0 }));
const newGame = (n = 2, opts = {}) => createGame({ players: players(n), rng: seededRng(42), now: NOW, ...opts });
const act = (state, playerId, action, now = NOW) => applyAction(state, playerId, action, { now, rng: seededRng(1) });

test('deals 13 cards each and uses enough decks', () => {
    for (const [n, total] of [[2, 53], [3, 53], [4, 106], [6, 159]]) {
        const g = newGame(n);
        assert.ok(g.players.every((p) => p.hand.length === 13));
        const counted = g.players.length * 13 + g.deck.length + g.discardPile.length + 1; // +1 wildcard
        assert.equal(counted, total);
        const ids = [...g.players.flatMap((p) => p.hand), ...g.deck, ...g.discardPile, g.wildCard].map((c) => c.id);
        assert.equal(new Set(ids).size, ids.length, 'no duplicate card ids');
    }
});

test('enforces turn order and draw → discard phases', () => {
    let g = newGame();
    assert.match(act(g, 1, { type: 'draw', source: 'deck' }).error, /not your turn/);
    assert.match(act(g, 0, { type: 'discard', cardId: g.players[0].hand[0].id }).error, /Draw a card first/);

    g = act(g, 0, { type: 'draw', source: 'deck' }).state;
    assert.equal(g.players[0].hand.length, 14);
    assert.match(act(g, 0, { type: 'draw', source: 'deck' }).error, /already drawn/);

    g = act(g, 0, { type: 'discard', cardId: g.players[0].hand[3].id }).state;
    assert.equal(g.players[0].hand.length, 13);
    assert.equal(g.currentPlayer, 1);
    assert.equal(g.phase, 'DRAW');
});

test('discards by card id, not by suit and rank', () => {
    let g = newGame(4); // two decks, so duplicate cards exist
    g = act(g, 0, { type: 'draw', source: 'deck' }).state;
    const target = g.players[0].hand[5];
    g = act(g, 0, { type: 'discard', cardId: target.id }).state;
    assert.equal(g.discardPile.at(-1).id, target.id);
});

test('cannot throw back the card just picked from the discard pile', () => {
    let g = newGame();
    const top = g.discardPile.at(-1);
    g = act(g, 0, { type: 'draw', source: 'discard' }).state;
    assert.match(act(g, 0, { type: 'discard', cardId: top.id }).error, /just picked/);
});

test('actions never mutate the input state', () => {
    const g = newGame();
    const snapshot = structuredClone(g);
    act(g, 0, { type: 'draw', source: 'deck' });
    act(g, 0, { type: 'reorder', cardIds: [...g.players[0].hand].reverse().map((c) => c.id) });
    assert.deepEqual(g, snapshot);
});

test('reorder must be an exact permutation of the hand', () => {
    const g = newGame();
    const ids = g.players[0].hand.map((c) => c.id);
    assert.ok(!act(g, 0, { type: 'reorder', cardIds: [...ids].reverse() }).error);
    assert.ok(act(g, 0, { type: 'reorder', cardIds: ids.slice(1) }).error);
    assert.ok(act(g, 0, { type: 'reorder', cardIds: [...ids.slice(1), ids[1]] }).error);
    assert.ok(act(g, 0, { type: 'reorder', cardIds: [...ids.slice(1), g.players[1].hand[0].id] }).error);
});

test('player view hides opponent hands and the deck until the game ends', () => {
    const g = newGame(3);
    const view = getPlayerView(g, 0);
    assert.equal(view.players[0].hand.length, 13);
    assert.equal(view.players[1].hand, undefined);
    assert.equal(view.players[1].handCount, 13);
    assert.equal(view.deck, undefined);
    assert.equal(view.discardPile, undefined);
    assert.equal(view.deckCount, g.deck.length);
    assert.ok(!JSON.stringify(view).includes(g.players[1].hand[0].id + '"'), 'opponent card ids not leaked');
});

test('timeout skips a player who has not drawn', () => {
    const g = newGame(2, { turnSeconds: 30 });
    assert.match(act(g, 1, { type: 'timeout' }, NOW + 1000).error, /not expired/);
    const after = act(g, 1, { type: 'timeout' }, NOW + 30_000).state;
    assert.equal(after.currentPlayer, 1);
    assert.equal(after.players[0].hand.length, 13);
    assert.equal(after.turnDeadline, NOW + 60_000);
});

test('timeout after drawing throws back the drawn card', () => {
    let g = newGame(2, { turnSeconds: 30 });
    g = act(g, 0, { type: 'draw', source: 'deck' }).state;
    g = act(g, 0, { type: 'reorder', cardIds: [...g.players[0].hand].reverse().map((c) => c.id) }).state;
    const drawnId = g.drawnCard.id;
    g = act(g, 1, { type: 'timeout' }, NOW + 31_000).state;
    assert.equal(g.discardPile.at(-1).id, drawnId);
    assert.equal(g.players[0].hand.length, 13);
});

test('declaring a valid hand wins; an invalid one is rejected', () => {
    let g = newGame();
    g.wildRank = '5';
    g.players[0].hand = cards('A♥ 2♥ 3♥  9♠ 10♠ JK Q♠  7♣ 7♦ 7♥  K♣ K♦ 4♠');
    g.deck.push(...cards('K♠'));

    assert.match(act(g, 0, { type: 'declare' }).error, /Draw a card first/);
    g = act(g, 0, { type: 'draw', source: 'deck' }).state;
    const { state, error } = act(g, 0, { type: 'declare' });
    assert.equal(error, null);
    assert.equal(state.status, 'FINISHED');
    assert.equal(state.winner.playerId, 0);
    assert.equal(state.discardPile.at(-1).rank, '4');
    assert.equal(getPlayerView(state, 0).players[1].hand.length, 13, 'hands revealed at the end');

    let bad = newGame();
    bad = act(bad, 0, { type: 'draw', source: 'deck' }).state;
    assert.match(act(bad, 0, { type: 'declare' }).error, /Not a valid hand/);
});

test('bots play full games to a finish without illegal moves', () => {
    const results = [];
    for (let seed = 1; seed <= 6; seed++) {
        const rng = seededRng(seed);
        let g = createGame({ players: players(seed % 3 + 2).map((p) => ({ ...p, isBot: true })), rng, now: NOW });
        let steps = 0;
        while (g.status === 'PLAYING' && steps < 2000) {
            const id = g.currentPlayer;
            const { state, error } = applyAction(g, id, chooseBotAction(getPlayerView(g, id)), { now: NOW, rng });
            assert.equal(error, null, `seed ${seed} step ${steps}`);
            g = state;
            steps++;
        }
        assert.equal(g.status, 'FINISHED', `seed ${seed} finished`);
        results.push({ seed, turns: g.turn, winner: g.winner?.playerId ?? 'draw' });
    }
    // At least most games should end with an actual winner rather than the deck running out.
    assert.ok(results.filter((r) => r.winner !== 'draw').length >= 4, JSON.stringify(results));
    console.log('bot games:', JSON.stringify(results));
});
