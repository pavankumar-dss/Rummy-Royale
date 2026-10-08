import React from 'react';
import { motion } from 'motion/react';
import Avatar from './Avatar';
import Card from './Card';
import { CrownIcon } from './icons';
import { isWild, orderForDisplay, sortCards } from '../game/cards.js';
import { MELD_NAMES } from '../game/melds.js';
import { ROUND_CAP } from '../game/match.js';

export const Overlay = ({ children, onClick }) => (
    <motion.div
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/65 backdrop-blur-sm p-3 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClick}
    >
        {children}
    </motion.div>
);

export const Panel = ({ children, label, delay = 0, className = '' }) => (
    <motion.div
        className={`panel rounded-3xl w-full my-auto p-4 sm:p-7 ${className}`}
        initial={{ scale: 0.92, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22, delay }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
    >
        {children}
    </motion.div>
);

/** Running totals: one row per player, one column per round. */
export function ScoreTable({ match, humanId }) {
    const { rounds, players, limit } = match;
    return (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-gold-500/20 bg-black/20">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-[0.65rem] uppercase tracking-[0.15em] text-gold-200/70">
                        <th className="text-left font-semibold px-3 py-2">Player</th>
                        {rounds.map((r) => (
                            <th key={r.number} className="font-semibold px-2 py-2 text-center">
                                R{r.number}
                            </th>
                        ))}
                        <th className="font-semibold px-3 py-2 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {players.map((p) => {
                        const out = p.eliminatedIn !== null;
                        const danger = !out && p.total > limit * 0.75;
                        return (
                            <tr key={p.id} className={`border-t border-white/5 ${out ? 'opacity-50' : ''}`}>
                                <td className="px-3 py-2 font-semibold whitespace-nowrap">
                                    {p.id === humanId ? 'You' : p.name}
                                </td>
                                {rounds.map((r) => {
                                    const result = r.results.find((x) => x.playerId === p.id);
                                    return (
                                        <td key={r.number} className="px-2 py-2 text-center tabular-nums text-white/80">
                                            {!result ? (
                                                <span className="text-white/25">–</span>
                                            ) : r.winnerId === p.id ? (
                                                <CrownIcon className="w-4 h-4 inline text-gold-400" />
                                            ) : result.dropped ? (
                                                <span title={`Dropped (${result.dropped === 'first' ? 'first' : 'middle'} drop)`}>
                                                    {result.count}
                                                    <span className="ml-0.5 text-[0.6rem] font-semibold text-gold-300/80">D</span>
                                                </span>
                                            ) : (
                                                result.count
                                            )}
                                        </td>
                                    );
                                })}
                                <td
                                    className={`px-3 py-2 text-right font-bold tabular-nums whitespace-nowrap ${
                                        out ? 'text-red-300' : danger ? 'text-amber-300' : 'text-gold-200'
                                    }`}
                                >
                                    {p.total}
                                    {out && <span className="ml-1.5 text-[0.65rem] font-semibold uppercase">out</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <p className="px-3 py-1.5 text-[0.65rem] text-white/45 border-t border-white/5">
                Over {limit} and you&apos;re out · max {ROUND_CAP} per round · D = dropped
            </p>
        </div>
    );
}

const Tag = ({ tone = 'neutral', children }) => {
    const tones = {
        neutral: 'bg-white/10 text-white/70',
        good: 'bg-emerald-400/15 text-emerald-200',
        bad: 'bg-red-500/15 text-red-200',
        gold: 'bg-gold-400/20 text-gold-200',
    };
    return <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${tones[tone]}`}>{children}</span>;
};

const Fan = ({ cards, wildRank, dead = false }) => (
    <div className="flex">
        {cards.map((c, i) => (
            <Card
                key={c.id}
                card={c}
                size="sm"
                isWild={isWild(c, wildRank)}
                className={dead ? 'ring-2 ring-red-400/90' : ''}
                style={{ marginLeft: i ? 'calc(var(--card-w) * -0.5)' : 0 }}
            />
        ))}
    </div>
);

// One player's hand at the end of a round: melds, then the counted cards (ringed in red).
function ResultRow({ result, player, isHuman, wildRank, total }) {
    const name = isHuman ? 'You' : player.name;
    return (
        <div className="rounded-2xl bg-black/20 ring-1 ring-white/5 p-3">
            <div className="flex items-center gap-2 mb-2">
                <Avatar player={player} size={30} />
                <span className="font-semibold text-sm">{name}</span>
                {result.winner && <Tag tone="gold">{result.byDrops ? 'Last one in' : 'Declared'}</Tag>}
                {result.dropped && <Tag tone="neutral">{result.dropped === 'first' ? 'First drop' : 'Middle drop'}</Tag>}
                {result.hasLife === false && <Tag tone="bad">No life: every card counts</Tag>}
                {result.capped && <Tag tone="neutral">Capped at {ROUND_CAP} (was {result.raw})</Tag>}
                <span className="ml-auto pl-2 text-right leading-tight">
                    <span className={`block font-display font-bold text-xl ${result.count ? 'text-red-200' : 'text-emerald-200'}`}>
                        +{result.count}
                    </span>
                    <span className="block text-[0.65rem] text-white/50">total {total}</span>
                </span>
            </div>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                {result.melds.map((meld, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <Fan cards={orderForDisplay(meld.cards, wildRank)} wildRank={wildRank} />
                        <span className="text-[0.6rem] uppercase tracking-wider text-emerald-200/80">{MELD_NAMES[meld.type]}</span>
                    </div>
                ))}
                {result.deadwood.length > 0 && (
                    <div className="flex flex-col items-center gap-1">
                        <Fan cards={sortCards(result.deadwood, 'suit', wildRank)} wildRank={wildRank} dead />
                        <span className="text-[0.6rem] uppercase tracking-wider text-red-200/80">Counted</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function roundSubtitle(round, winner) {
    const drops = round.results.filter((r) => r.dropped).length;
    if (round.results.some((r) => r.byDrops)) return 'Everyone else dropped out, so the last player in takes the round.';
    if (!winner) return drops ? 'The deck ran out. Only the drops score.' : 'The deck ran out, so nobody scores.';
    return drops
        ? 'Drops pay their fixed penalty; everyone else adds the count of their unmatched cards.'
        : 'Everyone else adds the count of their unmatched cards.';
}

/** Shown after every round: who declared, everyone's count, eliminations and totals. */
export function RoundSummary({ match, humanId, onNext, onEnd, onStandings }) {
    const round = match.rounds.at(-1);
    const winner = round.winnerId !== null ? match.players[round.winnerId] : null;
    const youWon = round.winnerId === humanId;
    const youAreOut = round.eliminated.includes(humanId);
    const spectating = match.players[humanId].eliminatedIn !== null;
    const finished = match.status === 'FINISHED';
    const results = [...round.results].sort((a, b) => (b.winner ? 1 : 0) - (a.winner ? 1 : 0) || a.count - b.count);

    return (
        <Overlay>
            <Panel label={`Round ${round.number} results`} delay={0.6} className="max-w-4xl">
                <div className="text-center">
                    <p className="text-[0.65rem] uppercase tracking-[0.25em] text-gold-300/80">Round {round.number}</p>
                    <h2 className="font-display font-extrabold text-3xl sm:text-4xl mt-1 gold-text">
                        {youWon ? 'You win the round!' : winner ? `${winner.name} wins the round` : 'No winner this round'}
                    </h2>
                    <p className="mt-1 text-sm text-white/60">
                        {roundSubtitle(round, winner)}
                    </p>
                </div>

                {round.eliminated.length > 0 && (
                    <div className="mt-4 rounded-2xl bg-crimson-800/60 ring-1 ring-crimson-600 px-4 py-2.5 text-center text-sm">
                        {round.eliminated.map((id) => (
                            <p key={id}>
                                <strong>{id === humanId ? 'You are' : `${match.players[id].name} is`} out</strong> with {match.players[id].total}{' '}
                                points (over {match.limit}).
                            </p>
                        ))}
                    </div>
                )}

                <div className="mt-4 space-y-2.5">
                    {results.map((r) => (
                        <ResultRow
                            key={r.playerId}
                            result={r}
                            player={match.players[r.playerId]}
                            isHuman={r.playerId === humanId}
                            wildRank={round.wildRank}
                            total={round.totals[r.playerId]}
                        />
                    ))}
                </div>

                <div className="mt-4">
                    <ScoreTable match={match} humanId={humanId} />
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {finished ? (
                        <button onClick={onStandings} className="btn btn-gold px-6 py-3 font-display tracking-wide">
                            Final standings
                        </button>
                    ) : (
                        <>
                            <button onClick={onNext} className="btn btn-gold px-6 py-3 font-display tracking-wide">
                                {youAreOut ? 'Watch the bots finish' : spectating ? 'Next round' : `Deal round ${round.number + 1}`}
                            </button>
                            <button onClick={onEnd} className="btn btn-ghost px-6 py-3">
                                End match
                            </button>
                        </>
                    )}
                </div>
                {!finished && (
                    <p className="mt-2 text-center text-[0.7rem] text-white/40">Ending the match now crowns the lowest total.</p>
                )}
            </Panel>
        </Overlay>
    );
}
