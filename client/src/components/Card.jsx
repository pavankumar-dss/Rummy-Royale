
import React from 'react';

const Card = ({ card, isFaceDown, onClick, isSelected, isDragging, onDragStart, onDragEnd }) => {
    const suitColors = { '♠': 'text-gray-900', '♥': 'text-red-500', '♣': 'text-gray-900', '♦': 'text-red-500' };

    if (isFaceDown || !card) {
        return (
            <div 
                className="w-20 h-32 rounded-lg bg-indigo-600 border-2 border-indigo-800 flex flex-col justify-between p-1 shadow-md select-none flex-shrink-0"
                style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, #6366f1 25%, transparent 25%, transparent 75%, #6366f1 75%, #6366f1), repeating-linear-gradient(-45deg, #6366f1 25%, transparent 25%, transparent 75%, #6366f1 75%, #6366f1)',
                    backgroundSize: '20px 20px'
                }}
            >
            </div>
        );
    }

    const isJoker = card.value === 'JOKER';
    const baseClasses = "w-20 h-32 rounded-lg bg-gray-50 border border-gray-400 flex flex-col justify-between p-1 shadow-md cursor-grab transition-all duration-200 select-none relative flex-shrink-0";
    const hoverClasses = "hover:-translate-y-2 hover:rotate-2 hover:shadow-lg";
    const selectedClasses = isSelected ? "-translate-y-3 border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.7)]" : "";
    const draggingClasses = isDragging ? "opacity-50" : "";
    
    // Joker style
    if (isJoker) {
        return (
            <div 
                className={`${baseClasses} ${hoverClasses} ${selectedClasses} ${draggingClasses} bg-gradient-to-br from-violet-600 to-purple-500 text-pink-300 flex justify-center items-center text-sm font-bold`}
                 onClick={onClick}
                 draggable
                 onDragStart={onDragStart}
                 onDragEnd={onDragEnd}
                 data-suit={card.suit}
                 data-value={card.value}
            >
                <span>JOKER</span>
            </div>
        );
    }

    // Normal card style
    return (
        <div 
            className={`${baseClasses} ${hoverClasses} ${selectedClasses} ${draggingClasses} ${suitColors[card.suit]} font-semibold text-xl`}
            onClick={onClick}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            data-suit={card.suit}
             data-value={card.value}
        >
            <span className="self-start">{card.value}</span>
            <span className="self-center text-3xl -mt-2.5">{card.suit}</span>
            <span className="self-end transform rotate-180">{card.value}</span>
        </div>
    );
};

export default Card;
