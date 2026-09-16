export type GamePhase = 'waiting' | 'playing' | 'finished';

export interface Player {
  id: string;
  name: string;
}

export type GuessResult = 'too-low' | 'too-high' | 'correct';

export interface GuessRecord {
  playerId: string;
  value: number;
  result: GuessResult;
}

/** Public room state broadcast to every peer. Never contains the secret number. */
export interface RoomState {
  roomId: string;
  hostId: string;
  phase: GamePhase;
  players: Player[];
  min: number;
  max: number;
  turnOrder: string[];
  currentTurnIndex: number;
  history: GuessRecord[];
  loserId: string | null;
  round: number;
}

export type PeerMessage =
  | { type: 'join'; player: Player }
  | { type: 'state_sync'; state: RoomState }
  | { type: 'guess'; value: number }
  | { type: 'start_game' }
  | { type: 'restart' }
  | { type: 'error'; message: string };
