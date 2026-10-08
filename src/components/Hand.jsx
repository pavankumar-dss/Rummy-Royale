import React, { useState } from 'react';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Card from './Card';
import { isWild } from '../game/cards.js';

const SortableCard = ({ card, wild, highlight, canDiscard, onDiscard }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
            {...attributes}
            {...listeners}
            className="touch-none"
        >
            <Card
                card={card}
                isWild={wild}
                highlight={highlight}
                onClick={canDiscard ? () => onDiscard(card) : undefined}
                className={canDiscard ? 'cursor-pointer hover:-translate-y-3' : 'cursor-grab'}
            />
        </div>
    );
};

// The player's hand: drag to rearrange, click a card to discard it when allowed.
const Hand = ({ cards, wildRank, highlightId, canDiscard, onDiscard, onReorder }) => {
    const [activeId, setActiveId] = useState(null);
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    );

    const handleDragEnd = ({ active, over }) => {
        setActiveId(null);
        if (!over || active.id === over.id) return;
        const ids = cards.map((c) => c.id);
        onReorder(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
    };

    const activeCard = cards.find((c) => c.id === activeId);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
        >
            <SortableContext items={cards.map((c) => c.id)} strategy={rectSortingStrategy}>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center items-center min-h-[5rem] sm:min-h-[9rem] pt-3">
                    {cards.map((card) => (
                        <SortableCard
                            key={card.id}
                            card={card}
                            wild={isWild(card, wildRank)}
                            highlight={card.id === highlightId}
                            canDiscard={canDiscard}
                            onDiscard={onDiscard}
                        />
                    ))}
                </div>
            </SortableContext>
            <DragOverlay>
                {activeCard && <Card card={activeCard} isWild={isWild(activeCard, wildRank)} className="rotate-3 opacity-90" />}
            </DragOverlay>
        </DndContext>
    );
};

export default Hand;
