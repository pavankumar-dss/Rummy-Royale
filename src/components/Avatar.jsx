import React from 'react';

const avatarUrl = (player) =>
    player.isBot
        ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.name)}`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=b6e3f4`;

const Avatar = ({ player, className = 'w-8 h-8' }) => (
    <img src={avatarUrl(player)} alt="" className={`${className} rounded-full bg-white shrink-0`} />
);

export default Avatar;
