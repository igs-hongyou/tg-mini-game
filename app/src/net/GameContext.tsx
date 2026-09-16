import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { RoomState } from '../game/types';
import { getLocalDisplayName } from '../telegram/init';
import { hostRoom, joinRoom, type ConnectionStatus, type GameConnection } from './peer';

interface GameContextValue {
  state: RoomState | null;
  isHost: boolean;
  localPlayerId: string | null;
  roomId: string | null;
  status: ConnectionStatus | 'idle';
  errorMessage: string | null;
  createRoom: (min: number, max: number) => Promise<void>;
  joinExistingRoom: (roomId: string) => Promise<void>;
  startGame: () => void;
  restart: () => void;
  sendGuess: (value: number) => void;
  leaveRoom: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const connectionRef = useRef<GameConnection | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus | 'idle'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const localPlayerName = useRef(getLocalDisplayName()).current;
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  const attach = useCallback((connection: GameConnection) => {
    connectionRef.current?.destroy();
    connectionRef.current = connection;
    setLocalPlayerId(connection.localPlayerId);
    setIsHost(connection.isHost);
    setRoomId(connection.roomId);
    setState(connection.getState());
    setErrorMessage(null);
    connection.subscribe(setState);
    connection.onStatusChange((s, detail) => {
      setStatus(s);
      if (s === 'error') setErrorMessage(detail ?? '連線發生錯誤');
      if (s === 'disconnected' && !connection.isHost) {
        setErrorMessage('房主已離線，這一局無法繼續，請重新建立或加入房間');
      }
    });
  }, []);

  const createRoom = useCallback(
    async (min: number, max: number) => {
      setStatus('connecting');
      try {
        const connection = await hostRoom(localPlayerName, min, max);
        attach(connection);
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : '建立房間失敗');
      }
    },
    [attach, localPlayerName],
  );

  const joinExistingRoom = useCallback(
    async (roomId: string) => {
      setStatus('connecting');
      try {
        const connection = await joinRoom(roomId.trim(), localPlayerName);
        attach(connection);
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : '加入房間失敗，請確認房號是否正確');
      }
    },
    [attach, localPlayerName],
  );

  const startGame = useCallback(() => connectionRef.current?.startGame(), []);
  const restart = useCallback(() => connectionRef.current?.restart(), []);
  const sendGuess = useCallback((value: number) => connectionRef.current?.sendGuess(value), []);
  const leaveRoom = useCallback(() => {
    connectionRef.current?.destroy();
    connectionRef.current = null;
    setState(null);
    setStatus('idle');
    setErrorMessage(null);
    setLocalPlayerId(null);
    setIsHost(false);
    setRoomId(null);
  }, []);

  useEffect(() => () => connectionRef.current?.destroy(), []);

  return (
    <GameContext.Provider
      value={{
        state,
        isHost,
        localPlayerId,
        roomId,
        status,
        errorMessage,
        createRoom,
        joinExistingRoom,
        startGame,
        restart,
        sendGuess,
        leaveRoom,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
