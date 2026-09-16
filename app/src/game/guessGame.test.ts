import { describe, expect, it } from 'vitest';
import { addPlayer, applyGuess, createRoomState, GuessError, removePlayer, startRound } from './guessGame';

function makeReadyRoom() {
  let state = createRoomState('ROOM1', 'p1', 1, 100);
  state = addPlayer(state, { id: 'p1', name: 'Alice' });
  state = addPlayer(state, { id: 'p2', name: 'Bob' });
  return state;
}

function makeThreePlayerRoom() {
  let state = createRoomState('ROOM1', 'p1', 1, 100);
  state = addPlayer(state, { id: 'p1', name: 'Alice' });
  state = addPlayer(state, { id: 'p2', name: 'Bob' });
  state = addPlayer(state, { id: 'p3', name: 'Carol' });
  return state;
}

describe('guessGame', () => {
  it('narrows the range on a too-low guess', () => {
    const state = makeReadyRoom();
    const { state: playing } = startRound(state);
    const secret = 50;
    const current = playing.turnOrder[0];
    const next = applyGuess(playing, secret, current, 30);
    expect(next.min).toBe(31);
    expect(next.max).toBe(100);
    expect(next.phase).toBe('playing');
    expect(next.currentTurnIndex).toBe(1 % playing.turnOrder.length);
  });

  it('narrows the range on a too-high guess', () => {
    const state = makeReadyRoom();
    const { state: playing } = startRound(state);
    const secret = 50;
    const current = playing.turnOrder[0];
    const next = applyGuess(playing, secret, current, 70);
    expect(next.min).toBe(1);
    expect(next.max).toBe(69);
  });

  it('marks the guesser as loser on a correct guess and ends the game', () => {
    const state = makeReadyRoom();
    const { state: playing } = startRound(state);
    const secret = 50;
    const current = playing.turnOrder[0];
    const next = applyGuess(playing, secret, current, 50);
    expect(next.phase).toBe('finished');
    expect(next.loserId).toBe(current);
  });

  it('rejects a guess from a player who is not on turn', () => {
    const state = makeReadyRoom();
    const { state: playing } = startRound(state);
    const notCurrent = playing.turnOrder[1];
    expect(() => applyGuess(playing, 50, notCurrent, 10)).toThrow(GuessError);
  });

  it('rejects a guess outside the current range', () => {
    const state = makeReadyRoom();
    const { state: playing } = startRound(state);
    const current = playing.turnOrder[0];
    expect(() => applyGuess(playing, 50, current, 0)).toThrow(GuessError);
    expect(() => applyGuess(playing, 50, current, 101)).toThrow(GuessError);
  });

  it('requires at least two players to start a round', () => {
    let state = createRoomState('ROOM1', 'p1', 1, 100);
    state = addPlayer(state, { id: 'p1', name: 'Alice' });
    expect(() => startRound(state)).toThrow(GuessError);
  });

  it('handles the boundary case where min equals max equals the secret', () => {
    const state = makeReadyRoom();
    const { state: playing } = startRound(state);
    const secret = 1;
    let current = playing.turnOrder[0];
    let next = applyGuess(playing, secret, current, 100);
    expect(next.max).toBe(99);
    current = next.turnOrder[next.currentTurnIndex];
    next = applyGuess(next, secret, current, 1);
    expect(next.phase).toBe('finished');
    expect(next.loserId).toBe(current);
  });

  it('removes a player from the roster while still in the waiting room', () => {
    const state = makeReadyRoom();
    const next = removePlayer(state, 'p2');
    expect(next.players.map((p) => p.id)).toEqual(['p1']);
    expect(next.phase).toBe('waiting');
  });

  it('drops a mid-game player who is not on turn and keeps pointing at the same player', () => {
    const state = makeThreePlayerRoom();
    const { state: playing } = startRound(state);
    const currentPlayer = playing.turnOrder[playing.currentTurnIndex];
    // Someone other than whoever is currently up.
    const victim = playing.turnOrder[(playing.currentTurnIndex + 1) % playing.turnOrder.length];

    const next = removePlayer(playing, victim);
    expect(next.turnOrder).not.toContain(victim);
    expect(next.turnOrder).toHaveLength(2);
    // Play continues with the same player who was already up, not skipped ahead.
    expect(next.turnOrder[next.currentTurnIndex]).toBe(currentPlayer);
  });

  it('advances the turn when the current player is the one removed', () => {
    const state = makeThreePlayerRoom();
    const { state: playing } = startRound(state);
    const current = playing.turnOrder[playing.currentTurnIndex];
    const remaining = playing.turnOrder.filter((id) => id !== current);

    const next = removePlayer(playing, current);
    expect(next.turnOrder).toEqual(remaining);
    // Whoever was next in line is now up.
    expect(next.turnOrder[next.currentTurnIndex]).toBe(remaining[0]);
  });

  it('falls back to the waiting room if too few players remain mid-game', () => {
    const state = makeReadyRoom();
    const { state: playing } = startRound(state);
    const current = playing.turnOrder[playing.currentTurnIndex];

    const next = removePlayer(playing, current);
    expect(next.phase).toBe('waiting');
    expect(next.turnOrder).toEqual([]);
    expect(next.players.map((p) => p.id)).not.toContain(current);
  });
});
