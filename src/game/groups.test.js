import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEW_GROUP, arrangeGroups, describeGroup, groupBySuit, handProgress, moveCards, reconcileGroups } from './groups.js';
import { orderForDisplay } from './cards.js';
import { cards } from './testUtils.js';

const WILD = '5';
const labels = (list) => list.map((c) => (c.rank === 'JOKER' ? 'JK' : c.rank + c.suit)).join(' ');

test('orderForDisplay lays out runs with wilds in the gaps', () => {
    assert.equal(labels(orderForDisplay(cards('6♥ JK 4♥'), WILD)), '4♥ JK 6♥');
    assert.equal(labels(orderForDisplay(cards('A♠ Q♠ K♠'), WILD)), 'Q♠ K♠ A♠');
    assert.equal(labels(orderForDisplay(cards('3♣ A♣ 2♣'), WILD)), 'A♣ 2♣ 3♣');
    assert.equal(labels(orderForDisplay(cards('J♦ 5♠ 9♦'), WILD)), '9♦ 5♠ J♦');
});

test('groupBySuit puts wilds in their own group', () => {
    const hand = cards('K♠ 2♥ 5♣ JK 3♠ 9♥');
    const groups = groupBySuit(hand, WILD);
    assert.deepEqual(groups.map((g) => g.id), ['suit-♠', 'suit-♥', 'wilds']);
    assert.equal(groups.flatMap((g) => g.cardIds).length, hand.length);
});

test('reconcileGroups drops missing cards and adds fresh ones as a new group', () => {
    const hand = cards('A♠ 2♠ 3♠ 7♥');
    const groups = [{ id: 'g', cardIds: hand.slice(0, 3).map((c) => c.id) }, { id: 'h', cardIds: [hand[3].id] }];
    const drawn = cards('9♦');
    const afterDraw = reconcileGroups(groups, [...hand, ...drawn], WILD);
    assert.equal(afterDraw.length, 3);
    assert.deepEqual(afterDraw.at(-1).cardIds, [drawn[0].id]);

    const afterDiscard = reconcileGroups(groups, hand.slice(0, 3), WILD);
    assert.deepEqual(afterDiscard.map((g) => g.id), ['g']);
});

test('reconcileGroups starts from suit groups for a fresh hand', () => {
    const hand = cards('A♠ 2♥');
    assert.deepEqual(reconcileGroups([], hand, WILD).map((g) => g.id), ['suit-♠', 'suit-♥']);
});

test('moveCards moves between groups, into new groups, and drops empties', () => {
    const groups = [{ id: 'a', cardIds: ['1', '2'] }, { id: 'b', cardIds: ['3'] }];
    assert.deepEqual(moveCards(groups, ['3'], 'a', 1), [{ id: 'a', cardIds: ['1', '3', '2'] }]);
    const split = moveCards(groups, ['1', '3'], NEW_GROUP);
    assert.deepEqual(split.map((g) => g.cardIds), [['2'], ['1', '3']]);
});

test('arrangeGroups finds the melds and keeps every card exactly once', () => {
    const hand = cards('A♥ 2♥ 3♥  9♠ 10♠ JK Q♠  7♣ 7♦ 7♥  K♣ 2♦ 8♠');
    const groups = arrangeGroups(hand, WILD);
    const ids = groups.flatMap((g) => g.cardIds);
    assert.equal(ids.length, hand.length);
    assert.equal(new Set(ids).size, hand.length);
    const byId = new Map(hand.map((c) => [c.id, c]));
    const valid = groups.filter((g) => describeGroup(g.cardIds.map((id) => byId.get(id)), WILD).valid);
    assert.equal(valid.length, 3);
});

test('handProgress summarises the arrangement', () => {
    const progress = handProgress([cards('A♥ 2♥ 3♥'), cards('9♠ JK J♠'), cards('7♣ 7♦'), cards('K♣')], WILD);
    assert.deepEqual(progress, { hasPure: true, sequences: 2, unmatched: 3 });
});
