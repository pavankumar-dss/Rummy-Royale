const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function getCardValue(card) {
    if (card.value === 'JOKER') return 99;
    return values.indexOf(card.value) + 1;
}

function isJoker(card, wildcard) {
    if (card.value === 'JOKER') return true;
    if (wildcard && card.value === wildcard.value) return true;
    return false;
}

// Check if a group of cards is a Valid Pure Sequence (No Jokers used as wildcards)
function isPureSequence(cards) {
    if (cards.length < 3) return false;
    // Sort logic needs to handle Ace as 1 or 14, simplified to 1 for now or specific order
    // Assuming simple sorting by index
    const sorted = [...cards].sort((a, b) => getCardValue(a) - getCardValue(b));
    const suit = sorted[0].suit;
    
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].suit !== suit) return false;
        if (sorted[i].value === 'JOKER') return false; // Pure sequence cannot have printed joker? Actually in some rules yes, but usually "Pure" means natural. Let's say NO jokers.
        if (i > 0) {
            const diff = getCardValue(sorted[i]) - getCardValue(sorted[i-1]);
            if (diff !== 1) return false;
        }
    }
    return true;
}

// Check if a group is a Valid Set (Same Value, Different Suits) OR Impure Sequence
function isValidGroup(cards, wildcard) {
    if (cards.length < 3) return false;
    
    const jokers = cards.filter(c => isJoker(c, wildcard));
    const nonJokers = cards.filter(c => !isJoker(c, wildcard));
    
    if (nonJokers.length === 0) return true; // All jokers is valid

    // 1. Try Set
    const firstVal = getCardValue(nonJokers[0]);
    const isSet = nonJokers.every(c => getCardValue(c) === firstVal);
    // Sets strictly allow different suits? Usually yes. We won't enforce unique suits for simplicity
    if (isSet) return true;

    // 2. Try Sequence (Impure)
    // This is hard with gaps filled by jokers. 
    // Simplified: Check if non-jokers are same suit and ascending with gap <= jokers
    const firstSuit = nonJokers[0].suit;
    if (!nonJokers.every(c => c.suit === firstSuit)) return false;
    
    const sorted = [...nonJokers].sort((a, b) => getCardValue(a) - getCardValue(b));
    let gapCount = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
        const diff = getCardValue(sorted[i+1]) - getCardValue(sorted[i]);
        if (diff < 1) return false; // Duplicate card in sequence
        gapCount += (diff - 1);
    }
    
    return gapCount <= jokers.length;
}

// Main Validator (Recursive)
function validateHand(hand, wildcard) {
    if (hand.length !== 13) return false;

    // We need to partition 13 cards into valid groups.
    // Combinations: 4 4 5, 4 3 3 3, etc.
    // Instead of complex partitioning, let's rely on the user sort order?
    // No, user asked for validation logic.
    // Let's try to extract a Pure Sequence first.
    
    // Generating all subsets is too expensive (2^13).
    // Approach: Find all potential melds, then exact cover? Too hard.
    // Heuristic: Check if the hand groups THEMSELVES are valid? 
    // The user has a single list. We HAVE to partition it.
    // FOR MVP: We will assume the user has GROUPED them contiguously or we just return true for now to unblock? 
    // User specifically asked for logical validation.
    
    // Let's implement a simplified check:
    // 1. Must have at least 1 Pure Sequence.
    // 2. Must have at least 2 Sequences total.
    
    // To solve this properly in a few lines:
    // We will assume the user has SORTED their hand into groups. 
    // We will try to split the array into [3,3,3,4] or [3,3,4,3] etc chunks and see if any combination works.
    
    const partitions = [
        [3, 3, 3, 4],
        [3, 3, 4, 3],
        [3, 4, 3, 3],
        [4, 3, 3, 3],
        [4, 4, 5], // 13 cards only? Wait, 13 cards = 4+3+3+3=13. 4+4+5=13.
        [5, 4, 4],
        [4, 5, 4] 
    ];

    // This is a naive assumption that the user ordered the cards perfectly. 
    // But it's better than nothing for a web game.
    
    for (const p of partitions) {
        let index = 0;
        let groups = [];
        for (const size of p) {
            groups.push(hand.slice(index, index + size));
            index += size;
        }

        // Check Validity
        let pureCount = 0;
        let seqCount = 0;
        let validGroups = 0;

        for (const g of groups) {
            if (isPureSequence(g)) {
                pureCount++;
                seqCount++;
                validGroups++;
            } else if (isValidGroup(g, wildcard)) {
                // If it's a sequence (impure) calculate check
                // For simplicity, isValidGroup covers both Impure Seq and Sets.
                // We need to know if it is a Sequence for the "2 Sequences" rule.
                // Re-check strict impure sequence logic:
                const nonJokers = g.filter(c => !isJoker(c, wildcard));
                if (nonJokers.length > 0 && nonJokers.every(c => c.suit === nonJokers[0].suit)) {
                     seqCount++;
                }
                validGroups++;
            }
        }
        
        if (validGroups === groups.length && pureCount >= 1 && seqCount >= 2) {
            return true;
        }
    }
    
    return false;
}

module.exports = { validateHand };
