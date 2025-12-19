import React, { useState, useEffect } from 'react';
import Card from './components/Card';
import Lobby from './components/Lobby';
import axios from 'axios';
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const API_URL = 'http://localhost:3000/api';

// --- Sortable Card Wrapper ---
const SortableCard = ({ card, onClick, disabled }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
    
    // We want click to trigger discard, but drag to sort. 
    // dnd-kit handles this well.
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 999 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
             <Card card={card} onClick={onClick} hoverClass={!disabled ? "hover:-translate-y-4 cursor-pointer" : "cursor-default opacity-80"} />
        </div>
    );
};

// --- Utils for Sorting ---
const suitOrder = { '♠': 1, '♥': 2, '♣': 3, '♦': 4 };
const getCardNumericValue = (cardValue) => {
    if (cardValue === 'A') return 1;
    if (cardValue === 'J') return 11;
    if (cardValue === 'Q') return 12;
    if (cardValue === 'K') return 13;
    if (cardValue === 'JOKER') return 99;
    return parseInt(cardValue);
};

function App() {
  const [gameState, setGameState] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(null);
  const [activeId, setActiveId] = useState(null); // For drag overlay
  const [sortState, setSortState] = useState('suit'); // 'suit' or 'value'

  // Polling for Updates
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(async () => {
        try {
            const res = await axios.get(`${API_URL}/game/${roomId}`);
            setGameState(prev => {
                const newState = res.data;
                if (!prev) return newState;
                // Ideally we merge state to avoid jitter, but for now simplified overwrite is okay 
                // as long as we don't block user interaction.
                return newState; 
            });
        } catch (err) { console.error(err); }
    }, 2000);
    return () => clearInterval(interval);
  }, [roomId]);

  const onJoinGame = (room, pIndex) => {
      setRoomId(room);
      setMyPlayerIndex(pIndex);
      // Fetch initial state
      axios.get(`${API_URL}/game/${room}`).then(res => setGameState(res.data));
  };

  const startGameMulti = async () => {
      await axios.post(`${API_URL}/game/start`, { roomId });
  };

  const drawFromDeck = async () => {
      if (!isMyTurn || gameState.turnPhase !== 'DRAW') return;
      try {
          const res = await axios.post(`${API_URL}/game/${roomId}/draw`, { source: 'deck', playerIndex: myPlayerIndex });
          setGameState(res.data);
      } catch (err) { alert(err.response?.data?.error); }
  };

  const drawFromDiscard = async () => {
      if (!isMyTurn || gameState.turnPhase !== 'DRAW') return;
      try {
          const res = await axios.post(`${API_URL}/game/${roomId}/draw`, { source: 'discard', playerIndex: myPlayerIndex });
          setGameState(res.data);
      } catch (err) { alert(err.response?.data?.error); }
  };

  const discardCard = async (card) => {
      if (!isMyTurn || gameState.turnPhase !== 'DISCARD') return;
      try {
          const res = await axios.post(`${API_URL}/game/${roomId}/discard`, { card, playerIndex: myPlayerIndex });
          setGameState(res.data);
      } catch (err) { alert(err.response?.data?.error); }
  };

  const sortHand = () => {
      setGameState(prev => {
          if (!prev) return null;
          const player = prev.players[myPlayerIndex];
          const newHand = [...player.hand];

          if (sortState === 'suit') {
            newHand.sort((a, b) => {
                if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
                return getCardNumericValue(a.value) - getCardNumericValue(b.value);
            });
            setSortState('value');
          } else {
             newHand.sort((a, b) => getCardNumericValue(a.value) - getCardNumericValue(b.value));
             setSortState('suit');
          }
          
          const newPlayers = [...prev.players];
          newPlayers[myPlayerIndex] = { ...player, hand: newHand };
          return { ...prev, players: newPlayers };
      });
  };

  // DnD Sensors
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 10 } }), useSensor(TouchSensor));

  const handleDragStart = (event) => setActiveId(event.active.id);
  const handleDragEnd = (event) => {
      const { active, over } = event;
      if (active.id !== over?.id) {
          setGameState((prev) => {
              const player = prev.players[myPlayerIndex];
              const oldIndex = player.hand.findIndex(c => c.id === active.id);
              const newIndex = player.hand.findIndex(c => c.id === over.id);
              const newHand = arrayMove(player.hand, oldIndex, newIndex);
              
              const newPlayers = [...prev.players];
              newPlayers[myPlayerIndex] = { ...player, hand: newHand };
              return { ...prev, players: newPlayers };
          });
      }
      setActiveId(null);
  };

  if (!roomId) {
      return <Lobby onJoinGame={onJoinGame} />;
  }

  if (!gameState) return <div className="h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;

  const player = gameState.players[myPlayerIndex];
  
  // Waiting Room View
  if (gameState.status === 'WAITING') {
      return (
        <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-6">
            <h2 className="text-4xl font-bold">Waiting Lobby</h2>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <p className="text-xl mb-4">Room Code: <span className="font-mono bg-black/30 px-2 py-1 rounded text-purple-400">{roomId}</span></p>
                <div className="flex flex-col gap-2">
                    {gameState.players.map(p => (
                        <div key={p.id} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span>{p.name} {p.id === myPlayerIndex ? '(You)' : ''}</span>
                        </div>
                    ))}
                </div>
            </div>
            {myPlayerIndex === 0 && (
                <button 
                    onClick={startGameMulti}
                    className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-lg font-bold text-xl shadow-lg transition-transform hover:scale-105"
                >
                    Start Game
                </button>
            )}
             {myPlayerIndex !== 0 && <p className="animate-pulse text-gray-400">Waiting for host to start...</p>}
        </div>
      );
  }

  const isMyTurn = gameState.currentPlayerIndex === myPlayerIndex;
  const opponents = gameState.players.filter(p => p.id !== myPlayerIndex);

  return (
    <div className="h-screen w-full bg-green-800 grid grid-rows-[1fr_auto] overflow-hidden font-sans text-slate-200">
      {/* Table Top */}
      <div className="relative w-full h-full"> 
         <div className="absolute top-4 right-4 bg-black/40 px-4 py-2 rounded-lg backdrop-blur text-sm">
             <p>Room: {roomId}</p>
             <p className={isMyTurn ? "text-green-400 font-bold" : "text-gray-300"}>
                 Turn: {isMyTurn ? "YOUR TURN" : gameState.players[gameState.currentPlayerIndex].name}
             </p>
             <p className="text-xs text-gray-400">Phase: {gameState.turnPhase}</p>
         </div>

         {/* Opponents */}
         {opponents.map((opp, idx) => {
             const isTop = opponents.length === 1;
              const style = isTop 
                ? { top: '20px', left: '50%', transform: 'translateX(-50%)' } 
                : { top: '20px', left: `${(idx + 1) * (100 / (opponents.length + 1))}%`, transform: 'translateX(-50%)' };
             
             return (
                 <div key={opp.id} className="absolute flex flex-col items-center" style={style}>
                    <div className={`mb-2 font-semibold bg-black/30 px-2 py-1 rounded ${gameState.currentPlayerIndex === opp.id ? 'border border-yellow-400 text-yellow-300' : ''}`}>
                        {opp.name}
                    </div>
                    <div className="relative w-48 h-24">
                        {opp.hand.map((_, cIdx) => (
                             <div 
                                key={cIdx} 
                                className="absolute bottom-0 left-1/2 w-20 h-32 rounded-lg bg-indigo-600 border-2 border-indigo-800 shadow-md origin-bottom"
                                style={{ 
                                    transform: `translateX(-50%) rotate(${ (cIdx - opp.hand.length/2) * 5 }deg)`,
                                    backgroundImage: 'repeating-linear-gradient(45deg, #6366f1 25%, transparent 25%, transparent 75%, #6366f1 75%, #6366f1)',
                                    backgroundSize: '20px 20px'
                                }}
                             ></div>
                        ))}
                    </div>
                 </div>
             )
         })}

        {/* Center Table */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-8 items-center">
             {/* Deck */}
            <div className="text-center group">
                <p className="font-semibold mb-1 group-hover:text-white transition-colors">Deck ({gameState.deckPileCount})</p>
                <div 
                    onClick={drawFromDeck}
                    className={`w-20 h-32 rounded-lg bg-indigo-600 border-2 border-indigo-800 shadow-md transition-all 
                        ${isMyTurn && gameState.turnPhase === 'DRAW' ? 'cursor-pointer hover:scale-105 hover:shadow-xl ring-2 ring-yellow-400' : 'opacity-80 cursor-not-allowed grayscale'}`}
                     style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #6366f1 25%, transparent 25%, transparent 75%, #6366f1 75%, #6366f1)',
                        backgroundSize: '20px 20px'
                    }}
                ></div>
            </div>

            {/* Discard */}
            <div className="text-center group">
                <p className="font-semibold mb-1 group-hover:text-white transition-colors">Discard</p>
                <div className={`w-20 h-32 rounded-lg border-2 border-dashed border-green-400 bg-green-600/50 flex justify-center items-center transition-all
                     ${isMyTurn && gameState.turnPhase === 'DRAW' && gameState.discardPile.length > 0 ? 'cursor-pointer hover:bg-green-600/70 hover:scale-105 ring-2 ring-yellow-400' : ''}`}
                     onClick={gameState.discardPile.length > 0 ? drawFromDiscard : undefined}
                >
                    {gameState.discardPile.length > 0 && 
                        <Card card={gameState.discardPile[gameState.discardPile.length - 1]} />
                    }
                </div>
            </div>

             {/* Wildcard */}
            <div className="text-center">
                <p className="font-semibold mb-1">Wildcard</p>
                <div className="w-20 h-32 rounded-lg border-2 border-dashed border-green-400 bg-green-600/50 flex justify-center items-center">
                     {gameState.wildcard && <Card card={gameState.wildcard} />}
                </div>
            </div>
        </div>
      </div>

      {/* Player Area */}
      <div className={`backdrop-blur-sm border-t p-6 transition-colors ${isMyTurn ? 'bg-green-900/60 border-yellow-500/50' : 'bg-gray-900/60 border-gray-700'}`}>
        <div className="flex justify-between items-center mb-4">
            <div>
                 <h2 className="text-2xl font-bold flex items-center gap-2">
                    Your Hand 
                    {isMyTurn && <span className="text-sm font-normal bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded animate-pulse">
                        {gameState.turnPhase === 'DRAW' ? 'Pick a Card' : 'Discard a Card'}
                    </span>}
                 </h2>
            </div>
            
            <div className="flex gap-2">
                <button 
                    onClick={sortHand}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition border border-gray-500"
                >
                    Sort by {sortState === 'suit' ? 'Suit' : 'Value'}
                </button>
                <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition disabled:bg-gray-600 disabled:opacity-50" disabled>Declare</button>
            </div>
        </div>

        {/* Hand Cards (DnD) */}
        <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={player.hand.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                <div className="flex flex-wrap gap-2 justify-center min-h-[140px] items-center p-4">
                    {player.hand.map((card) => (
                        <SortableCard 
                            key={card.id} 
                            card={card} 
                            onClick={isMyTurn && gameState.turnPhase === 'DISCARD' ? () => discardCard(card) : () => {}}
                            disabled={!isMyTurn || gameState.turnPhase !== 'DISCARD'}
                        />
                    ))}
                </div>
            </SortableContext>
            <DragOverlay>
                {activeId ? <div className="opacity-80 rotate-3"><Card card={player.hand.find(c => c.id === activeId)} /></div> : null}
            </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

export default App;
