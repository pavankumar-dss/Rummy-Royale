import React from 'react';
import { motion } from 'motion/react';
import Avatar from './Avatar';
import { CrownIcon } from './icons';
import { Overlay, Panel, ScoreTable } from './Scoreboard';
import { standings } from '../game/match.js';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Final standings once the match is over (last player standing, or ended early). */
export default function MatchOver({ match, humanId, onNewMatch, onMenu }) {
    const { ranked, winners } = standings(match);
    const youWon = winners.includes(humanId);
    const nameOf = (id) => (id === humanId ? 'You' : match.players[id].name);
    const winnerNames = winners.map(nameOf).join(' & ');
    const roundsWon = (id) => match.rounds.filter((r) => r.winnerId === id).length;

    let title = youWon ? 'You win the match!' : `${winnerNames} ${winners.length > 1 ? 'share' : 'wins'} the match`;
    if (youWon && winners.length > 1) title = `It's a tie: ${winnerNames}`;

    return (
        <Overlay>
            <Panel label="Final standings" delay={0.2} className="max-w-2xl text-center">
                <CrownIcon className={`w-11 h-11 mx-auto ${youWon ? 'text-gold-400' : 'text-white/30'}`} />
                <h2 className="font-display font-extrabold text-3xl sm:text-5xl mt-2 gold-text">{title}</h2>
                <p className="mt-2 text-white/65 text-sm">
                    {match.endedEarly
                        ? `Match ended after ${match.rounds.length} round${match.rounds.length === 1 ? '' : 's'}. Lowest total wins.`
                        : 'Last player standing.'}
                </p>

                <ol className="mt-6 space-y-2 text-left">
                    {ranked.map((p, i) => {
                        const winner = winners.includes(p.id);
                        return (
                            <motion.li
                                key={p.id}
                                className={`flex items-center gap-3 rounded-2xl p-2.5 pr-4 ring-1 ${
                                    winner ? 'bg-gold-400/15 ring-gold-400/50' : 'bg-black/20 ring-white/5'
                                }`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 + i * 0.1 }}
                            >
                                <span className="w-7 text-center text-lg">{MEDALS[i] ?? `${i + 1}.`}</span>
                                <Avatar player={p} size={38} />
                                <div className="min-w-0">
                                    <p className="font-semibold truncate">{nameOf(p.id)}</p>
                                    <p className="text-[0.7rem] text-white/50">
                                        {roundsWon(p.id)} round{roundsWon(p.id) === 1 ? '' : 's'} won
                                        {p.eliminatedIn !== null && ` · out in round ${p.eliminatedIn}`}
                                    </p>
                                </div>
                                <span className={`ml-auto font-display font-bold text-2xl tabular-nums ${winner ? 'text-gold-200' : 'text-white/80'}`}>
                                    {p.total}
                                </span>
                            </motion.li>
                        );
                    })}
                </ol>

                <div className="mt-5 text-left">
                    <ScoreTable match={match} humanId={humanId} />
                </div>

                <div className="mt-6 flex justify-center gap-3">
                    <button onClick={onNewMatch} className="btn btn-gold px-6 py-3 font-display tracking-wide">
                        New match
                    </button>
                    <button onClick={onMenu} className="btn btn-ghost px-6 py-3">
                        Main menu
                    </button>
                </div>
            </Panel>
        </Overlay>
    );
}
