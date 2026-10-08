import { SUITS, isWild, orderForDisplay, sortCards } from './cards.js';
import { MELD, MELD_NAMES, arrangeHand, classifyMeld } from './melds.js';

/*
 * How the player has arranged their hand: an ordered list of groups, each an
 * ordered list of card ids. This is purely presentational. Declaring checks
 * every possible arrangement, so groups only help the player see their melds.
 * Derived groups get content-based ids so they stay stable across renders.
 */

export const NEW_GROUP = 'new-group';

let counter = 0;
const newGroupId = () => `group-${++counter}`;

export function groupBySuit(hand, wildRank) {
    const sorted = sortCards(hand, 'suit', wildRank);
    const groups = SUITS.map((suit) => ({
        id: `suit-${suit}`,
        cardIds: sorted.filter((c) => !isWild(c, wildRank) && c.suit === suit).map((c) => c.id),
    }));
    groups.push({ id: 'wilds', cardIds: sorted.filter((c) => isWild(c, wildRank)).map((c) => c.id) });
    return groups.filter((g) => g.cardIds.length);
}

// Best melds first (in reading order), then the leftovers by suit.
export function arrangeGroups(hand, wildRank) {
    const { melds, leftover } = arrangeHand(hand, wildRank);
    return [
        ...melds.map((m) => ({
            id: `meld-${m.cards[0].id}`,
            cardIds: orderForDisplay(m.cards, wildRank).map((c) => c.id),
        })),
        ...groupBySuit(leftover, wildRank).map((g) => ({ ...g, id: `rest-${g.id}` })),
    ];
}

// Keeps the player's arrangement in step with the hand: discarded cards vanish,
// newly drawn cards land in their own group at the end.
export function reconcileGroups(groups, hand, wildRank) {
    const inHand = new Set(hand.map((c) => c.id));
    const kept = groups
        .map((g) => ({ ...g, cardIds: g.cardIds.filter((id) => inHand.has(id)) }))
        .filter((g) => g.cardIds.length);
    if (kept.length === 0) return groupBySuit(hand, wildRank);

    const placed = new Set(kept.flatMap((g) => g.cardIds));
    const fresh = hand.filter((c) => !placed.has(c.id)).map((c) => c.id);
    return fresh.length ? [...kept, { id: `fresh-${fresh[0]}`, cardIds: fresh }] : kept;
}

// Moves cards into a group at `index` (default: the end), or into a new group
// when toGroupId is NEW_GROUP. Emptied groups are dropped.
export function moveCards(groups, cardIds, toGroupId, index) {
    const moving = new Set(cardIds);
    let out = groups.map((g) => ({ ...g, cardIds: g.cardIds.filter((id) => !moving.has(id)) }));
    if (toGroupId === NEW_GROUP) {
        out.push({ id: newGroupId(), cardIds: [...cardIds] });
    } else {
        out = out.map((g) => {
            if (g.id !== toGroupId) return g;
            const ids = [...g.cardIds];
            ids.splice(index ?? ids.length, 0, ...cardIds);
            return { ...g, cardIds: ids };
        });
    }
    return out.filter((g) => g.cardIds.length);
}

export function describeGroup(cards, wildRank) {
    if (cards.length < 3) return { type: MELD.NONE, valid: false, label: 'Incomplete' };
    const type = classifyMeld(cards, wildRank);
    return type ? { type, valid: true, label: MELD_NAMES[type] } : { type, valid: false, label: 'Not a meld' };
}

// Progress toward a declaration, judged on the player's current arrangement.
export function handProgress(groupCards, wildRank) {
    let hasPure = false;
    let sequences = 0;
    let unmatched = 0;
    for (const cards of groupCards) {
        const { type, valid } = describeGroup(cards, wildRank);
        if (type === MELD.PURE) hasPure = true;
        if (type >= MELD.IMPURE) sequences += 1;
        if (!valid) unmatched += cards.length;
    }
    return { hasPure, sequences, unmatched };
}
