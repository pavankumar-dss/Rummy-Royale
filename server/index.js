const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
const { validateHand } = require('./validator');

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => res.send('Rummy Royale API Running'));

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

function pickWildcard(deck) {
    let wildcard = deck.pop();
    if (wildcard.value === 'JOKER') {
        wildcard = { suit: 'Any', value: 'A', id: 'wildcard-sub' };
    }
    const discard = [deck.pop()];
    return { wildcard, discard };
}

// --- State Management ---
const rooms = {}; // In-memory storage: { roomId: RoomState }
const TURN_DURATION = 30000; // 30 Seconds

function getClientState(room) {
    checkTimeout(room);
    return {
        ...room,
        deckPileCount: room.deck.length,
        serverTime: Date.now()
    };
}

function checkTimeout(room) {
    if (room.status !== 'PLAYING') return;

    let safety = 0;
    while (Date.now() > room.turnDeadline && safety < 10) {
        safety++;
        console.log(`[Timeout] Player ${room.currentPlayerIndex} missed turn.`);
        
        const player = room.players[room.currentPlayerIndex];
        
        // Scenario 1: Pre-Pick (Still in DRAW phase)
        if (room.turnPhase === 'DRAW') {
             // Skip Turn Logic (Hand size remains 13)
        } 
        
        // Scenario 2: Post-Pick (In DISCARD phase)
        else if (room.turnPhase === 'DISCARD') {
             // Auto-discard the LAST card
             if (player.hand.length > 13) {
                 const discardIdx = player.hand.length - 1;
                 const [discarded] = player.hand.splice(discardIdx, 1);
                 room.discardPile.push(discarded);
                 console.log(`[Timeout] Auto-discarded for Player ${room.currentPlayerIndex}`);
             }
        }

        // Advance Turn
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
        room.turnPhase = 'DRAW';
        room.turnDeadline = Date.now() + TURN_DURATION;

        // Instant Bot Moves
        if (room.players[room.currentPlayerIndex].isAI) {
            handleBotTurns(room);
            room.turnDeadline = Date.now() + TURN_DURATION; 
        }
    }
}

// --- API Endpoints ---

// 1. Create Room
app.post('/api/room/create', (req, res) => {
    const { mode, playerName } = req.body;
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}&backgroundColor=b6e3f4`;

    rooms[roomId] = {
        id: roomId,
        mode, 
        players: [{
            id: 0,
            name: playerName || 'Player 1',
            avatar,
            hand: [],
            melds: [],
            isAI: false
        }],
        deck: [],
        discardPile: [],
        wildcard: null,
        status: 'WAITING',
        turnPhase: 'DRAW',
        currentPlayerIndex: 0,
        turnDeadline: 0
    };

    console.log(`Room created: ${roomId} by ${playerName}`);
    res.json({ roomId, playerIndex: 0 });
});

// 2. Join Room
app.post('/api/room/join', (req, res) => {
    const { roomId, playerName } = req.body;
    const room = rooms[roomId];
    
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.status !== 'WAITING') return res.status(400).json({ error: "Game already started" });
    if (room.players.length >= 6) return res.status(400).json({ error: "Room full" });

    const playerIndex = room.players.length;
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}&backgroundColor=c0aede`;

    room.players.push({
        id: playerIndex,
        name: playerName || `Player ${playerIndex+1}`,
        avatar,
        hand: [],
        melds: [],
        isAI: false
    });

    console.log(`Player ${playerName} joined room ${roomId}`);
    res.json({ roomId, playerIndex });
});

// 3. Start Game
app.post('/api/game/start', (req, res) => {
    const { roomId, addBots } = req.body;
    const room = rooms[roomId];
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Add bots
    if (addBots) {
        const currentCount = room.players.length;
        const botsNeeded = (addBots || 2) - currentCount;
        for (let i = 0; i < botsNeeded; i++) {
             room.players.push({
                id: room.players.length,
                name: `Bot ${i+1}`,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=Bot${i+1}`,
                hand: [],
                melds: [],
                isAI: true
            });
        }
    }

    const numPlayers = room.players.length;
    let requiredDecks = 1;
    if (numPlayers >= 4) requiredDecks = 2;
    if (numPlayers >= 6) requiredDecks = 3;

    let deck = createDeck(requiredDecks);
    deck = shuffleDeck(deck);

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
    room.turnDeadline = Date.now() + TURN_DURATION;

    res.json(getClientState(room));
});

// 4. Get State
app.get('/api/game/:roomId', (req, res) => {
    const room = rooms[req.params.roomId];
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(getClientState(room));
});

// 5. Draw
app.post('/api/game/:roomId/draw', (req, res) => {
    const { source, playerIndex } = req.body; 
    const room = rooms[req.params.roomId];
    if (!room) return res.status(404).json({ error: "Room not found" });
    
    checkTimeout(room);
    if (room.currentPlayerIndex !== playerIndex) return res.status(403).json({ error: "Turn Expired!" });

    if (room.turnPhase !== 'DRAW') return res.status(400).json({ error: "You must discard a card first" });

    if (source === 'deck') {
        if (room.deck.length === 0) {
             if (room.discardPile.length <= 1) return res.status(400).json({ error: "No cards left" });
             const top = room.discardPile.pop();
             const newDeck = shuffleDeck([...room.discardPile]);
             room.discardPile = [top];
             room.deck = newDeck;
        }
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
    
    checkTimeout(room);
    if (room.currentPlayerIndex !== playerIndex) return res.status(403).json({ error: "Turn Expired!" });

    if (room.turnPhase !== 'DISCARD') return res.status(400).json({ error: "You need to draw a card first" });

    const player = room.players[playerIndex];
    const idx = player.hand.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (idx === -1) return res.status(400).json({ error: "Card not in hand" });

    const [discarded] = player.hand.splice(idx, 1);
    room.discardPile.push(discarded);

    // End Turn
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    room.turnPhase = 'DRAW';
    room.turnDeadline = Date.now() + TURN_DURATION;

    if (room.players[room.currentPlayerIndex].isAI) {
        handleBotTurns(room);
        room.turnDeadline = Date.now() + TURN_DURATION;
    }

    res.json(getClientState(room));
});

// 7. Reorder
app.post('/api/game/:roomId/reorder', (req, res) => {
    const { playerIndex, newHand } = req.body;
    const room = rooms[req.params.roomId];
    if (!room) return res.status(404).json({ error: "Room not found" });

    const player = room.players[playerIndex];
    const currentIds = new Set(player.hand.map(c => c.id).sort());
    const newIds = new Set(newHand.map(c => c.id).sort());
    
    if (currentIds.size !== newIds.size || ![...currentIds].every(id => newIds.has(id))) {
        return res.status(400).json({ error: "Invalid hand state" });
    }

    player.hand = newHand;
    res.json({ success: true });
});

// 8. Show
app.post('/api/game/:roomId/show', (req, res) => {
    const { playerIndex } = req.body;
    const room = rooms[req.params.roomId];
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.currentPlayerIndex !== playerIndex) return res.status(403).json({ error: "Not your turn" });

    const isValid = validateHand(room.players[playerIndex].hand, room.wildcard);
    if (!isValid) {
        return res.status(400).json({ error: "Invalid Hand! Must have 1 Pure Seq + 1 Other Seq + Valid Sets." });
    }

    room.status = 'FINISHED';
    room.winner = room.players[playerIndex].name;
    res.json(getClientState(room));
});

function handleBotTurns(room) {
    let safety = 0;
    while (room.players[room.currentPlayerIndex].isAI && safety < 10) {
        safety++;
        const bot = room.players[room.currentPlayerIndex];
        
        if (room.deck.length > 0) {
            bot.hand.push(room.deck.pop());
        } else if (room.discardPile.length > 0) {
             bot.hand.push(room.discardPile.pop());
        } else {
             break;
        }

        const discardIdx = Math.floor(Math.random() * bot.hand.length);
        const [discarded] = bot.hand.splice(discardIdx, 1);
        room.discardPile.push(discarded);

        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
        room.turnPhase = 'DRAW';
    }
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
