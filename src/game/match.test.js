import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreHand } from './melds.js';
import { ROUND_CAP, applyMatchAction, createMatch, endMatch, seatOf, standings, startNextRound } from './match.js';
import { getPlayerView } from './engine.js';
import { chooseBotAction } from './bot.js';
import { cards, seededRng } from './testUtils.js';

const WILD = '5';
const NOW = 1_000_000;

test('finds the cheapest arrangement, using jokers where they save the most', () => {
    // Best cover: 6♣ 6♦ JK (set) and 8♠ 9♠ 10♠ (pure), leaving only K♠.
    const result = scoreHand(cards('A♥ 2♥ 3♥  9♠ 10♠ JK  7♣ 7♦ 7♥  6♣ 6♦ 8♠  K♠'), WILD);
    assert.equal(result.hasLife, true);
    assert.equal(result.count, 10);
    assert.deepEqual(result.deadwood.map((c) => c.rank), ['K']);
});

test('the example from the rules: only a missing set of 6, 6, 8 → 20', () => {
    const result = scoreHand(cards('A♥ 2♥ 3♥  9♠ 10♠ J♠ Q♠  7♣ 7♦ 7♥  6♣ 6♦ 8♥'), WILD);
    assert.equal(result.hasLife, true);
    assert.equal(result.count, 20);
    assert.deepEqual(result.deadwood.map((c) => c.rank).sort(), ['6', '6', '8']);
});

test('without a life every card counts, even ones in sets (wilds still 0)', () => {
    const result = scoreHand(cards('7♣ 7♦ 7♥  K♣ K♦ K♠  A♠ A♥ A♦  JK 5♠  2♣ 9♦'), WILD);
    assert.equal(result.hasLife, false);
    assert.equal(result.count, 21 + 30 + 30 + 0 + 0 + 2 + 9);
    assert.equal(result.melds.length, 0);
});

test('aces and face cards count 10, number cards their value', () => {
    const result = scoreHand(cards('2♣ 3♣ 4♣  A♥ K♠ Q♦ J♥ 10♠ 9♦ 8♣ 7♥ 6♠ 4♦'), WILD);
    assert.equal(result.count, 10 + 10 + 10 + 10 + 10 + 9 + 8 + 7 + 6 + 4);
});

const playersOf = (n) => [{ name: 'You', isBot: false }, ...Array.from({ length: n - 1 }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true }))];

// Plays the current round to the end with bot logic for every seat.
function playRound(match, rng) {
    let m = match;
    for (let steps = 0; m.status === 'PLAYING' && steps < 3000; steps++) {
        const seat = m.game.currentPlayer;
        const { match: next, error } = applyMatchAction(m, seat, chooseBotAction(getPlayerView(m.game, seat), { rng }), { now: NOW, rng });
        assert.equal(error, null);
        m = next;
    }
    return m;
}

test('a round is scored when someone declares: winner 0, others capped at 80', () => {
    const rng = seededRng(3);
    const m = playRound(createMatch({ players: playersOf(3), rng, now: NOW }), rng);
    assert.notEqual(m.status, 'PLAYING');
    const [round] = m.rounds;
    assert.equal(round.number, 1);
    for (const r of round.results) {
        assert.ok(r.count >= 0 && r.count <= ROUND_CAP);
        if (r.playerId === round.winnerId) assert.equal(r.count, 0);
        assert.equal(m.players[r.playerId].total, r.count);
    }
});

test('rotates the opening turn and keeps eliminated players out', () => {
    const rng = seededRng(9);
    let m = createMatch({ players: playersOf(3), limit: 30, rng, now: NOW });
    assert.equal(m.game.currentPlayer, 0);
    m = playRound(m, rng);
    const out = m.players.filter((p) => p.eliminatedIn === 1).map((p) => p.id);
    if (m.status === 'ROUND_OVER') {
        m = startNextRound(m, { rng, now: NOW });
        assert.equal(m.roundNumber, 2);
        assert.equal(m.game.currentPlayer, 1 % m.seats.length);
        for (const id of out) assert.equal(seatOf(m, id), -1);
        assert.equal(m.game.players.length, 3 - out.length);
    }
});

test('a low limit eliminates players and the match ends with one survivor', () => {
    const rng = seededRng(5);
    let m = createMatch({ players: playersOf(4), limit: 40, rng, now: NOW });
    for (let rounds = 0; m.status !== 'FINISHED' && rounds < 50; rounds++) {
        m = playRound(m, rng);
        if (m.status === 'ROUND_OVER') m = startNextRound(m, { rng, now: NOW });
    }
    assert.equal(m.status, 'FINISHED');
    const survivors = m.players.filter((p) => p.eliminatedIn === null);
    assert.ok(survivors.length <= 1);
    const { ranked, winners } = standings(m);
    assert.equal(ranked.length, 4);
    if (survivors.length === 1) assert.deepEqual(winners, [survivors[0].id]);
    for (const p of m.players.filter((x) => x.eliminatedIn !== null)) assert.ok(p.total > 40);
});

test('ending early: lowest total wins, ties are shared', () => {
    const m = {
        status: 'ROUND_OVER',
        players: [
            { id: 0, total: 30, eliminatedIn: null },
            { id: 1, total: 12, eliminatedIn: null },
            { id: 2, total: 12, eliminatedIn: null },
            { id: 3, total: 5, eliminatedIn: 2 },
        ],
    };
    const ended = endMatch(m);
    assert.equal(ended.status, 'FINISHED');
    assert.equal(ended.endedEarly, true);
    const { ranked, winners } = standings(ended);
    assert.deepEqual(winners, [1, 2]);
    assert.deepEqual(ranked.map((p) => p.id), [1, 2, 0, 3]);
});

test('actions are rejected between rounds', () => {
    const rng = seededRng(3);
    const m = playRound(createMatch({ players: playersOf(2), rng, now: NOW }), rng);
    assert.match(applyMatchAction(m, 0, { type: 'draw', source: 'deck' }).error, /round is over/);
});
