import type { GuessResult, Player, RoomState } from './types';

export const DEFAULT_MIN = 1;
export const DEFAULT_MAX = 100;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export class GuessError extends Error {}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createRoomState(roomId: string, hostId: string, min: number, max: number): RoomState {
  return {
    roomId,
    hostId,
    phase: 'waiting',
    players: [],
    min,
    max,
    turnOrder: [],
    currentTurnIndex: 0,
    history: [],
    loserId: null,
    round: 0,
  };
}

export function addPlayer(state: RoomState, player: Player): RoomState {
  if (state.phase !== 'waiting') {
    throw new GuessError('遊戲進行中，無法加入');
  }
  if (state.players.some((p) => p.id === player.id)) {
    return state;
  }
  if (state.players.length >= MAX_PLAYERS) {
    throw new GuessError('房間已滿');
  }
  return { ...state, players: [...state.players, player] };
}

/** A player's connection dropped or they left. Removes them from the roster and, if a round
 *  is in progress, from the turn order too — adjusting whose turn it is so the game can keep
 *  going. If too few players are left to continue, falls back to the waiting room. */
export function removePlayer(state: RoomState, playerId: string): RoomState {
  const players = state.players.filter((p) => p.id !== playerId);

  if (state.phase !== 'playing') {
    return { ...state, players };
  }

  const removedIndex = state.turnOrder.indexOf(playerId);
  if (removedIndex === -1) {
    return { ...state, players };
  }

  const turnOrder = state.turnOrder.filter((id) => id !== playerId);
  if (turnOrder.length < MIN_PLAYERS) {
    return { ...state, players, phase: 'waiting', turnOrder: [], currentTurnIndex: 0, loserId: null };
  }

  let currentTurnIndex = state.currentTurnIndex;
  if (removedIndex < currentTurnIndex) {
    currentTurnIndex -= 1;
  } else if (removedIndex === currentTurnIndex) {
    currentTurnIndex %= turnOrder.length;
  }

  return { ...state, players, turnOrder, currentTurnIndex };
}

/** Host-only: picks the secret and starts a round. Secret is returned separately and must
 *  never be included in the broadcast RoomState. */
export function startRound(state: RoomState): { state: RoomState; secret: number } {
  if (state.players.length < MIN_PLAYERS) {
    throw new GuessError(`至少需要 ${MIN_PLAYERS} 位玩家`);
  }
  const secret = state.min + Math.floor(Math.random() * (state.max - state.min + 1));
  const turnOrder = shuffle(state.players.map((p) => p.id));
  return {
    secret,
    state: {
      ...state,
      phase: 'playing',
      turnOrder,
      currentTurnIndex: 0,
      history: [],
      loserId: null,
      round: state.round + 1,
    },
  };
}

export function applyGuess(state: RoomState, secret: number, playerId: string, value: number): RoomState {
  if (state.phase !== 'playing') {
    throw new GuessError('目前不是猜測階段');
  }
  const currentPlayerId = state.turnOrder[state.currentTurnIndex];
  if (currentPlayerId !== playerId) {
    throw new GuessError('還沒輪到你');
  }
  if (!Number.isInteger(value) || value < state.min || value > state.max) {
    throw new GuessError(`請輸入 ${state.min} ~ ${state.max} 之間的整數`);
  }

  let result: GuessResult;
  let min = state.min;
  let max = state.max;

  if (value === secret) {
    result = 'correct';
  } else if (value < secret) {
    result = 'too-low';
    min = Math.max(min, value + 1);
  } else {
    result = 'too-high';
    max = Math.min(max, value - 1);
  }

  const history = [...state.history, { playerId, value, result }];

  if (result === 'correct') {
    return { ...state, min, max, history, phase: 'finished', loserId: playerId };
  }

  const nextTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  return { ...state, min, max, history, currentTurnIndex: nextTurnIndex };
}

export function resetForNewRound(state: RoomState): RoomState {
  return {
    ...state,
    phase: 'waiting',
    turnOrder: [],
    currentTurnIndex: 0,
    history: [],
    loserId: null,
  };
}
