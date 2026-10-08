import React, { useCallback, useEffect, useState } from 'react';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import GameOver from './components/GameOver';
import { applyAction, createGame, getPlayerView } from './game/engine.js';
import { chooseBotAction } from './game/bot.js';
import { sortCards } from './game/cards.js';

const HUMAN = 0;
const BOT_STEP_MS = 800;
const NOTICE_MS = 4000;
const DEFAULT_SETTINGS = { name: 'You', bots: 2, turnSeconds: 30 };

function newGame({ name, bots, turnSeconds }) {
    const players = [{ name, isBot: false }, ...Array.from({ length: bots }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true }))];
    return createGame({ players, turnSeconds });
}

function App() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [game, setGame] = useState(null);
    const [notice, setNotice] = useState(null);
    const [sortBy, setSortBy] = useState('suit');
    const [now, setNow] = useState(() => Date.now());

    // The UI only ever reads the human player's view, never the raw game state.
    const view = game && getPlayerView(game, HUMAN);

    const dispatch = useCallback(
        (playerId, action) => {
            const { state, error } = applyAction(game, playerId, action);
            if (error && playerId === HUMAN) setNotice(error);
            if (error && playerId !== HUMAN) console.error(`Bot ${playerId} made an illegal move:`, action, error);
            if (!error) {
                setGame(state);
                if (playerId === HUMAN) setNotice(null);
            }
            return !error;
        },
        [game],
    );

    // Bots take one step (draw, then discard or declare) at a readable pace.
    useEffect(() => {
        if (game?.status !== 'PLAYING') return;
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
    }, [game, dispatch]);

    // Turn timer: tick while a deadline is set, and time the human out when it passes.
    useEffect(() => {
        if (game?.status !== 'PLAYING' || !game.turnDeadline) return;
        const { turnDeadline, currentPlayer } = game;
        const interval = setInterval(() => {
            const t = Date.now();
            setNow(t);
            if (currentPlayer === HUMAN && t >= turnDeadline) dispatch(HUMAN, { type: 'timeout' });
        }, 250);
        return () => clearInterval(interval);
    }, [game, dispatch]);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), NOTICE_MS);
        return () => clearTimeout(timer);
    }, [notice]);

    const start = (next) => {
        setSettings(next);
        setGame(newGame(next));
        setNow(Date.now()); // the clock only ticks during timed turns, so it may be stale
        setNotice(null);
    };

    const sortHand = () => {
        const sorted = sortCards(view.players[HUMAN].hand, sortBy, game.wildRank);
        dispatch(HUMAN, { type: 'reorder', cardIds: sorted.map((c) => c.id) });
        setSortBy(sortBy === 'suit' ? 'rank' : 'suit');
    };

    if (!game) return <Lobby initialSettings={settings} onStart={start} />;

    if (game.status === 'FINISHED') {
        return <GameOver view={view} onPlayAgain={() => start(settings)} onMenu={() => setGame(null)} />;
    }

    const timeLeft = game.turnDeadline ? Math.max(0, Math.ceil((game.turnDeadline - now) / 1000)) : null;

    return (
        <GameTable
            view={view}
            timeLeft={timeLeft}
            sortBy={sortBy}
            notice={notice}
            onDraw={(source) => dispatch(HUMAN, { type: 'draw', source })}
            onDiscard={(card) => dispatch(HUMAN, { type: 'discard', cardId: card.id })}
            onDeclare={() => dispatch(HUMAN, { type: 'declare' })}
            onSort={sortHand}
            onReorder={(cardIds) => dispatch(HUMAN, { type: 'reorder', cardIds })}
            onQuit={() => setGame(null)}
        />
    );
}

export default App;
