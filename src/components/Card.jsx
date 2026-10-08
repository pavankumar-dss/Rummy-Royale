import React from 'react';
import { isPrintedJoker } from '../game/cards.js';

const SIZE = 'w-12 h-[4.5rem] sm:w-20 sm:h-32';
const SUIT_COLORS = { '♠': 'text-gray-900', '♥': 'text-red-600', '♣': 'text-gray-900', '♦': 'text-red-600' };

export const CardBack = ({ className = '' }) => (
    <div
        className={`${SIZE} rounded-lg bg-indigo-600 border-2 border-indigo-800 shadow-md shrink-0 ${className}`}
        style={{
            backgroundImage:
                'repeating-linear-gradient(45deg, #6366f1 25%, transparent 25%, transparent 75%, #6366f1 75%, #6366f1)',
            backgroundSize: '16px 16px',
        }}
    />
);

const Card = ({ card, isWild = false, highlight = false, className = '', onClick }) => {
    if (!card) return <CardBack className={className} />;

    const ring = highlight ? 'ring-4 ring-yellow-400' : '';
    const base = `${SIZE} rounded-lg border shadow-md select-none relative shrink-0 transition-transform duration-150 ${ring} ${className}`;

    if (isPrintedJoker(card)) {
        return (
            <div
                className={`${base} border-purple-800 bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white flex items-center justify-center font-bold text-[0.6rem] sm:text-sm`}
                onClick={onClick}
            >
                JOKER
            </div>
        );
    }

    return (
        <div
            className={`${base} border-gray-400 bg-gray-50 ${SUIT_COLORS[card.suit]} flex flex-col justify-between p-1 font-semibold text-sm sm:text-xl`}
            onClick={onClick}
        >
            <span className="self-start leading-none">{card.rank}</span>
            <span className="self-center text-xl sm:text-3xl leading-none">{card.suit}</span>
            <span className="self-end rotate-180 leading-none">{card.rank}</span>
            {isWild && (
                <span className="absolute -top-2 -right-2 rounded-full bg-fuchsia-600 text-white text-[0.55rem] sm:text-[0.65rem] font-bold px-1.5 py-0.5 shadow">
                    WILD
                </span>
            )}
        </div>
    );
};

export default Card;
