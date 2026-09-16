import { hapticFeedbackImpactOccurred } from '@telegram-apps/sdk-react';
import { useEffect, useState } from 'react';
import { useGame } from '../net/GameContext';

const TURN_PREVIEW_COUNT = 3;
const HISTORY_PREVIEW_COUNT = 2;
const TURN_FLASH_CYCLE_MS = 200;
const TURN_FLASH_CYCLES = 5;
const TURN_FLASH_DURATION_MS = TURN_FLASH_CYCLE_MS * TURN_FLASH_CYCLES;

function playerName(id: string, players: { id: string; name: string }[]): string {
  return players.find((p) => p.id === id)?.name ?? id;
}

export function GameRoom() {
  const { state, isHost, localPlayerId, status, errorMessage, sendGuess, restart, leaveRoom } = useGame();
  const [guess, setGuess] = useState('');
  const [showAllTurnOrder, setShowAllTurnOrder] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [lastSeenRound, setLastSeenRound] = useState(state?.round);
  const [flashTurn, setFlashTurn] = useState(false);

  const isMyTurn =
    state?.phase === 'playing' && state.turnOrder[state.currentTurnIndex] === localPlayerId;

  // Grab attention the moment it becomes this player's turn: the whole page flashes a few
  // times, and on real Telegram mobile clients a haptic pulse fires alongside each flash — a
  // single tap was too easy to miss, so this repeats it instead of just picking a stronger
  // one-shot style (the SDK call is a no-op wherever haptics aren't supported, e.g. desktop).
  useEffect(() => {
    if (!isMyTurn) return;
    setFlashTurn(true);
    const pulseTimers: ReturnType<typeof setTimeout>[] = [];
    if (hapticFeedbackImpactOccurred.isAvailable()) {
      for (let i = 0; i < TURN_FLASH_CYCLES; i++) {
        pulseTimers.push(setTimeout(() => hapticFeedbackImpactOccurred('heavy'), i * TURN_FLASH_CYCLE_MS));
      }
    }
    const flashTimer = setTimeout(() => setFlashTurn(false), TURN_FLASH_DURATION_MS);
    return () => {
      clearTimeout(flashTimer);
      pulseTimers.forEach(clearTimeout);
    };
  }, [isMyTurn]);

  // Collapse both lists again at the start of a fresh round rather than carrying an
  // "expanded" view over from the previous one. Adjusting state during render (rather than
  // in an effect) avoids an extra render pass just to reset these two flags.
  if (state && state.round !== lastSeenRound) {
    setLastSeenRound(state.round);
    setShowAllTurnOrder(false);
    setShowAllHistory(false);
  }

  if (!state) return null;

  const currentPlayerId = state.turnOrder[state.currentTurnIndex];
  const hostGone = status === 'disconnected' && !isHost;

  // Rotated so "up next" reads left-to-right starting from whoever's turn it is right now.
  const upcomingOrder = [
    ...state.turnOrder.slice(state.currentTurnIndex),
    ...state.turnOrder.slice(0, state.currentTurnIndex),
  ];
  const visibleTurnOrder = showAllTurnOrder ? upcomingOrder : upcomingOrder.slice(0, TURN_PREVIEW_COUNT);
  const guessProbability = state.phase === 'playing' ? 1 / (state.max - state.min + 1) : null;

  const historyStart = showAllHistory ? 0 : Math.max(0, state.history.length - HISTORY_PREVIEW_COUNT);
  const visibleHistory = state.history.slice(historyStart);

  const guessValue = Number(guess);
  const guessInRange = Number.isInteger(guessValue) && guessValue >= state.min && guessValue <= state.max;
  const guessOutOfRange = guess !== '' && !guessInRange;

  const submitGuess = () => {
    if (!guessInRange) return;
    sendGuess(guessValue);
    setGuess('');
  };

  return (
    <div className={`page${flashTurn ? ' flash' : ''}`}>
      <h1>猜密碼中</h1>
      <p className="range-display">
        目前範圍：<strong>{state.min}</strong> ~ <strong>{state.max}</strong>
      </p>
      {guessProbability !== null && (
        <p className="hint">本次猜中機率：約 {(guessProbability * 100).toFixed(1)}%</p>
      )}

      {errorMessage && <p className="error">{errorMessage}</p>}

      {!hostGone && state.phase === 'playing' && (
        <>
          <p className="turn-indicator">
            {isMyTurn ? '輪到你猜了！' : `等待 ${playerName(currentPlayerId, state.players)} 猜測…`}
          </p>
          {isMyTurn && (
            <>
              <div className="row">
                <input
                  type="number"
                  min={state.min}
                  max={state.max}
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder={`${state.min} ~ ${state.max}`}
                />
                <button onClick={submitGuess} disabled={!guessInRange}>
                  送出
                </button>
              </div>
              {guessOutOfRange && (
                <p className="error">
                  請輸入 {state.min} ~ {state.max} 之間的整數
                </p>
              )}
            </>
          )}

          <h3>玩家順序</h3>
          <ol className="turn-order-list">
            {visibleTurnOrder.map((id, i) => (
              <li key={id} className={i === 0 ? 'current' : undefined}>
                {playerName(id, state.players)}
                {i === 0 && '（目前）'}
              </li>
            ))}
          </ol>
          {upcomingOrder.length > TURN_PREVIEW_COUNT && (
            <button className="link-button" onClick={() => setShowAllTurnOrder((v) => !v)}>
              {showAllTurnOrder ? '收合' : `展開全部 ${upcomingOrder.length} 位玩家`}
            </button>
          )}
        </>
      )}

      {state.phase === 'finished' && state.loserId && (
        <div className="result-banner">
          <h2>🎉 {playerName(state.loserId, state.players)} 猜中密碼，輸了！</h2>
          {isHost && <button onClick={restart}>再玩一局</button>}
        </div>
      )}

      <h3>猜測紀錄{state.history.length > 0 && `（共 ${state.history.length} 筆）`}</h3>
      <ol className="history-list">
        {visibleHistory.map((h, i) => {
          const absoluteIndex = historyStart + i;
          return (
            <li key={absoluteIndex}>
              {playerName(h.playerId, state.players)} 猜 {h.value} →{' '}
              {h.result === 'too-low' ? '太小' : h.result === 'too-high' ? '太大' : '猜中了！'}
            </li>
          );
        })}
      </ol>
      {state.history.length > HISTORY_PREVIEW_COUNT && (
        <button className="link-button" onClick={() => setShowAllHistory((v) => !v)}>
          {showAllHistory ? '收合' : `展開查看全部 ${state.history.length} 筆`}
        </button>
      )}

      <button className="secondary" onClick={leaveRoom}>
        離開房間
      </button>
    </div>
  );
}
