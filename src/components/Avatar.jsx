import React from 'react';

const avatarUrl = (player) =>
    player.isBot
        ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=0b3d27`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=f2d77e`;

/**
 * Round avatar with a gold rim. When `progress` (0–1) is given, a countdown ring
 * drains around it, shifting from gold to red as time runs out.
 */
const Avatar = ({ player, size = 44, progress = null, active = false }) => {
    const stroke = 3.5;
    const r = size / 2 - stroke / 2;
    const circumference = 2 * Math.PI * r;
    const ringColor = progress === null ? null : progress > 0.5 ? '#e6bf55' : progress > 0.2 ? '#f59e0b' : '#ef4444';

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <img
                src={avatarUrl(player)}
                alt=""
                className={`absolute rounded-full bg-felt-800 ${active ? 'ring-2 ring-gold-300' : 'ring-1 ring-gold-600/70'}`}
                style={{ inset: stroke + 1, width: size - 2 * (stroke + 1), height: size - 2 * (stroke + 1) }}
            />
            {progress !== null && (
                <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(0 0 0 / 0.35)" strokeWidth={stroke} />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - progress)}
                        style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }}
                    />
                </svg>
            )}
        </div>
    );
};

export default Avatar;
