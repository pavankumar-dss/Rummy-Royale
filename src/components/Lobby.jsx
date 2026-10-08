import React, { useState } from 'react';
import { motion } from 'motion/react';
import Card from './Card';
import { CrownIcon, HelpIcon, MuteIcon, VolumeIcon } from './icons';

const TIMER_OPTIONS = [
    { label: 'Off', seconds: 0 },
    { label: '30s', seconds: 30 },
    { label: '60s', seconds: 60 },
];

const FAN = [
    { id: 'f1', rank: '10', suit: '♠' },
    { id: 'f2', rank: 'J', suit: '♥' },
    { id: 'f3', rank: 'Q', suit: '♣' },
    { id: 'f4', rank: 'K', suit: '♦' },
    { id: 'f5', rank: 'A', suit: '♠' },
];

const Option = ({ selected, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`btn flex-1 py-2.5 text-sm ${selected ? 'btn-gold' : 'btn-ghost'}`}
    >
        {children}
    </button>
);

const Lobby = ({ initialSettings, muted, onToggleMute, onHelp, onStart }) => {
    const [name, setName] = useState(initialSettings.name);
    const [bots, setBots] = useState(initialSettings.bots);
    const [turnSeconds, setTurnSeconds] = useState(initialSettings.turnSeconds);
    const [limit, setLimit] = useState(initialSettings.limit);

    const start = (e) => {
        e.preventDefault();
        onStart({ name: name.trim() || 'You', bots, turnSeconds, limit });
    };

    return (
        <div className="min-h-[100dvh] felt flex flex-col items-center justify-center px-4 py-10 overflow-hidden">
            <div className="absolute top-3 right-3 flex gap-2 z-10">
                <button className="btn btn-ghost btn-icon" onClick={onHelp} aria-label="How to play" title="How to play">
                    <HelpIcon />
                </button>
                <button className="btn btn-ghost btn-icon" onClick={onToggleMute} aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}>
                    {muted ? <MuteIcon /> : <VolumeIcon />}
                </button>
            </div>

            {/* A royal flush fanning open */}
            <div className="relative h-[calc(var(--card-w)*1.9)] w-[calc(var(--card-w)*3.4)] mb-2" aria-hidden="true">
                {FAN.map((card, i) => (
                    <motion.div
                        key={card.id}
                        className="absolute left-1/2 bottom-0 origin-bottom"
                        initial={{ rotate: 0, x: '-50%', y: 30, opacity: 0 }}
                        animate={{ rotate: (i - 2) * 13, x: '-50%', y: Math.abs(i - 2) * 6, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.15 + i * 0.08 }}
                    >
                        <Card card={card} />
                    </motion.div>
                ))}
            </div>

            <motion.div
                className="relative text-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <CrownIcon className="w-8 h-8 mx-auto text-gold-400 drop-shadow" />
                <h1 className="font-display font-extrabold text-5xl sm:text-7xl tracking-wide gold-text drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                    Rummy Royale
                </h1>
                <p className="mt-1 text-xs sm:text-sm uppercase tracking-[0.35em] text-gold-200/80">Indian Rummy · 13 cards</p>
            </motion.div>

            <motion.form
                onSubmit={start}
                className="panel relative mt-8 w-full max-w-md rounded-3xl p-6 sm:p-7 flex flex-col gap-5"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, type: 'spring', stiffness: 160, damping: 20 }}
            >
                <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] mb-1.5 text-gold-200/80">Your name</span>
                    <input
                        type="text"
                        maxLength={20}
                        className="w-full bg-black/30 border border-gold-500/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold-400"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </label>

                <fieldset>
                    <legend className="text-xs font-semibold uppercase tracking-[0.18em] mb-1.5 text-gold-200/80">Opponents</legend>
                    <div className="flex gap-2">
                        {[1, 2, 3].map((n) => (
                            <Option key={n} selected={bots === n} onClick={() => setBots(n)}>
                                {n} bot{n > 1 ? 's' : ''}
                            </Option>
                        ))}
                    </div>
                </fieldset>

                <fieldset>
                    <legend className="text-xs font-semibold uppercase tracking-[0.18em] mb-1.5 text-gold-200/80">Turn timer</legend>
                    <div className="flex gap-2">
                        {TIMER_OPTIONS.map((o) => (
                            <Option key={o.label} selected={turnSeconds === o.seconds} onClick={() => setTurnSeconds(o.seconds)}>
                                {o.label}
                            </Option>
                        ))}
                    </div>
                </fieldset>

                <label className="block">
                    <span className="flex items-baseline justify-between mb-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-200/80">Elimination limit</span>
                        <span className="font-display font-bold text-gold-300 tabular-nums">{limit}</span>
                    </span>
                    <input
                        type="range"
                        min={50}
                        max={500}
                        step={10}
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="w-full accent-gold-400"
                    />
                    <span className="block mt-1 text-[0.7rem] text-white/45">
                        Unmatched cards add to your count each round (max 80). Go over {limit} and you&apos;re out.
                    </span>
                </label>

                <button type="submit" className="btn btn-gold py-4 text-lg font-display font-bold tracking-wider mt-1">
                    Deal the cards
                </button>
            </motion.form>

            <p className="relative mt-6 text-[0.7rem] text-white/40">Card sounds by Kenney.nl (CC0)</p>
        </div>
    );
};

export default Lobby;
