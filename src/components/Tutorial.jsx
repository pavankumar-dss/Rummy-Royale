import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Card from './Card';
import { CheckIcon } from './icons';

let nextId = 0;
const c = (label) => {
    nextId += 1;
    if (label === 'JK') return { id: `tut-${nextId}`, rank: 'JOKER', suit: null };
    return { id: `tut-${nextId}`, rank: label.slice(0, -1), suit: label.slice(-1) };
};

const Row = ({ labels, wild = [], caption, ok = true }) => (
    <div className="flex flex-col items-center">
        <div className="flex">
            {labels.map((label, i) => {
                const card = c(label);
                return (
                    <Card
                        key={`${label}-${i}`}
                        card={card}
                        size="sm"
                        isWild={wild.includes(label)}
                        style={{ marginLeft: i ? 'calc(var(--card-w) * -0.3)' : 0 }}
                    />
                );
            })}
        </div>
        <span className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${ok ? 'text-emerald-200' : 'text-red-300'}`}>
            {ok && <CheckIcon className="w-3 h-3" />}
            {caption}
        </span>
    </div>
);

const STEPS = [
    {
        title: 'Welcome to the table',
        body: 'Rummy is a race to arrange your 13 cards into melds: sets and sequences. The first player to do it, and declare, wins the round.',
        art: <Row labels={['A♠', 'K♥', 'Q♣', 'J♦', 'JK']} caption="13 cards each" />,
    },
    {
        title: 'Sequences and sets',
        body: 'A sequence is 3 or more cards of one suit in a row. A set is 3 or 4 cards of the same rank in different suits.',
        art: (
            <div className="flex flex-wrap justify-center gap-6">
                <Row labels={['9♥', '10♥', 'J♥']} caption="Pure sequence" />
                <Row labels={['7♠', '7♥', '7♣']} caption="Set" />
            </div>
        ),
    },
    {
        title: 'Jokers and wild cards',
        body: 'Printed jokers, and every card of the wild rank shown under the deck, can stand in for any card. A sequence that uses one is not pure.',
        art: (
            <div className="flex flex-wrap justify-center gap-6">
                <Row labels={['4♦', 'JK', '6♦']} caption="Sequence (with joker)" />
                <Row labels={['K♣', 'K♦', '5♠']} wild={['5♠']} caption="Set (5s are wild)" />
            </div>
        ),
    },
    {
        title: 'Your turn',
        body: 'Draw a card from the deck or the discard pile. Then tap a card and press Discard, or drag it onto the pile. Drag cards between groups, or select a few and press Group. Labels tell you when a group is a valid meld.',
        art: <Row labels={['3♣', '4♣', '5♣', '8♦']} caption="Group your melds; discard what doesn't fit" ok={false} />,
    },
    {
        title: 'Declare to win',
        body: 'You need at least 2 sequences, and at least 1 of them must be pure. Every other card must be in a set or sequence. Stuck? Try Auto-arrange or the Hint button.',
        art: (
            <div className="flex flex-wrap justify-center gap-4">
                <Row labels={['A♠', '2♠', '3♠']} caption="Pure" />
                <Row labels={['9♦', 'JK', 'J♦']} caption="Sequence" />
                <Row labels={['Q♣', 'Q♥', 'Q♠']} caption="Set" />
            </div>
        ),
    },
    {
        title: 'Counting, and knowing when to fold',
        body: 'When someone declares, everyone else adds up their unmatched cards (A, K, Q, J count 10, jokers 0). Lowest total wins the match. Dealt a bad hand? Drop before you draw for just 20 points, or 40 later on.',
        art: (
            <div className="flex flex-wrap justify-center gap-6">
                <Row labels={['K♠', 'Q♥', '9♦']} caption="Unmatched: 29 points" ok={false} />
                <Row labels={['7♣', '2♥', 'J♠']} caption="Drop now: 20 points" ok={false} />
            </div>
        ),
    },
];

export default function Tutorial({ onClose }) {
    const [step, setStep] = useState(0);
    const last = step === STEPS.length - 1;
    const { title, body, art } = STEPS[step];

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="panel rounded-3xl w-full max-w-xl p-5 sm:p-7"
                initial={{ scale: 0.92, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tutorial-title"
            >
                <p className="text-[0.65rem] uppercase tracking-[0.25em] text-gold-300/80">
                    How to play · {step + 1} / {STEPS.length}
                </p>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -24 }}
                        transition={{ duration: 0.2 }}
                    >
                        <h2 id="tutorial-title" className="mt-1 font-display text-2xl sm:text-3xl font-bold gold-text">
                            {title}
                        </h2>
                        <p className="mt-2 text-sm sm:text-base text-white/80 leading-relaxed">{body}</p>
                        <div className="mt-5 min-h-[9rem] flex items-center justify-center rounded-2xl felt gold-line p-4">{art}</div>
                    </motion.div>
                </AnimatePresence>

                <div className="mt-5 flex items-center justify-between">
                    <div className="flex gap-1.5">
                        {STEPS.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setStep(i)}
                                aria-label={`Step ${i + 1}`}
                                className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-gold-400' : 'w-2 bg-white/25'}`}
                            />
                        ))}
                    </div>
                    <div className="flex gap-2">
                        {step > 0 ? (
                            <button className="btn btn-ghost px-4 py-2" onClick={() => setStep(step - 1)}>
                                Back
                            </button>
                        ) : (
                            <button className="btn px-4 py-2 text-white/60 hover:text-white" onClick={onClose}>
                                Skip
                            </button>
                        )}
                        <button className="btn btn-gold px-5 py-2 font-display" onClick={() => (last ? onClose() : setStep(step + 1))}>
                            {last ? "Let's play" : 'Next'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
