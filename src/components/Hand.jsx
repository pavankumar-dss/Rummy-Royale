import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Card from './Card';
import { CheckIcon } from './icons';
import { isWild } from '../game/cards.js';
import { MELD } from '../game/melds.js';
import { describeGroup, NEW_GROUP } from '../game/groups.js';

export const DEAL_START_S = 1.1;
export const DEAL_STEP_S = 0.07;

const LABEL_STYLE = {
    [MELD.PURE]: 'bg-emerald-400/20 text-emerald-200 ring-emerald-300/50',
    [MELD.IMPURE]: 'bg-sky-400/20 text-sky-200 ring-sky-300/50',
    [MELD.SET]: 'bg-gold-400/20 text-gold-200 ring-gold-300/50',
    invalid: 'bg-black/30 text-white/55 ring-white/10',
};

// Where a card's entrance animation starts, decided once when it mounts.
function entranceFor({ dealing, dealIndex, justDrawn, drawnFrom, seen }) {
    if (seen) return { initial: { opacity: 0.7, scale: 0.94 }, delay: 0 };
    if (dealing) {
        return { initial: { opacity: 0, y: -260, x: 40, rotate: -12, scale: 0.85 }, delay: DEAL_START_S + dealIndex * DEAL_STEP_S };
    }
    if (justDrawn) return { initial: { opacity: 0, y: -220, x: drawnFrom === 'discard' ? 60 : -60, scale: 0.85 }, delay: 0 };
    return { initial: false, delay: 0 };
}

const SortableCard = ({ card, index, wild, selected, glow, entrance, seenIds, onToggle }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
    const [{ initial, delay }] = useState(() => entranceFor({ ...entrance, seen: seenIds.has(card.id) }));

    useEffect(() => {
        seenIds.add(card.id);
    }, [seenIds, card.id]);

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className="touch-none relative"
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
                marginLeft: index === 0 ? 0 : 'calc(var(--card-w) * var(--card-overlap))',
                zIndex: selected ? 20 : undefined,
                opacity: isDragging ? 0.25 : 1,
            }}
        >
            <motion.div
                initial={initial}
                animate={{ opacity: 1, x: 0, y: selected ? -18 : 0, rotate: 0, scale: 1 }}
                whileHover={{ y: selected ? -20 : -8 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28, delay }}
                onClick={() => onToggle(card.id)}
                className="cursor-pointer"
            >
                <Card card={card} isWild={wild} selected={selected} glow={glow} />
            </motion.div>
        </div>
    );
};

function HandGroup({ group, cards, startIndex, wildRank, selectedIds, hintId, entrance, seenIds, onToggle }) {
    const { setNodeRef, isOver } = useDroppable({ id: group.id });
    const info = describeGroup(cards, wildRank);
    const style = info.valid ? LABEL_STYLE[info.type] : LABEL_STYLE.invalid;

    return (
        <div className="flex flex-col items-center">
            <div
                ref={setNodeRef}
                className={`flex items-end px-1 pt-5 rounded-xl transition-colors ${isOver ? 'bg-gold-300/10' : ''}`}
            >
                <SortableContext items={group.cardIds} strategy={horizontalListSortingStrategy}>
                    {cards.map((card, i) => (
                        <SortableCard
                            key={card.id}
                            card={card}
                            index={i}
                            wild={isWild(card, wildRank)}
                            selected={selectedIds.includes(card.id)}
                            glow={card.id === hintId}
                            entrance={{ ...entrance, dealIndex: startIndex + i, justDrawn: card.id === entrance.drawnId }}
                            seenIds={seenIds}
                            onToggle={onToggle}
                        />
                    ))}
                </SortableContext>
            </div>
            <span
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] sm:text-[0.7rem] font-semibold ring-1 whitespace-nowrap ${style}`}
            >
                {info.valid && <CheckIcon className="w-3 h-3" />}
                {info.label}
            </span>
        </div>
    );
}

function NewGroupZone({ visible }) {
    const { setNodeRef, isOver } = useDroppable({ id: NEW_GROUP, disabled: !visible });
    if (!visible) return null;
    return (
        <div
            ref={setNodeRef}
            className={`card self-start mt-5 rounded-[7%/5%] border-2 border-dashed flex items-center justify-center text-center text-[0.6rem] sm:text-xs font-semibold px-1 transition-colors ${
                isOver ? 'border-gold-300 bg-gold-300/15 text-gold-200' : 'border-white/25 text-white/50'
            }`}
        >
            New group
        </div>
    );
}

/**
 * The player's hand as labelled groups. Tap cards to select them; drag to move
 * cards within or between groups, onto "New group", or onto the discard pile.
 */
export default function Hand({ groups, cardsById, wildRank, selectedIds, hintId, dealing, drawnId, drawnFrom, dragging, onToggle }) {
    // Cards that have already played their entrance animation (per game; Hand is keyed by game id).
    const [seenIds] = useState(() => new Set());
    const entrance = { dealing, drawnId, drawnFrom };

    const groupCards = groups.map((group) => group.cardIds.map((id) => cardsById.get(id)).filter(Boolean));
    // Position of each group's first card in the whole hand, for staggering the deal.
    const startIndexes = groupCards.map((_, i) => groupCards.slice(0, i).reduce((n, cards) => n + cards.length, 0));

    return (
        <div className="flex flex-wrap justify-center items-start gap-x-3 sm:gap-x-5 gap-y-1">
            {groups.map((group, i) => (
                <HandGroup
                    key={group.id}
                    group={group}
                    cards={groupCards[i]}
                    startIndex={startIndexes[i]}
                    wildRank={wildRank}
                    selectedIds={selectedIds}
                    hintId={hintId}
                    entrance={entrance}
                    seenIds={seenIds}
                    onToggle={onToggle}
                />
            ))}
            <NewGroupZone visible={dragging} />
        </div>
    );
}
