const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// --- Game Logic Helpers ---
// --- Game Logic Helpers ---
const suits = ['♠', '♥', '♣', '♦'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck(numDecks = 1) {
    let deck = [];
    for (let d = 0; d < numDecks; d++) {
        for (const suit of suits) {
            for (const value of values) {
                deck.push({ suit, value, id: `${d}-${suit}-${value}` });
            }
        }
        deck.push({ suit: 'Joker', value: 'JOKER', id: `${d}-JOKER` });
    }
    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCards(deck, numPlayers) {
    let players = [];
    for (let i = 0; i < numPlayers; i++) {
        players.push({
            id: i, // ID will be reassigned in multiplayer
            name: `Player ${i+1}`,
            hand: deck.splice(0, 13),
            melds: [],
            isAI: false // Default to false, set true for bots
        });
    }
    return players;
}

function pickWildcard(deck) {
    let wildcard = deck.pop();
    if (wildcard.value === 'JOKER') {
        wildcard = { suit: 'Any', value: 'A', id: 'wildcard-sub' };
    }
    const discard = [deck.pop()];
    return { wildcard, discard };
}

// ... (State code unchanged) ...

// 3. Start Game
app.post('/api/game/start', (req, res) => {
    const { roomId, addBots } = req.body;
    const room = rooms[roomId];
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Add bots if requested (Singleplayer)
    if (addBots) {
        const currentCount = room.players.length;
        const botsNeeded = (addBots || 2) - currentCount;
        for (let i = 0; i < botsNeeded; i++) {
             room.players.push({
                id: room.players.length,
                name: `Bot ${i+1}`,
                hand: [],
                melds: [],
                isAI: true
            });
        }
    }

    const numPlayers = room.players.length;
    // Rule of thumb: 1 deck for 2-3 players, 2 decks for 4+ players
    const numDecks = Math.ceil(numPlayers / 2); // 2->1, 3->2, 4->2, 5->3  (Adjusted slightly for safer margin)
    // Actually standard rummy: 2 player=1 deck, 3-4 = 2 decks, 5+ = 3 decks.
    // Let's use: < 3 players = 1 deck, >= 3 players = 2 decks, > 4 = 3 decks.
    
    let requiredDecks = 1;
    if (numPlayers > 2) requiredDecks = 2;
    if (numPlayers > 5) requiredDecks = 3;

    let deck = createDeck(requiredDecks);
    deck = shuffleDeck(deck);

    // Deal
    // ...


    // Deal
    room.players.forEach(p => {
        p.hand = deck.splice(0, 13);
    });

    const { wildcard, discard } = pickWildcard(deck);
    room.wildcard = wildcard;
    room.discardPile = discard;
    room.deck = deck;
    room.status = 'PLAYING';
    room.turnPhase = 'DRAW';
    room.currentPlayerIndex = 0;

    res.json(getClientState(room));
});

// 4. Get State (Polling)
app.get('/api/game/:roomId', (req, res) => {
    const room = rooms[req.params.roomId];
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(getClientState(room));
});

// 5. Draw
app.post('/api/game/:roomId/draw', (req, res) => {
    const { source, playerIndex } = req.body; // source: 'deck' or 'discard'
    const room = rooms[req.params.roomId];
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.currentPlayerIndex !== playerIndex) return res.status(403).json({ error: "Not your turn" });
    if (room.turnPhase !== 'DRAW') return res.status(400).json({ error: "You must discard a card first" });

    if (source === 'deck') {
        if (room.deck.length === 0) return res.status(400).json({ error: "Deck empty" });
        const card = room.deck.pop();
        room.players[playerIndex].hand.push(card);
    } else {
         if (room.discardPile.length === 0) return res.status(400).json({ error: "Discard empty" });
         const card = room.discardPile.pop();
         room.players[playerIndex].hand.push(card);
    }

    room.turnPhase = 'DISCARD';
    res.json(getClientState(room));
});

// 6. Discard
app.post('/api/game/:roomId/discard', (req, res) => {
    const { card, playerIndex } = req.body;
    const room = rooms[req.params.roomId];
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.currentPlayerIndex !== playerIndex) return res.status(403).json({ error: "Not your turn" });
    if (room.turnPhase !== 'DISCARD') return res.status(400).json({ error: "You need to draw a card first" });

    const player = room.players[playerIndex];
    const idx = player.hand.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (idx === -1) return res.status(400).json({ error: "Card not in hand" });

    const [discarded] = player.hand.splice(idx, 1);
    room.discardPile.push(discarded);

    // End Turn
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    room.turnPhase = 'DRAW';

    // Handle Bot Turns immediately (simplified)
    if (room.players[room.currentPlayerIndex].isAI) {
        handleBotTurns(room);
    }

    res.json(getClientState(room));
});

function handleBotTurns(room) {
    // Simple Loop for all consecutive bots
    while (room.players[room.currentPlayerIndex].isAI) {
        const bot = room.players[room.currentPlayerIndex];
        // Bot Draw
        if (room.deck.length > 0) {
            bot.hand.push(room.deck.pop());
        } else if (room.discardPile.length > 0) {
             bot.hand.push(room.discardPile.pop());
        } else {
             break; // Stuck
        }

        // Bot Discard (Random)
        const discardIdx = Math.floor(Math.random() * bot.hand.length);
        const [discarded] = bot.hand.splice(discardIdx, 1);
        room.discardPile.push(discarded);

        // Next
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
        room.turnPhase = 'DRAW';
    }
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
