import React from 'react';
import { isPrintedJoker } from '../game/cards.js';

/*
 * Playing cards drawn as SVG (viewBox 100×140) so they stay crisp at any size.
 * <CardDefs /> must be rendered once on the page for the shared gradients and patterns.
 */

const RED = '#c8102e';
const BLACK = '#17171c';
const GOLD = '#cfa13a';
const SUIT_COLOR = { '♠': BLACK, '♣': BLACK, '♥': RED, '♦': RED };

// Suit shapes in a 100×100 box.
const SUIT_SHAPES = {
    '♥': <path d="M50 92C50 92 4 62 4 32C4 14 17 3 31 3c9 0 16 5 19 12c3-7 10-12 19-12c14 0 27 11 27 29c0 30-46 60-46 60z" />,
    '♦': <path d="M50 2 90 50 50 98 10 50z" />,
    '♠': (
        <path d="M50 4C50 4 6 36 6 60c0 15 11 24 24 24c8 0 14-4 17-9c-1 10-5 17-13 22h32c-8-5-12-12-13-22c3 5 9 9 17 9c13 0 24-9 24-24C94 36 50 4 50 4z" />
    ),
    '♣': (
        <>
            <circle cx="50" cy="27" r="20" />
            <circle cx="27" cy="58" r="20" />
            <circle cx="73" cy="58" r="20" />
            <circle cx="50" cy="52" r="12" />
            <path d="M46 62c0 18-4 28-13 35h34c-9-7-13-17-13-35z" />
        </>
    ),
};

const Suit = ({ suit, x, y, size, flip = false }) => (
    <g
        fill={SUIT_COLOR[suit]}
        transform={`${flip ? `rotate(180 ${x} ${y}) ` : ''}translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})`}
    >
        {SUIT_SHAPES[suit]}
    </g>
);

// Classic pip layouts. Columns L/M/R, rows from top (30) to bottom (110).
const L = 31;
const M = 50;
const R = 69;
const PIPS = {
    2: [[M, 30], [M, 110]],
    3: [[M, 30], [M, 70], [M, 110]],
    4: [[L, 30], [R, 30], [L, 110], [R, 110]],
    5: [[L, 30], [R, 30], [M, 70], [L, 110], [R, 110]],
    6: [[L, 30], [R, 30], [L, 70], [R, 70], [L, 110], [R, 110]],
    7: [[L, 30], [R, 30], [M, 50], [L, 70], [R, 70], [L, 110], [R, 110]],
    8: [[L, 30], [R, 30], [M, 50], [L, 70], [R, 70], [M, 90], [L, 110], [R, 110]],
    9: [[L, 30], [R, 30], [L, 56.7], [R, 56.7], [M, 70], [L, 83.3], [R, 83.3], [L, 110], [R, 110]],
    10: [[L, 30], [R, 30], [M, 43.3], [L, 56.7], [R, 56.7], [L, 83.3], [R, 83.3], [M, 96.7], [L, 110], [R, 110]],
};

const CROWNS = {
    K: 'M34 47 36 32 42 39 46 27 50 36 54 27 58 39 64 32 66 47z',
    Q: 'M36 47 37 34 44 40 50 29 56 40 63 34 64 47z',
    J: 'M37 47V38l6 4 7-5 7 5 6-4v9z',
};

const Corner = ({ card, color }) => (
    <g>
        <text
            x="11"
            y="20"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight="700"
            fontSize={card.rank === '10' ? 15 : 18}
            letterSpacing={card.rank === '10' ? -1.5 : 0}
            fill={color}
        >
            {card.rank}
        </text>
        <Suit suit={card.suit} x={11} y={30} size={11} />
    </g>
);

function FaceArt({ card, color }) {
    const tint = color === RED ? '#fbede6' : '#edf0f4';
    return (
        <g>
            <rect x="20" y="15" width="60" height="110" rx="4" fill={tint} stroke={GOLD} strokeWidth="1.6" />
            <rect x="23.5" y="18.5" width="53" height="103" rx="3" fill="none" stroke={GOLD} strokeOpacity="0.5" strokeWidth="0.6" />
            <path d={CROWNS[card.rank]} fill="#d9ad45" stroke="#8a6418" strokeWidth="0.8" strokeLinejoin="round" />
            <circle cx="50" cy="44" r="1.6" fill={RED} />
            <text
                x="50"
                y="91"
                textAnchor="middle"
                fontFamily="Georgia, 'Times New Roman', serif"
                fontWeight="700"
                fontSize="42"
                fill={color}
            >
                {card.rank}
            </text>
            <Suit suit={card.suit} x={50} y={108} size={15} />
        </g>
    );
}

function CenterArt({ card, color }) {
    if (['J', 'Q', 'K'].includes(card.rank)) return <FaceArt card={card} color={color} />;
    if (card.rank === 'A') {
        return (
            <g>
                {card.suit === '♠' && <circle cx="50" cy="70" r="30" fill="none" stroke={GOLD} strokeWidth="1.2" />}
                <Suit suit={card.suit} x={50} y={70} size={card.suit === '♠' ? 42 : 44} />
            </g>
        );
    }
    return PIPS[card.rank].map(([x, y], i) => <Suit key={i} suit={card.suit} x={x} y={y} size={16} flip={y > 70} />);
}

const STAR = 'M50 4 61 38h36L68 59l11 35-29-22-29 22 11-35L3 38h36z';

function JokerFace() {
    return (
        <>
            <rect x="0.75" y="0.75" width="98.5" height="138.5" rx="7" fill="url(#rr-ivory)" stroke="#bfb59c" />
            <g transform="translate(4 6) scale(0.14)" fill="#6d28d9">
                <path d={STAR} />
            </g>
            <g transform="rotate(180 50 70) translate(4 6) scale(0.14)" fill="#6d28d9">
                <path d={STAR} />
            </g>
            {/* Jester's hat */}
            <path d="M30 80Q22 52 12 46q22 2 30 16q4-24 8-34q4 10 8 34q8-14 30-16Q78 52 70 80z" fill="#7c3aed" stroke="#4c1d95" strokeWidth="1" />
            <path d="M50 28q4 10 8 34q-4 6-8 18q-4-12-8-18q4-24 8-34z" fill={RED} opacity="0.9" />
            <rect x="28" y="78" width="44" height="8" rx="2" fill="#d9ad45" stroke="#8a6418" strokeWidth="0.8" />
            {[[12, 46], [50, 26], [88, 46]].map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r="4" fill="#e6bf55" stroke="#8a6418" strokeWidth="0.8" />
            ))}
            <text x="50" y="106" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontWeight="800" fontSize="13" letterSpacing="2" fill={RED}>
                JOKER
            </text>
        </>
    );
}

export function CardFaceSvg({ card }) {
    if (isPrintedJoker(card)) {
        return (
            <svg viewBox="0 0 100 140" className="block w-full h-full">
                <JokerFace />
            </svg>
        );
    }
    const color = SUIT_COLOR[card.suit];
    return (
        <svg viewBox="0 0 100 140" className="block w-full h-full">
            <rect x="0.75" y="0.75" width="98.5" height="138.5" rx="7" fill="url(#rr-ivory)" stroke="#bfb59c" />
            <CenterArt card={card} color={color} />
            <Corner card={card} color={color} />
            <g transform="rotate(180 50 70)">
                <Corner card={card} color={color} />
            </g>
        </svg>
    );
}

export function CardBackSvg() {
    return (
        <svg viewBox="0 0 100 140" className="block w-full h-full">
            <rect x="0.75" y="0.75" width="98.5" height="138.5" rx="7" fill="#7d1426" stroke="#3d0710" />
            <rect x="6" y="6" width="88" height="128" rx="4" fill="url(#rr-lattice)" stroke={GOLD} strokeWidth="1.3" />
            <circle cx="50" cy="70" r="17" fill="#5c0d1b" stroke={GOLD} strokeWidth="1.4" />
            <path d="M38 77 40 64 45 69 50 60 55 69 60 64 62 77z" fill={GOLD} />
        </svg>
    );
}

// Shared SVG definitions. Render once near the app root.
export const CardDefs = () => (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
            <linearGradient id="rr-ivory" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fffdf6" />
                <stop offset="1" stopColor="#f1ead8" />
            </linearGradient>
            <pattern id="rr-lattice" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="9" height="9" fill="#7d1426" />
                <path d="M0 0h9M0 0v9" stroke="#e6bf55" strokeOpacity="0.45" strokeWidth="1.1" />
                <circle cx="4.5" cy="4.5" r="0.9" fill="#e6bf55" fillOpacity="0.5" />
            </pattern>
        </defs>
    </svg>
);

const SIZE_CLASS = { md: 'card', sm: 'card-sm', mini: 'card-mini' };

export const CardBack = ({ size = 'md', className = '', style }) => (
    <div className={`${SIZE_CLASS[size]} card-shadow ${className}`} style={style}>
        <CardBackSvg />
    </div>
);

const Card = ({ card, size = 'md', isWild = false, selected = false, glow = false, className = '', style, onClick }) => {
    if (!card) return <CardBack size={size} className={className} style={style} />;
    const ring = selected
        ? 'ring-[3px] ring-gold-300 shadow-[0_0_18px_rgba(242,215,126,0.7)]'
        : glow
          ? 'animate-glow'
          : '';
    return (
        <div
            className={`${SIZE_CLASS[size]} relative rounded-[7%/5%] card-shadow ${ring} ${className}`}
            style={style}
            onClick={onClick}
        >
            <CardFaceSvg card={card} />
            {isWild && !isPrintedJoker(card) && size !== 'mini' && (
                <span className="absolute -top-1.5 right-0.5 rounded-full bg-gradient-to-b from-gold-300 to-gold-500 text-[0.5rem] sm:text-[0.6rem] font-extrabold tracking-wider text-felt-950 px-1.5 py-px shadow ring-1 ring-gold-700/50">
                    WILD
                </span>
            )}
        </div>
    );
};

export default Card;
