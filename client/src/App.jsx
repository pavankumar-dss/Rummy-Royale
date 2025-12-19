import React, { useState, useEffect } from 'react';
import Card from './components/Card';
import Lobby from './components/Lobby';
import axios from 'axios';
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
  const [timeLeft, setTimeLeft] = useState(30);
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
                // Sync Timer
                if (newState.status === 'PLAYING') {
                    const deadline = newState.turnDeadline;
                    const serverNow = newState.serverTime; // Approximate sync
                    const diff =  Math.max(0, Math.ceil((deadline - (Date.now() + (serverNow - Date.now()))) / 1000));
                    // Simplified: Just use local time diff from deadline if clocks are close, or rely on serverTime delta.
                    // Let's rely on backend relative time: deadline - serverTime = remaining time at that snapshot.
                    // But we want it to tick down.
                    // Better: deadline is absolute server time. We calculate local remaining time.
                    // We assume small clock drift or just use the snapshot.
                    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
                   setTimeLeft(remaining);
                }
                return newState; 
            });
        } catch (err) { console.error(err); }
    }, 1000); // Poll faster for timer? 1s is okay.
    return () => clearInterval(interval);
  }, [roomId]);

  // Local Ticker for smooth countdown between polls
  useEffect(() => {
      if (!gameState || gameState.status !== 'PLAYING') return;
      const timer = setInterval(() => {
          setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
  }, [gameState?.currentPlayerIndex]); // Reset on turn change

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

  const handleShow = async () => {
      if (!isMyTurn) return;
      if (!confirm("Are you sure you want to Show your hand? ensures you have valid sets/sequences!")) return;
      try {
          const res = await axios.post(`${API_URL}/game/${roomId}/show`, { playerIndex: myPlayerIndex });
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

          // Persist to Server
          axios.post(`${API_URL}/game/${roomId}/reorder`, { 
              playerIndex: myPlayerIndex, 
              newHand 
          }).catch(err => console.error("Failed to save sort", err));

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
              
              // Persist to Server
              axios.post(`${API_URL}/game/${roomId}/reorder`, { 
                  playerIndex: myPlayerIndex, 
                  newHand 
              }).catch(err => console.error("Failed to save sort", err));

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
                            <img src={p.avatar} alt="Avatar" className="w-8 h-8 rounded-full bg-white" />
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

  if (gameState.status === 'FINISHED') {
      return (
        <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-6">
            <h2 className="text-6xl font-bold text-yellow-400 mb-4">Game Over!</h2>
            <div className="text-3xl">
                Winner: <span className="text-green-400 font-bold">{gameState.winner}</span>
            </div>
            {gameState.winner === player.name ? (
                <div className="text-2xl animate-bounce mt-4">🎉 You Won! 🎉</div>
            ) : (
                <div className="text-xl text-gray-400 mt-4">Better luck next time.</div>
            )}
            <button onClick={() => window.location.reload()} className="mt-8 bg-blue-600 px-6 py-3 rounded-lg font-bold">Play Again</button>
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
                ? { top: '5%', left: '50%', transform: 'translateX(-50%)' } 
                : { top: '5%', left: `${(idx + 1) * (100 / (opponents.length + 1))}%`, transform: 'translateX(-50%)' };
             
             return (
                 <div key={opp.id} className="absolute flex flex-col items-center" style={style}>
                    <div className="relative w-32 h-16">
                        {opp.hand.map((_, cIdx) => (
                             <div 
                                key={cIdx} 
                                className="absolute bottom-0 left-1/2 w-12 h-20 rounded bg-indigo-600 border border-indigo-800 shadow-md origin-bottom"
                                style={{ 
                                    transform: `translateX(-50%) rotate(${ (cIdx - opp.hand.length/2) * 5 }deg)`,
                                    backgroundImage: 'repeating-linear-gradient(45deg, #6366f1 25%, transparent 25%, transparent 75%, #6366f1 75%, #6366f1)',
                                    backgroundSize: '10px 10px'
                                }}
                             ></div>
                        ))}
                    </div>
                    <div className={`mt-1 text-sm font-semibold bg-black/30 px-2 py-1 rounded flex gap-2 items-center ${gameState.currentPlayerIndex === opp.id ? 'border border-yellow-400 text-yellow-300' : ''}`}>
                        <img src={opp.avatar} alt="Opp" className="w-6 h-6 rounded-full bg-white" />
                        {opp.name}
                        {gameState.currentPlayerIndex === opp.id && (
                            <span className="text-red-400 font-mono font-bold animate-pulse">{timeLeft}s</span>
                        )}
                    </div>
                 </div>
             );
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
                    <img src={player.avatar} alt="Me" className="w-10 h-10 rounded-full bg-white border-2 border-green-400" />
                    Your Hand 
                    {isMyTurn && <span className="text-sm font-normal bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded animate-pulse">
                        {gameState.turnPhase === 'DRAW' ? 'Pick a Card' : 'Discard a Card'}
                    </span>}
                    {isMyTurn && <span className="text-xl text-red-500 font-bold font-mono ml-4">{timeLeft}s</span>}
                 </h2>
            </div>
            
            <div className="flex gap-2">
                <button 
                    onClick={sortHand}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition border border-gray-500"
                >
                    Sort by {sortState === 'suit' ? 'Suit' : 'Value'}
                </button>
                <button 
                    onClick={handleShow}
                    disabled={!isMyTurn}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition disabled:bg-gray-600 disabled:opacity-50"
                >
                    Show
                </button>
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
