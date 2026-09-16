import Peer, { type DataConnection } from 'peerjs';
import {
  addPlayer,
  applyGuess,
  createRoomState,
  GuessError,
  removePlayer,
  resetForNewRound,
  startRound,
} from '../game/guessGame';
import type { PeerMessage, Player, RoomState } from '../game/types';

// Free public STUN + TURN fallback so P2P can traverse restrictive/mobile-carrier NATs
// without running any infrastructure of our own. The OpenRelay credentials are published
// publicly for anyone to use; swap in your own (e.g. a free Metered.ca account) if you need
// higher reliability in production.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_PREFIX = 'tgmg-';

// WebRTC's own disconnect detection (ICE failure) can take 30s+ to fire, which left guests
// staring at a frozen "waiting for host" screen with no idea the host was gone. The host
// instead pings everyone on an interval, and guests treat prolonged silence as a disconnect
// well before the underlying ICE connection actually reports failure.
const HEARTBEAT_INTERVAL_MS = 4000;
const HEARTBEAT_TIMEOUT_MS = 12000;

// How long a guest waits for the initial connection to the host before giving up and
// showing an error, in case something hangs without ever firing a PeerJS error event.
const JOIN_TIMEOUT_MS = 15000;

export function generateRoomId(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)];
  }
  return `${ROOM_ID_PREFIX}${code}`;
}

function createPeer(id?: string): Peer {
  const options = { config: { iceServers: ICE_SERVERS } };
  return id ? new Peer(id, options) : new Peer(options);
}

function waitForOpen(peer: Peer): Promise<string> {
  return new Promise((resolve, reject) => {
    peer.on('open', (id) => resolve(id));
    peer.on('error', (err) => reject(err));
  });
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface GameConnection {
  isHost: boolean;
  localPlayerId: string;
  roomId: string;
  getState: () => RoomState;
  subscribe: (listener: (state: RoomState) => void) => () => void;
  onStatusChange: (listener: (status: ConnectionStatus, detail?: string) => void) => () => void;
  startGame: () => void;
  restart: () => void;
  sendGuess: (value: number) => void;
  destroy: () => void;
}

/** Host creates the room, holds the secret privately, and is the source of truth for RoomState.
 *  The host's player id is always its own PeerJS peer id (== roomId), so it lines up with the
 *  `conn.peer` id guests are identified by when the host validates their messages. */
export async function hostRoom(displayName: string, min: number, max: number): Promise<GameConnection> {
  const roomId = generateRoomId();
  const peer = createPeer(roomId);
  await waitForOpen(peer);

  const localPlayer: Player = { id: roomId, name: displayName };
  let state = createRoomState(roomId, localPlayer.id, min, max);
  state = addPlayer(state, localPlayer);
  let secret: number | null = null;

  const connections = new Map<string, DataConnection>();
  const listeners = new Set<(state: RoomState) => void>();
  const statusListeners = new Set<(status: ConnectionStatus, detail?: string) => void>();

  const emitState = () => listeners.forEach((l) => l(state));
  const emitStatus = (status: ConnectionStatus, detail?: string) => statusListeners.forEach((l) => l(status, detail));
  const broadcast = () => {
    const payload: PeerMessage = { type: 'state_sync', state };
    connections.forEach((conn) => {
      if (conn.open) conn.send(payload);
    });
  };
  const setState = (next: RoomState) => {
    state = next;
    emitState();
    broadcast();
  };

  const sendError = (conn: DataConnection, message: string) => {
    const payload: PeerMessage = { type: 'error', message };
    if (conn.open) conn.send(payload);
  };

  peer.on('connection', (conn) => {
    conn.on('open', () => {
      connections.set(conn.peer, conn);
      emitStatus('connected', conn.peer);
    });

    conn.on('data', (raw) => {
      const message = raw as PeerMessage;
      try {
        if (message.type === 'join') {
          // Trust conn.peer, not the client-supplied id, so it always matches how guesses
          // from this connection are identified below.
          setState(addPlayer(state, { id: conn.peer, name: message.player.name }));
        } else if (message.type === 'guess') {
          if (secret === null) throw new GuessError('遊戲尚未開始');
          setState(applyGuess(state, secret, conn.peer, message.value));
        }
      } catch (err) {
        sendError(conn, err instanceof Error ? err.message : '未知錯誤');
      }
    });

    conn.on('close', () => {
      connections.delete(conn.peer);
      setState(removePlayer(state, conn.peer));
      emitStatus('disconnected', conn.peer);
    });
  });

  peer.on('error', (err) => emitStatus('error', err.message));
  peer.on('disconnected', () => emitStatus('disconnected'));

  emitState();

  const heartbeatTimer = setInterval(() => {
    const payload: PeerMessage = { type: 'heartbeat' };
    connections.forEach((conn) => {
      if (conn.open) conn.send(payload);
    });
  }, HEARTBEAT_INTERVAL_MS);

  return {
    isHost: true,
    localPlayerId: localPlayer.id,
    roomId,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onStatusChange: (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    startGame: () => {
      const result = startRound(state);
      secret = result.secret;
      setState(result.state);
    },
    restart: () => setState(resetForNewRound(state)),
    sendGuess: (value) => {
      if (secret === null) return;
      try {
        setState(applyGuess(state, secret, localPlayer.id, value));
      } catch {
        // surfaced to the host via the thrown state being unchanged; UI reads getState()
      }
    },
    destroy: () => {
      clearInterval(heartbeatTimer);
      connections.forEach((c) => c.close());
      peer.destroy();
    },
  };
}

/** Guest connects to the host's peer id (the room id) and mirrors whatever RoomState it broadcasts.
 *  Its player id is whatever PeerJS assigns this client (see hostRoom for why that matters). */
export async function joinRoom(roomId: string, displayName: string): Promise<GameConnection> {
  const peer = createPeer();
  const myId = await waitForOpen(peer);
  const localPlayer: Player = { id: myId, name: displayName };

  const conn = peer.connect(roomId, { reliable: true });

  let state: RoomState = createRoomState(roomId, roomId, 1, 100);
  const listeners = new Set<(state: RoomState) => void>();
  const statusListeners = new Set<(status: ConnectionStatus, detail?: string) => void>();
  const emitState = () => listeners.forEach((l) => l(state));
  const emitStatus = (status: ConnectionStatus, detail?: string) => statusListeners.forEach((l) => l(status, detail));

  try {
    await new Promise<void>((resolve, reject) => {
      // Connecting to a room whose host has already left doesn't fire conn's own 'open' or
      // 'error' — the signaling server tells the *peer* it couldn't find that id, so without
      // listening here too, this would just hang forever with the guest stuck on "connecting"
      // and never told why. A timeout is also here as a last-resort net for any other failure
      // mode that similarly never fires an event.
      const timeoutTimer = setTimeout(() => {
        reject(new Error('連線逾時，請確認房號是否正確，或請房主確認房間仍在開啟'));
      }, JOIN_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timeoutTimer);
        peer.off('error', onPeerError);
      };

      const onPeerError = (err: { type: string; message: string }) => {
        cleanup();
        const message =
          err.type === 'peer-unavailable'
            ? '找不到這個房間，可能房主已經離開，請確認房號或請房主重新建立房間'
            : err.message || '加入房間失敗';
        reject(new Error(message));
      };

      conn.on('open', () => {
        cleanup();
        const payload: PeerMessage = { type: 'join', player: localPlayer };
        conn.send(payload);
        emitStatus('connected');
        resolve();
      });
      conn.on('error', (err) => {
        cleanup();
        reject(err);
      });
      peer.on('error', onPeerError);
    });
  } catch (err) {
    // Nothing has subscribed via onStatusChange yet at this point (the connection object
    // hasn't been returned to the caller) — the failure reason reaches the UI through this
    // rejection instead, which GameContext.joinExistingRoom turns into errorMessage.
    peer.destroy();
    throw err instanceof Error ? err : new Error('加入房間失敗');
  }

  let lastMessageAt = Date.now();
  let declaredDisconnected = false;
  const declareDisconnected = () => {
    if (declaredDisconnected) return;
    declaredDisconnected = true;
    clearInterval(silenceCheckTimer);
    emitStatus('disconnected');
  };

  conn.on('data', (raw) => {
    lastMessageAt = Date.now();
    const message = raw as PeerMessage;
    if (message.type === 'state_sync') {
      state = message.state;
      emitState();
    }
  });
  conn.on('close', declareDisconnected);

  peer.on('error', (err) => emitStatus('error', err.message));

  const silenceCheckTimer = setInterval(() => {
    if (Date.now() - lastMessageAt > HEARTBEAT_TIMEOUT_MS) declareDisconnected();
  }, HEARTBEAT_INTERVAL_MS);

  const send = (message: PeerMessage) => {
    if (conn.open) conn.send(message);
  };

  return {
    isHost: false,
    localPlayerId: localPlayer.id,
    roomId,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onStatusChange: (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    startGame: () => send({ type: 'start_game' }),
    restart: () => send({ type: 'restart' }),
    sendGuess: (value) => send({ type: 'guess', value }),
    destroy: () => {
      clearInterval(silenceCheckTimer);
      conn.close();
      peer.destroy();
    },
  };
}
