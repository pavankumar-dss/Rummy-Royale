
import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const Lobby = ({ onJoinGame }) => {
    const [mode, setMode] = useState('menu'); // menu, single_setup, multi_setup, multi_join
    const [playerName, setPlayerName] = useState('Player 1');
    const [roomCode, setRoomCode] = useState('');
    const [error, setError] = useState('');

    const createGame = async (gameMode, bots = 0) => {
        try {
            // Create Room
            const res = await axios.post(`${API_URL}/room/create`, { 
                mode: gameMode, 
                playerName 
            });
            const { roomId, playerIndex } = res.data;

            // Start Game Immediately for Singleplayer
            if (gameMode === 'SINGLE') {
                await axios.post(`${API_URL}/game/start`, { roomId, addBots: bots });
                onJoinGame(roomId, playerIndex);
            } else {
                // For Multiplayer Host, we just join the room waiting state
                onJoinGame(roomId, playerIndex); 
            }
        } catch (err) {
            setError('Failed to create game. Is server running?');
        }
    };

    const joinGame = async () => {
        try {
            const res = await axios.post(`${API_URL}/room/join`, { roomId: roomCode, playerName });
            onJoinGame(res.data.roomId, res.data.playerIndex);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to join room.');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative overflow-hidden font-sans">
             <h1 className="text-6xl font-bold mb-8 drop-shadow-lg z-10 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                Rummy Royale
            </h1>
            
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md z-10 border border-gray-700 backdrop-blur-sm bg-opacity-90">
                {error && <div className="bg-red-500/20 text-red-300 p-2 rounded mb-4 text-center text-sm">{error}</div>}
                
                <div className="mb-6">
                    <label className="block text-sm font-medium mb-1 text-gray-400">Your Name</label>
                    <input 
                        type="text" 
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                    />
                </div>

                {mode === 'menu' && (
                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => setMode('single_setup')}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                        >
                            <span>👤</span> Singleplayer (vs Bots)
                        </button>
                        <button 
                            onClick={() => setMode('multi_menu')}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                        >
                            <span>👥</span> Multiplayer (with Friends)
                        </button>
                    </div>
                )}

                {mode === 'single_setup' && (
                    <div className="flex flex-col gap-4">
                        <p className="text-center text-gray-300 mb-2">Select Difficulty (Bot Count)</p>
                        <div className="flex gap-2 justify-center mb-4">
                            {[1, 2, 3].map(bots => (
                                <button 
                                    key={bots}
                                    onClick={() => createGame('SINGLE', bots + 1)} // +1 because total players = bots + human
                                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition"
                                >
                                    {bots} Bot{bots > 1 ? 's' : ''}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setMode('menu')} className="text-gray-400 underline hover:text-white">Back</button>
                    </div>
                )}

                {mode === 'multi_menu' && (
                    <div className="flex flex-col gap-4">
                         <button 
                            onClick={() => createGame('MULTI')}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
                        >
                            Create Room
                        </button>
                        <button 
                            onClick={() => setMode('multi_join')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
                        >
                            Join Room
                        </button>
                        <button onClick={() => setMode('menu')} className="text-gray-400 underline hover:text-white mt-2">Back</button>
                    </div>
                )}

                {mode === 'multi_join' && (
                    <div className="flex flex-col gap-4">
                        <div>
                             <label className="block text-sm font-medium mb-1 text-gray-400">Room Code</label>
                             <input 
                                type="text"
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase tracking-widest font-mono text-center text-xl"
                                placeholder="ABCD12"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                             />
                        </div>
                        <button 
                            onClick={joinGame}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg"
                        >
                            Join Game
                        </button>
                        <button onClick={() => setMode('multi_menu')} className="text-gray-400 underline hover:text-white">Back</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Lobby;
