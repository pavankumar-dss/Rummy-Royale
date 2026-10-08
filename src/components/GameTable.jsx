import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    DndContext,
    DragOverlay,
    MouseSensor,
    TouchSensor,
    pointerWithin,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import Avatar from './Avatar';
import Card from './Card';
import Hand from './Hand';
import Seat from './Seat';
import { Deck, DiscardPile, DISCARD_DROP } from './Piles';
import { BulbIcon, CheckIcon, CrownIcon, ExitIcon, GroupIcon, HelpIcon, LayersIcon, MuteIcon, SparklesIcon, VolumeIcon } from './icons';
import { isWild } from '../game/cards.js';
import { NEW_GROUP, handProgress, moveCards } from '../game/groups.js';
import { play } from '../audio/sounds.js';

// Moves the dragged card into whichever group it is hovering over (live, during the drag).
function moveBetweenGroups(groups, activeId, overId) {
    const from = groups.find((g) => g.cardIds.includes(activeId));
    const to = groups.find((g) => g.id === overId) ?? groups.find((g) => g.cardIds.includes(overId));
    if (!from || !to || from.id === to.id) return groups;
    const index = to.id === overId ? to.cardIds.length : to.cardIds.indexOf(overId);
    return moveCards(groups, [activeId], to.id, index);
}

function TopBar({ event, muted, onToggleMute, onHelp, onQuit }) {
    return (
        <header className="flex items-center gap-2 px-3 sm:px-5 py-2 bg-black/40 border-b border-gold-500/20">
            <div className="flex items-center gap-1.5 text-gold-400 shrink-0">
                <CrownIcon className="w-5 h-5" />
                <span className="hidden md:inline font-display font-bold tracking-wide gold-text">Rummy Royale</span>
            </div>
            <div className="flex-1 min-w-0 text-center text-xs sm:text-sm text-gold-100/90 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                        key={event?.seq ?? 0}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="truncate"
                    >
                        {event?.message}
                    </motion.p>
                </AnimatePresence>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <button className="btn btn-ghost btn-icon" onClick={onHelp} aria-label="How to play" title="How to play">
                    <HelpIcon />
                </button>
                <button
                    className="btn btn-ghost btn-icon"
                    onClick={onToggleMute}
                    aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
                    title={muted ? 'Unmute' : 'Mute'}
                >
                    {muted ? <MuteIcon /> : <VolumeIcon />}
                </button>
                <button className="btn btn-ghost btn-icon" onClick={onQuit} aria-label="Quit to menu" title="Quit to menu">
                    <ExitIcon />
                </button>
            </div>
        </header>
    );
}

const Chip = ({ ok, children }) => (
    <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] sm:text-xs font-semibold ring-1 ${
            ok ? 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/40' : 'bg-black/25 text-white/60 ring-white/10'
        }`}
    >
        {ok && <CheckIcon className="w-3 h-3" />}
        {children}
    </span>
);

export default function GameTable({
    view,
    groups,
    selectedIds,
    hint,
    notice,
    dealing,
    turnProgress,
    muted,
    onGroupsChange,
    onToggleSelect,
    onClearSelection,
    onGroupSelected,
    onDraw,
    onDiscard,
    onDeclare,
    onSort,
    onAutoArrange,
    onHint,
    onToggleMute,
    onHelp,
    onQuit,
}) {
    const me = view.players[view.viewerId];
    const opponents = view.players.filter((p) => p.id !== view.viewerId);
    const playing = view.status === 'PLAYING';
    const myTurn = playing && view.currentPlayer === view.viewerId;
    const canDraw = myTurn && view.phase === 'DRAW';
    const canDiscard = myTurn && view.phase === 'DISCARD';
    const cardsById = new Map(me.hand.map((c) => [c.id, c]));
    const lastEvent = view.log.at(-1);

    // Direction from the table centre toward each seat, for cards flying between them.
    const seatVector = (playerId) => {
        if (playerId === view.viewerId) return { x: 0, y: 280 };
        const i = opponents.findIndex((p) => p.id === playerId);
        return { x: ((i + 1) / (opponents.length + 1) - 0.5) * 560, y: -230 };
    };
    const discardTypes = ['discard', 'timeout-discard', 'declare'];
    const enterFrom = lastEvent && discardTypes.includes(lastEvent.type) ? seatVector(lastEvent.playerId) : null;
    const exitTo = lastEvent?.type === 'pick' ? seatVector(lastEvent.playerId) : null;
    const deckFlight = lastEvent?.type === 'draw' ? { seq: lastEvent.seq, to: seatVector(lastEvent.playerId) } : null;

    const nameOf = (id) => (id === view.viewerId ? 'You' : view.players[id].name);
    const event = lastEvent && {
        seq: lastEvent.seq,
        message: lastEvent.playerId === null ? lastEvent.text : `${nameOf(lastEvent.playerId)} ${lastEvent.text}`,
    };

    // --- Drag and drop ---
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    );
    const [activeId, setActiveId] = useState(null);
    const [dragGroups, setDragGroups] = useState(null);
    const shownGroups = dragGroups ?? groups;
    const groupIds = new Set(shownGroups.map((g) => g.id));

    const collisionDetection = (args) => {
        const hits = pointerWithin(args);
        if (hits.length) return [hits.find((h) => !groupIds.has(h.id)) ?? hits[0]];
        // Pointer over empty felt: target nothing, so cards don't jump between groups
        // mid-drag and dropping in empty space leaves the hand unchanged.
        return [];
    };

    const endDrag = () => {
        setActiveId(null);
        setDragGroups(null);
    };

    const handleDragEnd = ({ active, over }) => {
        const current = dragGroups ?? groups;
        endDrag();
        if (!over) return;
        if (over.id === DISCARD_DROP) return onDiscard(active.id);
        if (over.id === NEW_GROUP) {
            play('group');
            return onGroupsChange(moveCards(current, [active.id], NEW_GROUP));
        }
        const group = current.find((g) => g.cardIds.includes(active.id));
        const from = group?.cardIds.indexOf(active.id) ?? -1;
        const to = group?.cardIds.indexOf(over.id) ?? -1;
        const next =
            to >= 0 && from !== to
                ? current.map((g) => (g === group ? { ...g, cardIds: arrayMove(g.cardIds, from, to) } : g))
                : current;
        play('select', { volume: 0.8 });
        onGroupsChange(next);
    };

    const progress = handProgress(
        groups.map((g) => g.cardIds.map((id) => cardsById.get(id)).filter(Boolean)),
        view.wildRank,
    );
    const current = view.players[view.currentPlayer];
    const prompt = !playing
        ? 'Round over'
        : canDraw
          ? 'Your turn: draw from the deck or the discard pile'
          : canDiscard
            ? 'Select a card to discard, or declare if your hand is ready'
            : `Waiting for ${current.name}…`;
    const activeCard = activeId && cardsById.get(activeId);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={({ active }) => {
                setActiveId(active.id);
                setDragGroups(groups);
                play('select', { volume: 0.6 });
            }}
            onDragOver={({ active, over }) => {
                if (!over || over.id === DISCARD_DROP || over.id === NEW_GROUP) return;
                setDragGroups((g) => moveBetweenGroups(g ?? groups, active.id, over.id));
            }}
            onDragEnd={handleDragEnd}
            onDragCancel={endDrag}
        >
            <div className="min-h-[100dvh] flex flex-col bg-felt-950">
                <TopBar event={event} muted={muted} onToggleMute={onToggleMute} onHelp={onHelp} onQuit={onQuit} />

                {/* The table */}
                <main className="flex-1 flex p-2 sm:p-4 min-h-[22rem]">
                    <div className="wood-rail flex-1 flex rounded-[2.2rem] sm:rounded-[4rem] p-2 sm:p-3">
                        <div className="felt gold-line flex-1 rounded-[1.8rem] sm:rounded-[3.3rem] flex flex-col items-center justify-between gap-4 py-4 sm:py-6 px-2 overflow-hidden">
                            <div className="relative z-10 flex justify-center gap-3 sm:gap-14 w-full">
                                {opponents.map((p, i) => (
                                    <Seat
                                        key={p.id}
                                        player={p}
                                        active={playing && view.currentPlayer === p.id}
                                        progress={turnProgress}
                                        dealing={dealing}
                                        dealDelay={0.9 + i * 0.05}
                                    />
                                ))}
                            </div>

                            <div className="relative z-10 flex items-start gap-6 sm:gap-12">
                                <Deck
                                    count={view.deckCount}
                                    wildCard={view.wildCard}
                                    wildRank={view.wildRank}
                                    active={canDraw}
                                    glow={hint?.kind === 'pile' && hint.source === 'deck'}
                                    dealing={dealing}
                                    flight={deckFlight}
                                    onClick={() => onDraw('deck')}
                                />
                                <DiscardPile
                                    recent={view.discardRecent}
                                    wildRank={view.wildRank}
                                    enterFrom={enterFrom}
                                    exitTo={exitTo}
                                    active={(canDraw && view.discardCount > 0) || (canDiscard && selectedIds.length === 1)}
                                    glow={hint?.kind === 'pile' && hint.source === 'discard'}
                                    dropEnabled={canDiscard}
                                    dragging={activeId !== null}
                                    onClick={() => (canDraw ? onDraw('discard') : onDiscard(selectedIds[0]))}
                                />
                            </div>
                            <div />
                        </div>
                    </div>
                </main>

                {/* The player's area */}
                <section
                    className={`relative border-t px-2 sm:px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-colors duration-500 ${
                        myTurn ? 'bg-gradient-to-b from-gold-500/15 to-felt-950 border-gold-400/60' : 'bg-felt-950 border-gold-500/15'
                    }`}
                >
                    <AnimatePresence>
                        {notice && (
                            <motion.div
                                key={notice.id}
                                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6 }}
                                className={`absolute left-1/2 -translate-x-1/2 -top-3 -translate-y-full z-40 max-w-[92vw] w-max rounded-xl px-4 py-2 text-sm font-medium shadow-xl ${
                                    notice.tone === 'hint'
                                        ? 'bg-gold-300 text-felt-950'
                                        : 'bg-crimson-700 text-white ring-1 ring-crimson-600'
                                }`}
                            >
                                {notice.text}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <Avatar player={me} size={46} progress={myTurn ? turnProgress : null} active={myTurn} />
                            <div className="min-w-0">
                                <p className="font-display font-bold text-base sm:text-lg leading-tight">{me.name}</p>
                                <p className={`text-xs sm:text-sm ${myTurn ? 'text-gold-200' : 'text-white/55'}`}>{prompt}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                            <Chip ok={progress.hasPure}>Pure sequence</Chip>
                            <Chip ok={progress.sequences >= 2}>Sequences {Math.min(progress.sequences, 2)}/2</Chip>
                            <Chip ok={progress.unmatched === 0}>{progress.unmatched} unmatched</Chip>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <button className="btn btn-ghost px-3 py-2 text-sm" onClick={onSort} title="Group cards by suit">
                                <LayersIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Sort</span>
                            </button>
                            <button className="btn btn-ghost px-3 py-2 text-sm" onClick={onAutoArrange} title="Find your best melds">
                                <SparklesIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Auto-arrange</span>
                            </button>
                            <button className="btn btn-ghost px-3 py-2 text-sm" onClick={onHint} disabled={!myTurn} title="Suggest a move">
                                <BulbIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Hint</span>
                            </button>
                            <button
                                className={`btn btn-gold px-4 sm:px-5 py-2 text-sm font-display tracking-wide ${hint?.kind === 'declare' ? 'animate-glow' : ''}`}
                                onClick={onDeclare}
                                disabled={!canDiscard}
                            >
                                Declare
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {selectedIds.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="flex items-center justify-center gap-2 pt-3 text-sm">
                                    <span className="text-white/60">{selectedIds.length} selected</span>
                                    {selectedIds.length >= 2 && (
                                        <button className="btn btn-ghost px-3 py-1.5" onClick={onGroupSelected}>
                                            <GroupIcon className="w-4 h-4" /> Group
                                        </button>
                                    )}
                                    {selectedIds.length === 1 && canDiscard && (
                                        <button className="btn btn-gold px-3 py-1.5" onClick={() => onDiscard(selectedIds[0])}>
                                            Discard
                                        </button>
                                    )}
                                    <button className="btn px-2 py-1.5 text-white/60 hover:text-white" onClick={onClearSelection}>
                                        Clear
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="mt-2 overflow-x-clip">
                        <Hand
                            key={view.id}
                            groups={shownGroups}
                            cardsById={cardsById}
                            wildRank={view.wildRank}
                            selectedIds={selectedIds}
                            hintId={hint?.kind === 'card' ? hint.id : null}
                            dealing={dealing}
                            drawnId={view.drawnCard?.id}
                            drawnFrom={view.drawnCard?.fromDiscard ? 'discard' : 'deck'}
                            dragging={activeId !== null}
                            onToggle={onToggleSelect}
                        />
                    </div>
                </section>
            </div>

            <DragOverlay dropAnimation={{ duration: 180 }}>
                {activeCard && <Card card={activeCard} isWild={isWild(activeCard, view.wildRank)} className="rotate-3 scale-105" />}
            </DragOverlay>
        </DndContext>
    );
}
