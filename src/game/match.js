import { applyAction, createGame } from './engine.js';
import { scoreHand } from './melds.js';

/*
 * A match is a series of rounds with running counts ("count" scoring):
 * - When someone declares, every other player adds the count of their unmatched
 *   cards (see scoreHand), capped at ROUND_CAP for the round. The winner adds 0.
 * - Anyone whose total goes over the limit is eliminated and sits out later rounds.
 * - The match ends when one player (or none) is left, or when it is ended early;
 *   the lowest total among the survivors wins.
 * Like the engine, everything here is pure and JSON-serialisable.
 */

export const ROUND_CAP = 80;
export const DEFAULT_LIMIT = 200;

function dealRound(match, { rng = Math.random, now = Date.now() } = {}) {
    const seats = match.players.filter((p) => p.eliminatedIn === null).map((p) => p.id);
    const roundNumber = match.roundNumber + 1;
    const game = createGame({
        players: seats.map((id) => ({ name: match.players[id].name, isBot: match.players[id].isBot })),
        turnSeconds: match.turnSeconds,
        firstPlayer: (roundNumber - 1) % seats.length, // the opening turn rotates each round
        rng,
        now,
    });
    return { ...match, roundNumber, seats, game, status: 'PLAYING' };
}

export function createMatch({ players, limit = DEFAULT_LIMIT, turnSeconds = 0, rng = Math.random, now = Date.now() }) {
    const match = {
        id: Math.floor(rng() * 2 ** 32).toString(36),
        limit,
        turnSeconds,
        players: players.map((p, id) => ({ id, name: p.name, isBot: Boolean(p.isBot), total: 0, eliminatedIn: null })),
        rounds: [],
        roundNumber: 0,
        seats: [], // match player id for each seat in the current round's game
        game: null,
        status: 'PLAYING', // PLAYING → ROUND_OVER → PLAYING … → FINISHED
        endedEarly: false,
    };
    return dealRound(match, { rng, now });
}

// Counts for every seat in a finished game. A round with no winner (deck ran out) scores nothing.
export function scoreRound(game) {
    const winnerSeat = game.winner?.playerId ?? null;
    return game.players.map((p) => {
        if (winnerSeat === null) {
            return { seat: p.id, count: 0, raw: 0, capped: false, hasLife: null, melds: [], deadwood: p.hand };
        }
        if (p.id === winnerSeat) {
            return { seat: p.id, count: 0, raw: 0, capped: false, hasLife: true, melds: game.winner.melds, deadwood: [], winner: true };
        }
        const { count, hasLife, melds, deadwood } = scoreHand(p.hand, game.wildRank);
        return { seat: p.id, count: Math.min(count, ROUND_CAP), raw: count, capped: count > ROUND_CAP, hasLife, melds, deadwood };
    });
}

function finishRound(match) {
    const { game } = match;
    const players = match.players.map((p) => ({ ...p }));
    const results = scoreRound(game).map((r) => {
        const playerId = match.seats[r.seat];
        players[playerId].total += r.count;
        return { ...r, playerId };
    });

    const eliminated = [];
    for (const p of players) {
        if (p.eliminatedIn === null && p.total > match.limit) {
            p.eliminatedIn = match.roundNumber;
            eliminated.push(p.id);
        }
    }

    const round = {
        number: match.roundNumber,
        winnerId: game.winner ? match.seats[game.winner.playerId] : null,
        wildRank: game.wildRank,
        results,
        eliminated,
        totals: players.map((p) => p.total),
    };
    const survivors = players.filter((p) => p.eliminatedIn === null).length;
    return { ...match, players, rounds: [...match.rounds, round], status: survivors <= 1 ? 'FINISHED' : 'ROUND_OVER' };
}

/**
 * Applies an action for the player in `seat` of the current round. When the action
 * ends the round, it is scored straight away. Returns { match, error }.
 */
export function applyMatchAction(match, seat, action, options) {
    if (match.status !== 'PLAYING') return { match, error: 'The round is over.' };
    const { state, error } = applyAction(match.game, seat, action, options);
    if (error) return { match, error };
    const next = { ...match, game: state };
    return { match: state.status === 'FINISHED' ? finishRound(next) : next, error: null };
}

export const startNextRound = (match, options) => (match.status === 'ROUND_OVER' ? dealRound(match, options) : match);

export const endMatch = (match) => (match.status === 'ROUND_OVER' ? { ...match, status: 'FINISHED', endedEarly: true } : match);

// Seat of a match player in the current round, or -1 if they are sitting out (eliminated).
export const seatOf = (match, playerId) => match.seats.indexOf(playerId);

/**
 * Final order: survivors by lowest total, then eliminated players (later
 * eliminations rank higher). `winners` has more than one id on a tie.
 */
export function standings(match) {
    const outRound = (p) => p.eliminatedIn ?? Infinity;
    const ranked = [...match.players].sort((a, b) =>
        outRound(a) !== outRound(b) ? outRound(b) - outRound(a) : a.total - b.total,
    );
    const [best] = ranked;
    const winners = ranked.filter((p) => outRound(p) === outRound(best) && p.total === best.total).map((p) => p.id);
    return { ranked, winners };
}
