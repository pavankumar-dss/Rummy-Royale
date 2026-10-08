import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import confetti from 'canvas-confetti';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import MatchOver from './components/MatchOver';
import Tutorial from './components/Tutorial';
import { Overlay, Panel, RoundSummary, ScoreTable } from './components/Scoreboard';
import { CardDefs } from './components/Card';
import { DEAL_START_S, DEAL_STEP_S } from './components/Hand';
import { DROP_POINTS, getPlayerView } from './game/engine.js';
import { applyMatchAction, createMatch, endMatch, seatOf, standings, startNextRound } from './game/match.js';
import { chooseBotAction } from './game/bot.js';
import { cardLabel } from './game/cards.js';
import { NEW_GROUP, arrangeGroups, groupBySuit, moveCards, reconcileGroups } from './game/groups.js';
import { isMuted, play, setMuted, unlockAudio } from './audio/sounds.js';

const HUMAN_ID = 0; // the human's id in the match (their seat can change between rounds)
const BOT_STEP_MS = 850;
const FAST_BOT_STEP_MS = 180;
const DEAL_MS = 2300; // shuffle + deal animation before play starts
const NOTICE_MS = 3800;
const TUTORIAL_KEY = 'rummy-royale:tutorial-seen';
const DEFAULT_SETTINGS = { name: 'You', bots: 2, level: 'medium', turnSeconds: 30, limit: 200 };
const NO_CARDS = [];

function newMatch({ name, bots, level, turnSeconds, limit }) {
    const players = [
        { name, isBot: false },
        ...Array.from({ length: bots }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true, level })),
    ];
    // The first turn's clock starts once the deal animation has finished.
    return createMatch({ players, limit, turnSeconds, now: Date.now() + DEAL_MS });
}

// What a seat's player would do now. Bots also weigh their match total against the limit.
function suggestMove(match, seat, level) {
    const player = match.players[match.seats[seat]];
    return chooseBotAction(getPlayerView(match.game, seat), { level: level ?? player.level, total: player.total, limit: match.limit });
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
function playEventSound(event, humanSeat) {
    const mine = event.playerId === humanSeat;
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
        case 'drop':
            play('fan', { volume: mine ? 0.9 : 0.6 });
            play('chipsHandle', { delay: 0.25, volume: mine ? 1 : 0.6 });
            break;
        case 'declare':
        case 'last-standing':
            play('fan');
            if (mine) {
                play('win', { delay: 0.3 });
                play('chips', { delay: 1.0 });
            } else if (humanSeat !== -1) {
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

// Plays on instantly with bot moves, to the end of this round or of the whole match
// (used once the human has dropped or been eliminated).
function simulate(match, { untilRoundOver = false } = {}) {
    let m = match;
    for (let guard = 0; m.status !== 'FINISHED' && guard < 50000; guard++) {
        if (m.status === 'ROUND_OVER') {
            if (untilRoundOver) break;
            m = startNextRound(m);
            continue;
        }
        const seat = m.game.currentPlayer;
        const result = applyMatchAction(m, seat, suggestMove(m, seat));
        if (result.error) break;
        m = result.match;
    }
    return m;
}

function App() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [match, setMatch] = useState(null);
    const [groupState, setGroupState] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [notice, setNotice] = useState(null);
    const [hint, setHint] = useState(null);
    const [dealing, setDealing] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [muted, setMutedState] = useState(isMuted);
    const [showTutorial, setShowTutorial] = useState(() => !readFlag(TUTORIAL_KEY));
    const [showScores, setShowScores] = useState(false);
    const [showStandings, setShowStandings] = useState(false);
    const [fastForward, setFastForward] = useState(false);
    const lastSeq = useRef(0);
    const lastTick = useRef(null);

    const game = match?.game;
    const humanSeat = match ? seatOf(match, HUMAN_ID) : -1; // -1 once eliminated (spectating)
    // The UI only ever reads the human player's view, never the raw game state.
    const view = game && getPlayerView(game, humanSeat);
    const hand = (humanSeat !== -1 && view?.players[humanSeat].hand) || NO_CARDS;
    const human = match?.players[HUMAN_ID];
    const me = humanSeat !== -1 ? view?.players[humanSeat] : null;
    const sitOut =
        humanSeat === -1
            ? { kind: 'eliminated', round: human?.eliminatedIn }
            : me?.dropped
              ? { kind: 'dropped', points: DROP_POINTS[me.dropped] }
              : null;
    const wildRank = game?.wildRank;
    const groups = useMemo(() => reconcileGroups(groupState, hand, wildRank), [groupState, hand, wildRank]);
    const selected = useMemo(() => selectedIds.filter((id) => hand.some((c) => c.id === id)), [selectedIds, hand]);

    const showNotice = useCallback((text, tone = 'error') => {
        setNotice({ id: Date.now(), text, tone });
        if (tone === 'error') play('invalid');
    }, []);

    const dispatch = useCallback(
        (seat, action) => {
            const { match: next, error } = applyMatchAction(match, seat, action);
            if (error) {
                if (seat === humanSeat) showNotice(error);
                else console.error(`Bot in seat ${seat} made an illegal move:`, action, error);
                return false;
            }
            setMatch(next);
            if (seat === humanSeat) {
                setNotice(null);
                setHint(null);
            }
            return true;
        },
        [match, humanSeat, showNotice],
    );

    // Sounds for new game events (including bots' moves), and a chime when it's your turn.
    useEffect(() => {
        if (!game) return;
        const fresh = game.log.filter((e) => e.seq > lastSeq.current);
        if (!fresh.length) return;
        lastSeq.current = game.log.at(-1).seq;
        fresh.forEach((e) => playEventSound(e, humanSeat));

        const yourTurnNow = game.status === 'PLAYING' && game.currentPlayer === humanSeat && game.phase === 'DRAW';
        if (yourTurnNow && fresh.some((e) => e.type === 'deal')) play('turn', { delay: DEAL_MS / 1000 });
        else if (yourTurnNow && fresh.some((e) => e.playerId !== humanSeat && e.type !== 'pick' && e.type !== 'draw')) {
            play('turn', { delay: 0.35 });
        }
    }, [game, humanSeat]);

    useEffect(() => {
        if (!dealing) return;
        const timer = setTimeout(() => setDealing(false), DEAL_MS);
        return () => clearTimeout(timer);
    }, [dealing]);

    // Bots take one step (draw, then discard or declare) at a readable pace.
    useEffect(() => {
        if (match?.status !== 'PLAYING' || dealing) return;
        const bot = game.players[game.currentPlayer];
        if (!bot.isBot) return;
        const timer = setTimeout(
            () => {
                const ok = dispatch(bot.id, suggestMove(match, bot.id));
                if (!ok) {
                    // Never let a bot bug freeze the game.
                    const fallback =
                        game.phase === 'DRAW'
                            ? { type: 'draw', source: 'deck' }
                            : { type: 'discard', cardId: bot.hand.findLast((c) => c.id !== game.drawnCard?.id).id };
                    dispatch(bot.id, fallback);
                }
            },
            fastForward ? FAST_BOT_STEP_MS : BOT_STEP_MS,
        );
        return () => clearTimeout(timer);
    }, [match, game, dealing, fastForward, dispatch]);

    // Turn timer: tick the clock, sound the last five seconds, time the human out.
    useEffect(() => {
        if (match?.status !== 'PLAYING' || !game.turnDeadline) return;
        const { turnDeadline, currentPlayer } = game;
        const interval = setInterval(() => {
            const t = Date.now();
            setNow(t);
            if (currentPlayer !== humanSeat) return;
            const secondsLeft = Math.ceil((turnDeadline - t) / 1000);
            if (secondsLeft <= 5 && secondsLeft > 0 && lastTick.current !== secondsLeft) {
                lastTick.current = secondsLeft;
                play('tick');
            }
            if (t >= turnDeadline) dispatch(humanSeat, { type: 'timeout' });
        }, 250);
        return () => clearInterval(interval);
    }, [match?.status, game, humanSeat, dispatch]);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), NOTICE_MS);
        return () => clearTimeout(timer);
    }, [notice]);

    // Confetti for winning a round, and again for winning the match.
    const lastRound = match?.rounds.at(-1);
    const wonRound = match?.status !== 'PLAYING' && lastRound?.winnerId === HUMAN_ID ? `${match.id}-${lastRound.number}` : null;
    const wonMatch = showStandings && match?.status === 'FINISHED' && standings(match).winners.includes(HUMAN_ID);
    useEffect(() => {
        if (!wonRound && !wonMatch) return;
        const timers = celebrate();
        return () => timers.forEach(clearTimeout);
    }, [wonRound, wonMatch]);

    // --- Actions ---

    const resetRoundUi = () => {
        lastSeq.current = 0;
        lastTick.current = null;
        setGroupState([]);
        setSelectedIds([]);
        setHint(null);
        setNotice(null);
        setNow(Date.now()); // the clock only ticks during timed turns, so it may be stale
        setDealing(true);
    };

    const start = (next) => {
        unlockAudio();
        setSettings(next);
        setMatch(newMatch(next));
        setShowStandings(false);
        setFastForward(false);
        resetRoundUi();
    };

    const nextRound = () => {
        const next = startNextRound(match, { now: Date.now() + DEAL_MS });
        setMatch(next);
        if (seatOf(next, HUMAN_ID) !== -1) setFastForward(false); // back at the table after sitting out a drop
        resetRoundUi();
    };

    const finishEarly = () => {
        setMatch(endMatch(match));
        setShowStandings(true);
    };

    const skipToEnd = () => {
        const finished = simulate(match);
        lastSeq.current = finished.game.log.at(-1).seq; // don't replay the skipped rounds' sounds
        setMatch(finished);
        setShowStandings(true);
    };

    const skipRound = () => {
        const next = simulate(match, { untilRoundOver: true });
        lastSeq.current = next.game.log.at(-1).seq;
        setMatch(next);
    };

    const quit = () => {
        setMatch(null);
        setShowStandings(false);
        setShowScores(false);
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
        if (cardId && dispatch(humanSeat, { type: 'discard', cardId })) setSelectedIds([]);
    };

    const showHint = () => {
        const action = suggestMove(match, humanSeat, 'hard');
        let next;
        let text;
        if (action.type === 'drop') {
            const points = DROP_POINTS[me.turns === 0 ? 'first' : 'middle'];
            next = { kind: 'drop' };
            text = `This hand looks weak. Dropping now costs ${points} points, less than it's likely to cost if you play on.`;
        } else if (action.type === 'draw') {
            next = { kind: 'pile', source: action.source };
            text =
                action.source === 'discard'
                    ? `Take the ${cardLabel(view.discardTop)} from the discard pile. It fits your hand.`
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
            {match ? (
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
                    roundNumber={match.roundNumber}
                    seatTotals={match.seats.map((id) => match.players[id].total)}
                    limit={match.limit}
                    sitOut={sitOut}
                    fastForward={fastForward}
                    onToggleFastForward={() => setFastForward(!fastForward)}
                    onSkipToEnd={skipToEnd}
                    onSkipRound={skipRound}
                    onShowScores={() => setShowScores(true)}
                    onGroupsChange={setGroupState}
                    onToggleSelect={toggleSelect}
                    onClearSelection={() => setSelectedIds([])}
                    onGroupSelected={() => regroup(moveCards(groups, selected, NEW_GROUP), 'group')}
                    onDraw={(source) => dispatch(humanSeat, { type: 'draw', source })}
                    onDiscard={discard}
                    onDeclare={() => dispatch(humanSeat, { type: 'declare' })}
                    onDrop={() => dispatch(humanSeat, { type: 'drop' })}
                    onSort={() => regroup(groupBySuit(hand, wildRank))}
                    onAutoArrange={() => regroup(arrangeGroups(hand, wildRank))}
                    onHint={showHint}
                    onToggleMute={toggleMute}
                    onHelp={() => setShowTutorial(true)}
                    onQuit={quit}
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
                {match && match.status !== 'PLAYING' && !showStandings && match.rounds.length > 0 && (
                    <RoundSummary
                        key={`round-${match.id}-${match.rounds.length}`}
                        match={match}
                        humanId={HUMAN_ID}
                        onNext={nextRound}
                        onEnd={finishEarly}
                        onStandings={() => setShowStandings(true)}
                    />
                )}
                {match?.status === 'FINISHED' && showStandings && (
                    <MatchOver key={`standings-${match.id}`} match={match} humanId={HUMAN_ID} onNewMatch={() => start(settings)} onMenu={quit} />
                )}
                {showScores && match && (
                    <Overlay key="scores" onClick={() => setShowScores(false)}>
                        <Panel label="Scoreboard" className="max-w-2xl">
                            <h2 className="font-display font-bold text-2xl gold-text mb-3">Scoreboard</h2>
                            {match.rounds.length ? (
                                <ScoreTable match={match} humanId={HUMAN_ID} />
                            ) : (
                                <p className="text-white/60 text-sm">No rounds finished yet. Counts appear here after each round.</p>
                            )}
                            <div className="mt-4 text-right">
                                <button className="btn btn-gold px-5 py-2" onClick={() => setShowScores(false)}>
                                    Close
                                </button>
                            </div>
                        </Panel>
                    </Overlay>
                )}
            </AnimatePresence>
            <AnimatePresence>{showTutorial && <Tutorial key="tutorial" onClose={closeTutorial} />}</AnimatePresence>
        </MotionConfig>
    );
}

export default App;
