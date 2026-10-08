import React, { useState } from 'react';

const TIMER_OPTIONS = [
    { label: 'Off', seconds: 0 },
    { label: '30s', seconds: 30 },
    { label: '60s', seconds: 60 },
];

const optionClass = (selected) =>
    `flex-1 py-3 rounded-lg font-bold transition ${selected ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`;

const Lobby = ({ initialSettings, onStart }) => {
    const [name, setName] = useState(initialSettings.name);
    const [bots, setBots] = useState(initialSettings.bots);
    const [turnSeconds, setTurnSeconds] = useState(initialSettings.turnSeconds);

    const start = (e) => {
        e.preventDefault();
        onStart({ name: name.trim() || 'You', bots, turnSeconds });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white px-4 py-10">
            <h1 className="text-5xl sm:text-6xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 text-center">
                Rummy Royale
            </h1>

            <form onSubmit={start} className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 flex flex-col gap-6">
                <label className="block">
                    <span className="block text-sm font-medium mb-1 text-gray-400">Your name</span>
                    <input
                        type="text"
                        maxLength={20}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </label>

                <fieldset>
                    <legend className="text-sm font-medium mb-2 text-gray-400">Opponents</legend>
                    <div className="flex gap-2">
                        {[1, 2, 3].map((n) => (
                            <button key={n} type="button" onClick={() => setBots(n)} className={optionClass(bots === n)}>
                                {n} Bot{n > 1 ? 's' : ''}
                            </button>
                        ))}
                    </div>
                </fieldset>

                <fieldset>
                    <legend className="text-sm font-medium mb-2 text-gray-400">Turn timer</legend>
                    <div className="flex gap-2">
                        {TIMER_OPTIONS.map((o) => (
                            <button key={o.label} type="button" onClick={() => setTurnSeconds(o.seconds)} className={optionClass(turnSeconds === o.seconds)}>
                                {o.label}
                            </button>
                        ))}
                    </div>
                </fieldset>

                <button type="submit" className="bg-green-600 hover:bg-green-700 font-bold py-4 rounded-lg text-lg shadow-lg transition">
                    Deal Cards
                </button>
            </form>

            <details className="mt-6 w-full max-w-md text-sm text-gray-400">
                <summary className="cursor-pointer hover:text-gray-200">How to play</summary>
                <ul className="mt-2 space-y-1 list-disc pl-5">
                    <li>On your turn, draw from the deck or the discard pile, then click a card to discard it.</li>
                    <li>Win by arranging all 13 cards into sets (same rank, different suits) and sequences (same suit, in a row).</li>
                    <li>You need at least 2 sequences, and at least 1 of them must be pure (no jokers or wilds standing in).</li>
                    <li>Jokers and cards of the wildcard rank (marked WILD) can stand in for any card.</li>
                    <li>When your hand is ready, draw and press Declare. The leftover card is discarded for you.</li>
                </ul>
            </details>
        </div>
    );
};

export default Lobby;
