import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useDroppable } from '@dnd-kit/core';
import Card, { CardBack } from './Card';
import { isWild } from '../game/cards.js';

export const DISCARD_DROP = 'discard-pile';

// A small, stable tilt per card so the discard pile looks hand-thrown.
function tilt(id) {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return (Math.abs(h) % 15) - 7;
}

const PileLabel = ({ children }) => (
    <p className="mt-2 text-[0.65rem] sm:text-xs font-semibold uppercase tracking-[0.18em] text-gold-200/80 text-center">{children}</p>
);

/**
 * The draw pile, with the wildcard tucked sideways underneath it (as dealt in
 * Indian Rummy). `flight` animates a card back toward whoever just drew.
 */
export function Deck({ count, wildCard, wildRank, active, glow, dealing, flight, onClick }) {
    const layers = Math.min(3, Math.max(1, Math.ceil(count / 12)));
    return (
        <div className="flex flex-col items-center">
            <div className="relative mr-[calc(var(--card-w)*0.55)]">
                {wildCard && (
                    <div className="absolute top-1/2 left-1/2" style={{ transform: 'translate(-15%, -50%) rotate(90deg)' }}>
                        <Card card={wildCard} />
                    </div>
                )}
                <motion.button
                    type="button"
                    // aria-disabled rather than disabled: browsers swallow mouse events over a
                    // disabled button, which would stop a card drag from ending on the pile.
                    aria-disabled={!active}
                    onClick={active ? onClick : undefined}
                    aria-label={`Draw from the deck (${count} cards)`}
                    className={`relative block rounded-[7%/5%] ${active ? 'cursor-pointer' : 'cursor-default'} ${glow ? 'animate-glow' : ''}`}
                    animate={dealing ? { x: [0, -10, 10, -7, 7, -3, 0], rotate: [0, -3, 3, -2, 2, 0, 0] } : { x: 0, rotate: 0 }}
                    transition={dealing ? { duration: 1.0, ease: 'easeInOut' } : { duration: 0.2 }}
                    whileHover={active ? { y: -4, scale: 1.03 } : undefined}
                >
                    {Array.from({ length: layers }, (_, i) => (
                        <CardBack
                            key={i}
                            className={i === 0 ? 'relative' : 'absolute inset-0'}
                            style={i === 0 ? undefined : { transform: `translate(${-i * 2}px, ${-i * 2}px)` }}
                        />
                    ))}
                    {active && (
                        <span className="absolute inset-0 rounded-[7%/5%] ring-2 ring-gold-300/90 pointer-events-none" />
                    )}
                </motion.button>
                <AnimatePresence>
                    {flight && (
                        <motion.div
                            key={flight.seq}
                            className="absolute inset-0 pointer-events-none z-30"
                            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                            animate={{ x: flight.to.x, y: flight.to.y, opacity: 0, rotate: flight.to.x > 0 ? 14 : -14, scale: 0.75 }}
                            transition={{ duration: 0.55, ease: [0.3, 0.7, 0.4, 1] }}
                        >
                            <CardBack />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <PileLabel>
                Deck · {count} <span className="text-gold-300">· Wild {wildRank === 'A' ? 'Aces' : `${wildRank}s`}</span>
            </PileLabel>
        </div>
    );
}

/**
 * The discard pile. The top card flies in from whoever discarded it and away to
 * whoever picks it. While a card is being dragged, the pile is a drop target.
 */
export function DiscardPile({ recent, wildRank, enterFrom, exitTo, active, glow, dropEnabled, dragging, onClick }) {
    const { setNodeRef, isOver } = useDroppable({ id: DISCARD_DROP, disabled: !dropEnabled });
    const top = recent.at(-1);
    const under = recent.slice(0, -1);

    return (
        <div className="flex flex-col items-center">
            <div ref={setNodeRef} className="relative">
                <button
                    type="button"
                    // aria-disabled rather than disabled: browsers swallow mouse events over a
                    // disabled button, which would stop a card drag from ending on the pile.
                    aria-disabled={!active}
                    onClick={active ? onClick : undefined}
                    aria-label={top ? 'Take the top discard' : 'Discard pile (empty)'}
                    className={`relative block card rounded-[7%/5%] border-2 border-dashed transition-colors ${
                        isOver ? 'border-gold-300 bg-gold-400/20' : 'border-gold-200/25'
                    } ${active ? 'cursor-pointer' : 'cursor-default'} ${glow ? 'animate-glow' : ''}`}
                >
                    {under.map((card) => (
                        <div key={card.id} className="absolute inset-0" style={{ transform: `rotate(${tilt(card.id)}deg)` }}>
                            <Card card={card} isWild={isWild(card, wildRank)} />
                        </div>
                    ))}
                    <AnimatePresence initial={false} custom={exitTo}>
                        {top && (
                            <motion.div
                                key={top.id}
                                className="absolute inset-0"
                                custom={exitTo}
                                initial={enterFrom ? { x: enterFrom.x, y: enterFrom.y, opacity: 0, rotate: -25, scale: 0.85 } : false}
                                animate={{ x: 0, y: 0, opacity: 1, rotate: tilt(top.id), scale: 1 }}
                                variants={{ leave: (to) => (to ? { x: to.x, y: to.y, opacity: 0, scale: 0.8 } : { opacity: 0 }) }}
                                exit="leave"
                                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                            >
                                <Card card={top} isWild={isWild(top, wildRank)} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {active && <span className="absolute inset-0 rounded-[7%/5%] ring-2 ring-gold-300/90 pointer-events-none" />}
                </button>
            </div>
            <PileLabel>{dropEnabled && dragging ? 'Drop here to discard' : 'Discard'}</PileLabel>
        </div>
    );
}
