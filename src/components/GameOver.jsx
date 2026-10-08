import React from 'react';
import Avatar from './Avatar';
import Card from './Card';
import { isWild, sortCards } from '../game/cards.js';
import { MELD, MELD_NAMES } from '../game/melds.js';

// Show melds in natural order, with an ace after the king in Q-K-A style sequences.
function displayOrder(meld, wildRank) {
    const sorted = sortCards(meld.cards, 'suit', wildRank);
    const aceHigh = meld.type !== MELD.SET && sorted[0]?.rank === 'A' && sorted.some((c) => c.rank === 'K');
    return aceHigh ? [...sorted.slice(1), sorted[0]] : sorted;
}

const GameOver = ({ view, onPlayAgain, onMenu }) => {
    const winner = view.winner && view.players[view.winner.playerId];
    const youWon = winner && winner.id === view.viewerId;

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center gap-6 px-4 py-10">
            <h2 className="text-5xl font-bold text-yellow-400">{youWon ? '🎉 You won! 🎉' : 'Game over'}</h2>
            <p className="text-xl text-gray-300 text-center">
                {winner ? `${winner.name} declared a winning hand.` : 'The deck ran out. Nobody won this round.'}
            </p>

            {winner && (
                <div className="flex flex-wrap justify-center gap-4">
                    {view.winner.melds.map((meld, i) => (
                        <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">{MELD_NAMES[meld.type]}</p>
                            <div className="flex gap-1">
                                {displayOrder(meld, view.wildRank).map((c) => (
                                    <Card key={c.id} card={c} isWild={isWild(c, view.wildRank)} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="w-full max-w-4xl space-y-3">
                {view.players
                    .filter((p) => p.id !== view.winner?.playerId)
                    .map((p) => (
                        <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-800/60 rounded-lg p-3">
                            <div className="flex items-center gap-2 sm:w-28 shrink-0">
                                <Avatar player={p} />
                                <span className="text-sm">{p.name}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {p.hand.map((c) => (
                                    <Card key={c.id} card={c} isWild={isWild(c, view.wildRank)} />
                                ))}
                            </div>
                        </div>
                    ))}
            </div>

            <div className="flex gap-3">
                <button onClick={onPlayAgain} className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold">
                    Play again
                </button>
                <button onClick={onMenu} className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-bold">
                    Main menu
                </button>
            </div>
        </div>
    );
};

export default GameOver;
