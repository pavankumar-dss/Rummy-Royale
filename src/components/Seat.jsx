import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Avatar from './Avatar';
import { CardBack } from './Card';

const ThinkingDots = () => (
    <span className="inline-flex gap-0.5 ml-1" aria-label="thinking">
        {[0, 1, 2].map((i) => (
            <motion.span
                key={i}
                className="w-1 h-1 rounded-full bg-gold-300"
                animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
        ))}
    </span>
);

// An opponent around the table: fanned card backs, avatar with timer ring and name plate.
const Seat = ({ player, active, progress, total, limit, dealing, dealDelay = 0 }) => {
    const dropped = Boolean(player.dropped);
    const count = dropped ? 0 : player.handCount; // a dropped hand is folded away
    return (
        <div className="flex flex-col items-center gap-1.5 min-w-0">
            <div className="relative h-[calc(var(--card-w)*0.62)] w-[calc(var(--card-w)*1.6)]">
                <AnimatePresence initial={false}>
                    {Array.from({ length: count }, (_, i) => {
                        const angle = (i - (count - 1) / 2) * 6;
                        return (
                            <motion.div
                                key={i}
                                className="absolute left-1/2 bottom-0 origin-bottom"
                                initial={dealing ? { opacity: 0, y: 60, scale: 0.6 } : { opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0, scale: 1, rotate: angle, x: '-50%' }}
                                exit={{ opacity: 0, y: 30 }}
                                transition={{ delay: dealing ? dealDelay + i * 0.07 : 0, type: 'spring', stiffness: 300, damping: 26 }}
                            >
                                <CardBack size="mini" />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <AnimatePresence>
                    {dropped && (
                        <motion.span
                            className="absolute inset-x-0 bottom-1 mx-auto w-max rounded-full bg-black/55 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-gold-200 ring-1 ring-gold-500/40"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            Dropped
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
            <div
                className={`flex items-center gap-2 rounded-full pl-1 pr-3 py-1 transition-colors ${
                    active ? 'bg-gold-500/20 ring-1 ring-gold-400/70' : 'bg-black/30'
                } ${dropped ? 'opacity-55' : ''}`}
            >
                <Avatar player={player} size={36} progress={active ? progress : null} active={active} />
                <div className="leading-tight min-w-0">
                    <p className="text-xs sm:text-sm font-semibold truncate flex items-center">
                        {player.name}
                        {active && <ThinkingDots />}
                    </p>
                    <p className="text-[0.65rem] text-gold-200/70 whitespace-nowrap">
                        {!dropped && <span className="hidden sm:inline">{count} cards · </span>}
                        <span className={`font-semibold tabular-nums ${total > limit * 0.75 ? 'text-amber-300' : ''}`}>{total} pts</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Seat;
