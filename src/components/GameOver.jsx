import React from 'react';
import { motion } from 'motion/react';
import Avatar from './Avatar';
import Card from './Card';
import { CrownIcon } from './icons';
import { isWild, orderForDisplay } from '../game/cards.js';
import { MELD_NAMES } from '../game/melds.js';

const Overlay = ({ children }) => (
    <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
    >
        {children}
    </motion.div>
);

const GameOver = ({ view, onPlayAgain, onMenu }) => {
    const winner = view.winner && view.players[view.winner.playerId];
    const youWon = winner && winner.id === view.viewerId;
    const others = view.players.filter((p) => p.id !== view.winner?.playerId);

    return (
        <Overlay>
            <motion.div
                className="panel rounded-3xl w-full max-w-4xl my-auto p-5 sm:p-8 text-center"
                initial={{ scale: 0.9, y: 30, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.5 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="game-over-title"
            >
                <CrownIcon className={`w-10 h-10 mx-auto ${youWon ? 'text-gold-400' : 'text-white/30'}`} />
                <h2 id="game-over-title" className="font-display font-extrabold text-4xl sm:text-5xl mt-2 gold-text">
                    {youWon ? 'Victory!' : winner ? `${winner.name} wins` : 'No winner'}
                </h2>
                <p className="mt-2 text-white/70">
                    {youWon
                        ? 'A royal hand. Every card in a meld.'
                        : winner
                          ? `${winner.name} declared a winning hand.`
                          : 'The deck ran out before anyone could declare.'}
                </p>

                {winner && (
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        {view.winner.melds.map((meld, i) => (
                            <motion.div
                                key={i}
                                className="rounded-2xl bg-black/25 ring-1 ring-gold-500/25 p-2.5"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 + i * 0.12 }}
                            >
                                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-gold-200/80 mb-2">{MELD_NAMES[meld.type]}</p>
                                <div className="flex">
                                    {orderForDisplay(meld.cards, view.wildRank).map((c, j) => (
                                        <Card
                                            key={c.id}
                                            card={c}
                                            size="sm"
                                            isWild={isWild(c, view.wildRank)}
                                            style={{ marginLeft: j ? 'calc(var(--card-w) * -0.32)' : 0 }}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {others.length > 0 && (
                    <div className="mt-6 space-y-2 text-left">
                        {others.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-black/20 p-2">
                                <Avatar player={p} size={34} />
                                <span className="w-16 sm:w-24 shrink-0 text-sm font-semibold truncate">{p.id === view.viewerId ? 'You' : p.name}</span>
                                <div className="flex flex-wrap">
                                    {p.hand.map((c, j) => (
                                        <Card
                                            key={c.id}
                                            card={c}
                                            size="mini"
                                            style={{ marginLeft: j ? 'calc(var(--card-w) * -0.12)' : 0 }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-7 flex justify-center gap-3">
                    <button onClick={onPlayAgain} className="btn btn-gold px-6 py-3 font-display tracking-wide text-base">
                        Play again
                    </button>
                    <button onClick={onMenu} className="btn btn-ghost px-6 py-3">
                        Main menu
                    </button>
                </div>
            </motion.div>
        </Overlay>
    );
};

export default GameOver;
