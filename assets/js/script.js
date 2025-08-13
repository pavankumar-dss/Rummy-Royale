// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const startGameBtn = document.getElementById('start-game-btn');
const playerNameInput = document.getElementById('player-name');
const numPlayersInput = document.getElementById('num-players');

const tableTop = document.getElementById('table-top');
const deckPile = document.getElementById('deck-pile');
const discardPile = document.getElementById('discard-pile');
const wildcardPile = document.getElementById('wildcard-pile');
const currentPlayerNameEl = document.getElementById('current-player-name');

const ungroupedCardsContainer = document.getElementById('ungrouped-cards');
const groupedCardsContainer = document.getElementById('grouped-cards');
const groupingActions = document.getElementById('grouping-actions');
const groupSetBtn = document.getElementById('group-set-btn');
const groupSeqBtn = document.getElementById('group-seq-btn');
const sortBtn = document.getElementById('sort-btn');
const declareBtn = document.getElementById('declare-btn');

const declareModal = document.getElementById('declare-modal');
const declareHandSource = document.getElementById('declare-hand-source');
const meldGroupsContainer = document.getElementById('meld-groups-container');
const validateShowBtn = document.getElementById('validate-show-btn');
const cancelDeclareBtn = document.getElementById('cancel-declare-btn');

const messageModal = document.getElementById('message-modal');
const messageModalTitle = document.getElementById('message-modal-title');
const messageModalBody = document.getElementById('message-modal-body');
const messageModalFooter = document.getElementById('message-modal-footer');

// --- Game State ---
let players = [];
let deck = [];
let discard = [];
let wildcard = null;
let currentPlayerIndex = 0;
let draggedCardEl = null;
let isPlayerTurn = false;
let isGameOver = false;
let currentSortState = 'suit';
let selectedCards = new Set();

// --- Card Definitions ---
const suits = ['♠', '♥', '♣', '♦'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suitColors = { '♠': 'spades', '♥': 'hearts', '♣': 'clubs', '♦': 'diamonds' };
const suitOrder = { '♠': 1, '♥': 2, '♣': 3, '♦': 4 };

// --- Game Logic ---

function createDeck() {
    deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    deck.push({ suit: 'Joker', value: 'JOKER' });
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function dealCards(numPlayers) {
    players = [];
    for (let i = 0; i < numPlayers; i++) {
        players.push({
            name: i === 0 ? playerNameInput.value : `AI ${i}`,
            hand: deck.splice(0, 13),
            melds: [],
            isAI: i !== 0
        });
    }
}

function getCardNumericValue(cardValue) {
    if (cardValue === 'A') return 1;
    if (cardValue === 'J') return 11;
    if (cardValue === 'Q') return 12;
    if (cardValue === 'K') return 13;
    if (cardValue === 'JOKER') return 99;
    return parseInt(cardValue);
}

function pickWildcard() {
    wildcard = deck.pop();
    if (wildcard.value === 'JOKER') {
        wildcard = { suit: 'Any', value: 'A' };
    }
    discard.push(deck.pop());
}

function cardToSimpleString(card) {
    if (!card) return '';
    if (card.value === 'JOKER') return 'JOKER';
    return card.suit + card.value;
}

function renderCard(card, isFaceDown = false) {
    const cardEl = document.createElement('div');
    cardEl.classList.add('card');
    if (isFaceDown || !card) { 
         cardEl.classList.add('card-back');
    } else {
        cardEl.dataset.suit = card.suit;
        cardEl.dataset.value = card.value;
        cardEl.draggable = true;

        if (card.value === 'JOKER') {
            cardEl.classList.add('joker');
            cardEl.innerHTML = `<span>JOKER</span>`;
        } else {
            cardEl.classList.add(suitColors[card.suit]);
            cardEl.innerHTML = `
                <span class="value">${card.value}</span>
                <span class="suit">${card.suit}</span>
                <span class="value-bottom">${card.value}</span>
            `;
        }
    }
    return cardEl;
}

function renderAllHands() {
    renderPlayerHand();
    renderOpponentHands();
}

function renderPlayerHand() {
    ungroupedCardsContainer.innerHTML = '';
    groupedCardsContainer.innerHTML = '';
    const player = players[0];

    player.hand.forEach(card => {
        const cardEl = renderCard(card);
        cardEl.addEventListener('click', () => toggleCardSelection(card, cardEl));
        addDragAndDrop(cardEl);
        ungroupedCardsContainer.appendChild(cardEl);
    });

    player.melds.forEach((meld, index) => {
        const meldGroupEl = document.createElement('div');
        meldGroupEl.classList.add('meld-group');
        meld.forEach(card => {
            const cardEl = renderCard(card);
            cardEl.addEventListener('click', () => ungroupMeld(index));
            meldGroupEl.appendChild(cardEl);
        });
        groupedCardsContainer.appendChild(meldGroupEl);
    });
    checkDeclareState();
}

function renderOpponentHands() {
    document.querySelectorAll('.opponent-area').forEach(el => el.remove());
    players.slice(1).forEach((player, index) => {
        const opponentArea = document.createElement('div');
        opponentArea.classList.add('opponent-area');
        opponentArea.id = `opponent-area-${index}`;
        
        const fanContainer = document.createElement('div');
        fanContainer.classList.add('opponent-fan');

        const angle = 40;
        const cardCount = player.hand.length + player.melds.flat().length;
        const startAngle = -angle / 2;
        const angleStep = cardCount > 1 ? angle / (cardCount - 1) : 0;

        for(let i = 0; i < cardCount; i++) {
            const cardEl = renderCard(null, true);
            const rotation = startAngle + (i * angleStep);
            cardEl.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
            fanContainer.appendChild(cardEl);
        }

        opponentArea.appendChild(fanContainer);
        tableTop.appendChild(opponentArea);

        if (players.length - 1 === 1) {
            opponentArea.style.top = '20px';
            opponentArea.style.left = '50%';
        }
    });
}

function renderTable() {
    wildcardPile.innerHTML = '';
    if (wildcard) wildcardPile.appendChild(renderCard(wildcard));

    discardPile.innerHTML = '';
    if (discard.length > 0) {
        const topCard = discard[discard.length - 1];
        const cardEl = renderCard(topCard);
        cardEl.addEventListener('click', () => drawFromDiscard());
        discardPile.appendChild(cardEl);
    }
}

function showModalMessage(title, content) {
    messageModalTitle.textContent = title;
    messageModalBody.textContent = content;
    messageModal.classList.remove('hidden');
}

function resetGame() {
    isGameOver = false;
    players = [];
    deck = [];
    discard = [];
    wildcard = null;
    currentPlayerIndex = 0;
    messageModal.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

function startGame() {
    const numPlayers = parseInt(numPlayersInput.value);
    if (numPlayers < 2 || numPlayers > 7) {
        showModalMessage("Invalid Input", "Please enter a number of players between 2 and 7.");
        return;
    }
    
    isGameOver = false;
    startScreen.classList.add('hidden');
    
    createDeck();
    shuffleDeck();
    dealCards(numPlayers);
    pickWildcard();
    renderAllHands();
    renderTable();
    startTurn();
}

function startTurn() {
    if (isGameOver) return;
    isPlayerTurn = currentPlayerIndex === 0;
    updateCurrentPlayerDisplay();

    if (players[currentPlayerIndex].isAI) {
        setTimeout(playAITurn, 1500);
    }
}

function updateCurrentPlayerDisplay() {
    currentPlayerNameEl.textContent = `${players[currentPlayerIndex].name}'s turn`;
}

function drawFromDeck() {
    if (!isPlayerTurn || players[0].hand.length + players[0].melds.flat().length >= 14) return;
    const drawnCard = deck.pop();
    if (drawnCard) {
        players[0].hand.push(drawnCard);
        renderPlayerHand();
    }
}

function drawFromDiscard() {
    if (!isPlayerTurn || players[0].hand.length + players[0].melds.flat().length >= 14) return;
    if (discard.length > 0) {
        const drawnCard = discard.pop();
        players[0].hand.push(drawnCard);
        renderPlayerHand();
        renderTable();
    }
}

function discardCard(cardData) {
    if (!isPlayerTurn) return;
    if (players[0].hand.length + players[0].melds.flat().length !== 14) {
         showModalMessage("Invalid Move", "You must draw a card to have 14 cards before you can discard.");
         return;
    }
    
    const cardIndex = players[0].hand.findIndex(c => c.value === cardData.value && c.suit === cardData.suit);
    if (cardIndex > -1) {
        const [discardedCard] = players[0].hand.splice(cardIndex, 1);
        discard.push(discardedCard);
        
        renderPlayerHand();
        renderTable();
        endTurn();
    }
}

function endTurn() {
    isPlayerTurn = false;
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    startTurn();
}

function playAITurn() {
    if (isGameOver) return;
    const aiPlayer = players[currentPlayerIndex];
    
    const drawnCard = deck.pop();
    if(drawnCard) aiPlayer.hand.push(drawnCard);
    else { endTurn(); return; }

    const discardIndex = Math.floor(Math.random() * aiPlayer.hand.length);
    const [discardedCard] = aiPlayer.hand.splice(discardIndex, 1);
    discard.push(discardedCard);

    renderOpponentHands();
    renderTable();
    endTurn();
}

// --- In-Game Melding Logic ---
function toggleCardSelection(card, cardEl) {
    const cardStr = cardToSimpleString(card);
    if (selectedCards.has(cardStr)) {
        selectedCards.delete(cardStr);
        cardEl.classList.remove('selected');
    } else {
        selectedCards.add(cardStr);
        cardEl.classList.add('selected');
    }
    groupingActions.classList.toggle('hidden', selectedCards.size === 0);
}

function groupSelected(isSet) {
    const player = players[0];
    const cardsToGroup = [];
    player.hand = player.hand.filter(card => {
        if (selectedCards.has(cardToSimpleString(card))) {
            cardsToGroup.push(card);
            return false;
        }
        return true;
    });

    const validationResult = isSet ? isMeldASet(cardsToGroup) : isMeldASequence(cardsToGroup);
    if (cardsToGroup.length < 3 || !validationResult.valid) {
         showModalMessage("Invalid Group", `The selected cards do not form a valid ${isSet ? 'set' : 'sequence'}.`);
         player.hand.push(...cardsToGroup);
    } else {
        player.melds.push(cardsToGroup);
    }
    
    selectedCards.clear();
    groupingActions.classList.add('hidden');
    renderPlayerHand();
}

function ungroupMeld(meldIndex) {
    const player = players[0];
    const cardsToUngroup = player.melds.splice(meldIndex, 1)[0];
    player.hand.push(...cardsToUngroup);
    renderPlayerHand();
}

function checkDeclareState() {
    const player = players[0];
    const totalCardsInHand = player.hand.length;
    const totalCardsInMelds = player.melds.flat().length;

    if (totalCardsInHand === 0 && totalCardsInMelds === 13) {
         declareBtn.disabled = false;
         declareBtn.classList.remove('disabled:bg-gray-500');
    } else {
         declareBtn.disabled = true;
         declareBtn.classList.add('disabled:bg-gray-500');
    }
}

function triggerConfetti() {
    var duration = 5 * 1000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
    function randomInRange(min, max) { return Math.random() * (max - min) + min; }
    var interval = setInterval(function() {
        var timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        var particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

function handleWin() {
    isGameOver = true;
    triggerConfetti();
    showModalMessage("Congratulations!", `${players[0].name} wins the game!`);
    
    messageModalFooter.innerHTML = '';
    const playAgainBtn = document.createElement('button');
    playAgainBtn.textContent = 'Play Again';
    playAgainBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white', 'font-bold', 'py-2', 'px-8', 'rounded-lg');
    playAgainBtn.addEventListener('click', resetGame);
    messageModalFooter.appendChild(playAgainBtn);
}

function validateShow() {
    const sequenceCount = players[0].melds.filter(m => isMeldASequence(m).valid).length;
    const pureSequenceCount = players[0].melds.filter(m => isMeldASequence(m).isPure).length;
    
    if (sequenceCount < 2) {
        showModalMessage("Validation Failed", "You need at least two sequences."); return;
    }
    if (pureSequenceCount < 1) {
        showModalMessage("Validation Failed", "You need at least one pure sequence."); return;
    }
    
    handleWin();
}

function isJokerOrWildcard(card) {
    return card.value === 'JOKER' || card.value === wildcard.value;
}

function isMeldASet(cards) {
    if (cards.length < 3) return { valid: false };
    let jokers = 0; const nonJokers = [];
    cards.forEach(c => { if (isJokerOrWildcard(c)) jokers++; else nonJokers.push(c); });
    if (nonJokers.length === 0) return { valid: false };
    const value = nonJokers[0].value; const suits = new Set();
    for (const card of nonJokers) {
        if (card.value !== value || suits.has(card.suit)) return { valid: false };
        suits.add(card.suit);
    }
    return { valid: true };
}

function isMeldASequence(cards) {
     if (cards.length < 3) return { valid: false };
    let jokers = 0; const nonJokers = [];
    cards.forEach(c => { if (isJokerOrWildcard(c)) jokers++; else nonJokers.push(c); });
    if (nonJokers.length === 0) return { valid: false };
    const suit = nonJokers[0].suit;
    for (const card of nonJokers) { if (card.suit !== suit) return { valid: false }; }
    nonJokers.sort((a, b) => getCardNumericValue(a.value) - getCardNumericValue(b.value));
    let gaps = 0;
    for (let i = 0; i < nonJokers.length - 1; i++) {
        const diff = getCardNumericValue(nonJokers[i+1].value) - getCardNumericValue(nonJokers[i].value);
        if (diff === 0) return { valid: false };
        gaps += diff - 1;
    }
    if (gaps > jokers) return { valid: false };
    return { valid: true, isPure: jokers === 0 };
}

// --- Drag and Drop Listeners ---
function addDragAndDrop(element) {
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    draggedCardEl = e.target;
    setTimeout(() => e.target.classList.add('dragging'), 0);
}

function handleDragEnd(e) {
    if (draggedCardEl) {
        draggedCardEl.classList.remove('dragging');
    }
    draggedCardEl = null;
}

ungroupedCardsContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(ungroupedCardsContainer, e.clientX);
    if (draggedCardEl) {
        if (afterElement == null) {
            ungroupedCardsContainer.appendChild(draggedCardEl);
        } else {
            ungroupedCardsContainer.insertBefore(draggedCardEl, afterElement);
        }
    }
});

ungroupedCardsContainer.addEventListener('drop', () => {
    const player = players[0];
    const newHandOrder = Array.from(ungroupedCardsContainer.children).map(el => {
        return player.hand.find(c => c.suit === el.dataset.suit && c.value === el.dataset.value) 
               || { suit: el.dataset.suit, value: el.dataset.value };
    });
    player.hand = newHandOrder;
    renderPlayerHand();
});

function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

discardPile.addEventListener('dragover', (e) => e.preventDefault());
discardPile.addEventListener('drop', (e) => {
    e.preventDefault();
    if(!draggedCardEl) return;
    const cardData = { suit: draggedCardEl.dataset.suit, value: draggedCardEl.dataset.value };
    discardCard(cardData);
});


// --- Event Listeners ---
startGameBtn.addEventListener('click', startGame);

sortBtn.addEventListener('click', () => {
    const player = players[0];
    if (currentSortState === 'suit') {
        player.hand.sort((a, b) => getCardNumericValue(a.value) - getCardNumericValue(b.value));
        currentSortState = 'value';
    } else {
        player.hand.sort((a, b) => {
            if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
            return getCardNumericValue(a.value) - getCardNumericValue(b.value);
        });
        currentSortState = 'suit';
    }
    renderPlayerHand();
});

declareBtn.addEventListener('click', validateShow);
deckPile.addEventListener('click', drawFromDeck);
groupSetBtn.addEventListener('click', () => groupSelected(true));
groupSeqBtn.addEventListener('click', () => groupSelected(false));

messageModal.addEventListener('click', (e) => {
    const closeButton = e.target.closest('#message-modal-close-btn');
    if (closeButton) {
        messageModal.classList.add('hidden');
        messageModalFooter.innerHTML = `<button id="message-modal-close-btn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-8 rounded-lg mt-auto">OK</button>`;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    messageModal.classList.add('hidden');
});
