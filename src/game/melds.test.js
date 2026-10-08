import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MELD, classifyMeld, findDeclaration } from './melds.js';
import { shuffle } from './cards.js';
import { cards, seededRng } from './testUtils.js';

const WILD = '5'; // wildcard rank used in most tests

test('pure sequences, including ace high and low', () => {
    assert.equal(classifyMeld(cards('4♥ 2♥ 3♥'), WILD), MELD.PURE);
    assert.equal(classifyMeld(cards('A♠ 2♠ 3♠'), WILD), MELD.PURE);
    assert.equal(classifyMeld(cards('Q♠ K♠ A♠'), WILD), MELD.PURE);
    assert.equal(classifyMeld(cards('10♦ J♦ Q♦ K♦'), WILD), MELD.PURE);
    // A wildcard-rank card in its natural spot keeps the sequence pure.
    assert.equal(classifyMeld(cards('4♣ 5♣ 6♣'), WILD), MELD.PURE);
});

test('sequences never wrap around K-A-2', () => {
    assert.equal(classifyMeld(cards('K♠ A♠ 2♠'), WILD), MELD.NONE);
});

test('impure sequences use wilds to fill gaps', () => {
    assert.equal(classifyMeld(cards('4♥ JK 6♥'), WILD), MELD.IMPURE);
    assert.equal(classifyMeld(cards('4♥ 5♠ 6♥'), WILD), MELD.IMPURE); // 5♠ is wild, standing in for 5♥
    assert.equal(classifyMeld(cards('Q♥ JK A♥'), WILD), MELD.IMPURE);
    assert.equal(classifyMeld(cards('4♥ JK 8♥'), WILD), MELD.NONE); // gap too big
    assert.equal(classifyMeld(cards('4♥ JK 6♠'), WILD), MELD.NONE); // mixed suits
});

test('sets need one rank and distinct suits, 3 or 4 cards', () => {
    assert.equal(classifyMeld(cards('7♠ 7♥ 7♣'), WILD), MELD.SET);
    assert.equal(classifyMeld(cards('7♠ 7♥ 7♣ 7♦'), WILD), MELD.SET);
    assert.equal(classifyMeld(cards('7♠ 7♥ JK'), WILD), MELD.SET);
    assert.equal(classifyMeld(cards('7♠ 7♠ 7♣'), WILD), MELD.NONE); // duplicate suit
    assert.equal(classifyMeld(cards('7♠ 7♥ 7♣ 7♦ JK'), WILD), MELD.NONE); // too many
    assert.equal(classifyMeld(cards('7♠ 7♥'), WILD), MELD.NONE);
});

const VALID_13 = 'A♥ 2♥ 3♥  9♠ 10♠ JK Q♠  7♣ 7♦ 7♥  K♣ K♦ K♠';

test('declares a valid 13-card hand regardless of card order', () => {
    const hand = cards(VALID_13);
    for (let seed = 1; seed <= 20; seed++) {
        const result = findDeclaration(shuffle(hand, seededRng(seed)), WILD);
        assert.ok(result, `seed ${seed}`);
        assert.equal(result.melds.flatMap((m) => m.cards).length, 13);
        assert.equal(result.discard, null);
    }
});

test('picks the leftover card as the discard in a 14-card hand', () => {
    const hand = cards(`${VALID_13} 9♦`);
    const result = findDeclaration(shuffle(hand, seededRng(7)), WILD);
    assert.ok(result);
    assert.equal(result.discard.rank, '9');
    assert.equal(result.discard.suit, '♦');
});

test('requires a pure sequence', () => {
    // Two impure sequences + sets, but nothing pure.
    const hand = cards('A♥ JK 3♥  9♠ 10♠ 5♦ Q♠  7♣ 7♦ 7♥  K♣ K♦ K♠');
    assert.equal(findDeclaration(hand, WILD), null);
});

test('requires a second sequence', () => {
    const hand = cards('A♥ 2♥ 3♥  9♠ 9♦ 9♣ 9♥  7♣ 7♦ 7♥  K♣ K♦ K♠');
    assert.equal(findDeclaration(hand, WILD), null);
});

test('rejects hands with unmatched cards', () => {
    const hand = cards('A♥ 2♥ 3♥  9♠ 10♠ JK Q♠  7♣ 7♦ 7♥  K♣ K♦ 2♠');
    assert.equal(findDeclaration(hand, WILD), null);
});

test('handles long sequences and wild-heavy hands', () => {
    assert.ok(findDeclaration(cards('2♣ 3♣ 4♣ 5♣ 6♣ 7♣ 8♣ 9♣ 10♣ J♣ Q♣ K♣ A♣'), '9'));
    assert.ok(findDeclaration(cards('2♣ 3♣ 4♣  JK JK 5♠ 5♦  8♥ 9♥ 10♥  J♦ J♠ J♥ 3♦'), WILD));
});
