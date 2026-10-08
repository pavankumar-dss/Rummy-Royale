import React from 'react';
import Avatar from './Avatar';
import Card, { CardBack } from './Card';
import Hand from './Hand';
import { isWild } from '../game/cards.js';

const Opponent = ({ player, isActive, timeLeft }) => (
    <div className="flex flex-col items-center">
        <div className="relative w-24 h-14 sm:w-32 sm:h-16">
            {Array.from({ length: player.handCount }, (_, i) => (
                <div
                    key={i}
                    className="absolute bottom-0 left-1/2 w-8 h-12 sm:w-10 sm:h-16 rounded bg-indigo-600 border border-indigo-800 shadow origin-bottom"
                    style={{ transform: `translateX(-50%) rotate(${(i - player.handCount / 2) * 5}deg)` }}
                />
            ))}
        </div>
        <div
            className={`mt-1 text-xs sm:text-sm font-semibold bg-black/30 px-2 py-1 rounded flex gap-2 items-center border ${
                isActive ? 'border-yellow-400 text-yellow-300' : 'border-transparent'
            }`}
        >
            <Avatar player={player} className="w-6 h-6" />
            {player.name}
            {isActive && timeLeft !== null && <span className="text-red-400 font-mono">{timeLeft}s</span>}
        </div>
    </div>
);

const Pile = ({ label, children, active, onClick }) => (
    <div className="text-center">
        <p className="text-xs sm:text-sm font-semibold mb-1">{label}</p>
        <button
            type="button"
            disabled={!active}
            onClick={onClick}
            className={`rounded-lg transition ${active ? 'ring-2 ring-yellow-400 hover:scale-105 cursor-pointer' : 'cursor-default'}`}
        >
            {children}
        </button>
    </div>
);

const GameTable = ({ view, timeLeft, sortBy, notice, onDraw, onDiscard, onDeclare, onSort, onReorder, onQuit }) => {
    const me = view.players[view.viewerId];
    const opponents = view.players.filter((p) => p.id !== view.viewerId);
    const myTurn = view.currentPlayer === view.viewerId;
    const canDraw = myTurn && view.phase === 'DRAW';
    const canDiscard = myTurn && view.phase === 'DISCARD';
    const current = view.players[view.currentPlayer];
    const lastEvent = view.log.at(-1);

    return (
        <div className="min-h-screen w-full bg-green-800 flex flex-col text-slate-100">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-black/30 text-xs sm:text-sm">
                <button onClick={onQuit} className="text-gray-300 hover:text-white underline">
                    Quit
                </button>
                <p className="truncate text-center">
                    {lastEvent ? `${view.players[lastEvent.playerId].name} ${lastEvent.text}` : 'Game started. Good luck!'}
                </p>
                <p className={myTurn ? 'text-yellow-300 font-bold' : 'text-gray-300'}>{myTurn ? 'Your turn' : `${current.name}…`}</p>
            </div>

            {/* Table */}
            <div className="flex-1 flex flex-col justify-around items-center gap-6 py-4 px-2">
                <div className="flex justify-center gap-4 sm:gap-12 flex-wrap">
                    {opponents.map((p) => (
                        <Opponent key={p.id} player={p} isActive={view.currentPlayer === p.id} timeLeft={timeLeft} />
                    ))}
                </div>

                <div className="flex gap-4 sm:gap-8 items-end">
                    <Pile label={`Deck (${view.deckCount})`} active={canDraw} onClick={() => onDraw('deck')}>
                        <CardBack />
                    </Pile>
                    <Pile label="Discard" active={canDraw && Boolean(view.discardTop)} onClick={() => onDraw('discard')}>
                        {view.discardTop ? (
                            <Card card={view.discardTop} isWild={isWild(view.discardTop, view.wildRank)} />
                        ) : (
                            <div className="w-12 h-[4.5rem] sm:w-20 sm:h-32 rounded-lg border-2 border-dashed border-green-400" />
                        )}
                    </Pile>
                    <div className="text-center">
                        <p className="text-xs sm:text-sm font-semibold mb-1">Wild: {view.wildRank}</p>
                        <Card card={view.wildCard} className="opacity-80" />
                    </div>
                </div>
            </div>

            {/* Player area */}
            <div
                className={`border-t px-2 sm:px-6 pt-3 pb-4 transition-colors ${
                    myTurn ? 'bg-green-950/60 border-yellow-500/50' : 'bg-gray-900/60 border-gray-700'
                }`}
            >
                <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2 font-bold text-lg sm:text-2xl">
                        <Avatar player={me} className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-green-400" />
                        {me.name}
                        {myTurn && (
                            <span className="text-xs sm:text-sm font-normal bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">
                                {canDraw ? 'Draw a card' : 'Click a card to discard'}
                            </span>
                        )}
                        {myTurn && timeLeft !== null && <span className="text-red-400 font-mono text-base sm:text-xl">{timeLeft}s</span>}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onSort} className="bg-gray-700 hover:bg-gray-600 font-bold py-2 px-4 rounded-lg border border-gray-500 text-sm">
                            Sort by {sortBy === 'suit' ? 'suit' : 'rank'}
                        </button>
                        <button
                            onClick={onDeclare}
                            disabled={!canDiscard}
                            className="bg-green-600 hover:bg-green-700 font-bold py-2 px-4 rounded-lg text-sm disabled:bg-gray-600 disabled:opacity-50"
                        >
                            Declare
                        </button>
                    </div>
                </div>

                {notice && <p className="mt-2 text-center text-sm bg-red-500/20 text-red-200 rounded px-3 py-2">{notice}</p>}

                <Hand
                    cards={me.hand}
                    wildRank={view.wildRank}
                    highlightId={view.drawnCard?.id}
                    canDiscard={canDiscard}
                    onDiscard={onDiscard}
                    onReorder={onReorder}
                />
            </div>
        </div>
    );
};

export default GameTable;
