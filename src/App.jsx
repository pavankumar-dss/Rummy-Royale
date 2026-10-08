import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import confetti from 'canvas-confetti';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import GameOver from './components/GameOver';
import Tutorial from './components/Tutorial';
import { CardDefs } from './components/Card';
import { DEAL_START_S, DEAL_STEP_S } from './components/Hand';
import { applyAction, createGame, getPlayerView } from './game/engine.js';
import { chooseBotAction } from './game/bot.js';
import { cardLabel } from './game/cards.js';
import { NEW_GROUP, arrangeGroups, groupBySuit, moveCards, reconcileGroups } from './game/groups.js';
import { isMuted, play, setMuted, unlockAudio } from './audio/sounds.js';

const HUMAN = 0;
const BOT_STEP_MS = 850;
const DEAL_MS = 2300; // shuffle + deal animation before play starts
const NOTICE_MS = 3800;
const TUTORIAL_KEY = 'rummy-royale:tutorial-seen';
const DEFAULT_SETTINGS = { name: 'You', bots: 2, turnSeconds: 30 };
const NO_CARDS = [];

function newGame({ name, bots, turnSeconds }) {
    const players = [{ name, isBot: false }, ...Array.from({ length: bots }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true }))];
    // The first turn's clock starts once the deal animation has finished.
    return createGame({ players, turnSeconds, now: Date.now() + DEAL_MS });
}

function readFlag(key) {
    try {
        return localStorage.getItem(key) === '1';
    } catch {
        return false;
    }
}

function writeFlag(key) {
    try {
        localStorage.setItem(key, '1');
    } catch {
        // Storage unavailable: the tutorial will just show again next visit.
    }
}

// One sound per game event, so every move is heard exactly once.
function playEventSound(event) {
    const mine = event.playerId === HUMAN;
    switch (event.type) {
        case 'deal':
            play('packOpen');
            play('shuffle', { delay: 0.15, duration: 1.0 });
            for (let i = 0; i < 13; i++) play('deal', { delay: DEAL_START_S + i * DEAL_STEP_S, volume: 0.8 });
            break;
        case 'draw':
        case 'pick':
            play('draw', { volume: mine ? 1 : 0.6 });
            break;
        case 'discard':
        case 'timeout-discard':
            play('discard', { volume: mine ? 1 : 0.75 });
            break;
        case 'timeout-skip':
            play('invalid', { volume: 0.6 });
            break;
        case 'declare':
            play('fan');
            if (mine) {
                play('win', { delay: 0.3 });
                play('chips', { delay: 1.0 });
            } else {
                play('lose', { delay: 0.3 });
            }
            break;
        case 'deck-empty':
            play('lose');
            break;
        default:
    }
}

function celebrate() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return [];
    const colors = ['#f2d77e', '#e6bf55', '#fff7dd', '#1c8a52', '#c8102e'];
    return [400, 800, 1250].map((ms, i) =>
        setTimeout(() => confetti({ colors, zIndex: 60, particleCount: 90, spread: 75, origin: { x: 0.2 + i * 0.3, y: 0.65 } }), ms),
    );
}

function App() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [game, setGame] = useState(null);
    const [groupState, setGroupState] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [notice, setNotice] = useState(null);
    const [hint, setHint] = useState(null);
    const [dealing, setDealing] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [muted, setMutedState] = useState(isMuted);
    const [showTutorial, setShowTutorial] = useState(() => !readFlag(TUTORIAL_KEY));
    const lastSeq = useRef(0);
    const lastTick = useRef(null);

    // The UI only ever reads the human player's view, never the raw game state.
    const view = game && getPlayerView(game, HUMAN);
    const hand = view?.players[HUMAN].hand ?? NO_CARDS;
    const wildRank = game?.wildRank;
    const groups = useMemo(() => reconcileGroups(groupState, hand, wildRank), [groupState, hand, wildRank]);
    const selected = useMemo(() => selectedIds.filter((id) => hand.some((c) => c.id === id)), [selectedIds, hand]);

    const showNotice = useCallback((text, tone = 'error') => {
        setNotice({ id: Date.now(), text, tone });
        if (tone === 'error') play('invalid');
    }, []);

    const dispatch = useCallback(
        (playerId, action) => {
            const { state, error } = applyAction(game, playerId, action);
            if (error) {
                if (playerId === HUMAN) showNotice(error);
                else console.error(`Bot ${playerId} made an illegal move:`, action, error);
                return false;
            }
            setGame(state);
            if (playerId === HUMAN) {
                setNotice(null);
                setHint(null);
            }
            return true;
        },
        [game, showNotice],
    );

    // Sounds for new game events (including bots' moves), and a chime when it's your turn.
    useEffect(() => {
        if (!game) return;
        const fresh = game.log.filter((e) => e.seq > lastSeq.current);
        if (!fresh.length) return;
        lastSeq.current = game.log.at(-1).seq;
        fresh.forEach(playEventSound);

        const yourTurnNow = game.status === 'PLAYING' && game.currentPlayer === HUMAN && game.phase === 'DRAW';
        if (yourTurnNow && fresh.some((e) => e.type === 'deal')) play('turn', { delay: DEAL_MS / 1000 });
        else if (yourTurnNow && fresh.some((e) => e.playerId !== HUMAN && e.type !== 'pick' && e.type !== 'draw')) {
            play('turn', { delay: 0.35 });
        }
    }, [game]);

    useEffect(() => {
        if (!dealing) return;
        const timer = setTimeout(() => setDealing(false), DEAL_MS);
        return () => clearTimeout(timer);
    }, [dealing]);

    // Bots take one step (draw, then discard or declare) at a readable pace.
    useEffect(() => {
        if (game?.status !== 'PLAYING' || dealing) return;
        const bot = game.players[game.currentPlayer];
        if (!bot.isBot) return;
        const timer = setTimeout(() => {
            const ok = dispatch(bot.id, chooseBotAction(getPlayerView(game, bot.id)));
            if (!ok) {
                // Never let a bot bug freeze the game.
                const fallback =
                    game.phase === 'DRAW'
                        ? { type: 'draw', source: 'deck' }
                        : { type: 'discard', cardId: bot.hand.findLast((c) => c.id !== game.drawnCard?.id).id };
                dispatch(bot.id, fallback);
            }
        }, BOT_STEP_MS);
        return () => clearTimeout(timer);
    }, [game, dealing, dispatch]);

    // Turn timer: tick the clock, sound the last five seconds, time the human out.
    useEffect(() => {
        if (game?.status !== 'PLAYING' || !game.turnDeadline) return;
        const { turnDeadline, currentPlayer } = game;
        const interval = setInterval(() => {
            const t = Date.now();
            setNow(t);
            if (currentPlayer !== HUMAN) return;
            const secondsLeft = Math.ceil((turnDeadline - t) / 1000);
            if (secondsLeft <= 5 && secondsLeft > 0 && lastTick.current !== secondsLeft) {
                lastTick.current = secondsLeft;
                play('tick');
            }
            if (t >= turnDeadline) dispatch(HUMAN, { type: 'timeout' });
        }, 250);
        return () => clearInterval(interval);
    }, [game, dispatch]);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), NOTICE_MS);
        return () => clearTimeout(timer);
    }, [notice]);

    const humanWon = game?.status === 'FINISHED' && game.winner?.playerId === HUMAN;
    useEffect(() => {
        if (!humanWon) return;
        const timers = celebrate();
        return () => timers.forEach(clearTimeout);
    }, [humanWon]);

    // --- Actions ---

    const start = (next) => {
        unlockAudio();
        lastSeq.current = 0;
        lastTick.current = null;
        setSettings(next);
        setGame(newGame(next));
        setGroupState([]);
        setSelectedIds([]);
        setHint(null);
        setNotice(null);
        setNow(Date.now()); // the clock only ticks during timed turns, so it may be stale
        setDealing(true);
    };

    const toggleMute = () => {
        setMuted(!muted);
        setMutedState(!muted);
        if (muted) play('select');
    };

    const closeTutorial = () => {
        writeFlag(TUTORIAL_KEY);
        setShowTutorial(false);
    };

    const toggleSelect = (id) => {
        play('select', { volume: 0.7 });
        setSelectedIds(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    };

    const regroup = (next, sound = 'fan') => {
        setGroupState(next);
        setSelectedIds([]);
        play(sound);
    };

    const discard = (cardId) => {
        if (cardId && dispatch(HUMAN, { type: 'discard', cardId })) setSelectedIds([]);
    };

    const showHint = () => {
        const myView = getPlayerView(game, HUMAN);
        const action = chooseBotAction(myView);
        let next;
        let text;
        if (action.type === 'draw') {
            next = { kind: 'pile', source: action.source };
            text =
                action.source === 'discard'
                    ? `Take the ${cardLabel(myView.discardTop)} from the discard pile. It fits your hand.`
                    : "Draw from the deck. The top discard doesn't help you.";
        } else if (action.type === 'declare') {
            next = { kind: 'declare' };
            text = 'Your hand is complete. Declare now!';
        } else {
            next = { kind: 'card', id: action.cardId };
            text = `Consider discarding the ${cardLabel(hand.find((c) => c.id === action.cardId))}.`;
        }
        setHint(next);
        showNotice(text, 'hint');
        play('hint');
    };

    return (
        <MotionConfig reducedMotion="user">
            <CardDefs />
            {game ? (
                <GameTable
                    view={view}
                    groups={groups}
                    selectedIds={selected}
                    hint={hint}
                    notice={notice}
                    dealing={dealing}
                    turnProgress={
                        game.turnDeadline && game.turnSeconds
                            ? Math.min(1, Math.max(0, (game.turnDeadline - now) / (game.turnSeconds * 1000)))
                            : null
                    }
                    muted={muted}
                    onGroupsChange={setGroupState}
                    onToggleSelect={toggleSelect}
                    onClearSelection={() => setSelectedIds([])}
                    onGroupSelected={() => regroup(moveCards(groups, selected, NEW_GROUP), 'group')}
                    onDraw={(source) => dispatch(HUMAN, { type: 'draw', source })}
                    onDiscard={discard}
                    onDeclare={() => dispatch(HUMAN, { type: 'declare' })}
                    onSort={() => regroup(groupBySuit(hand, wildRank))}
                    onAutoArrange={() => regroup(arrangeGroups(hand, wildRank))}
                    onHint={showHint}
                    onToggleMute={toggleMute}
                    onHelp={() => setShowTutorial(true)}
                    onQuit={() => setGame(null)}
                />
            ) : (
                <Lobby
                    initialSettings={settings}
                    muted={muted}
                    onToggleMute={toggleMute}
                    onHelp={() => setShowTutorial(true)}
                    onStart={start}
                />
            )}

            <AnimatePresence>
                {game?.status === 'FINISHED' && (
                    <GameOver key={`over-${game.id}`} view={view} onPlayAgain={() => start(settings)} onMenu={() => setGame(null)} />
                )}
            </AnimatePresence>
            <AnimatePresence>{showTutorial && <Tutorial key="tutorial" onClose={closeTutorial} />}</AnimatePresence>
        </MotionConfig>
    );
}

export default App;
