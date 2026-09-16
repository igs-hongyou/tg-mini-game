import { useState } from 'react';
import { useGame } from '../net/GameContext';

function playerName(id: string, players: { id: string; name: string }[]): string {
  return players.find((p) => p.id === id)?.name ?? id;
}

export function GameRoom() {
  const { state, isHost, localPlayerId, status, errorMessage, sendGuess, restart, leaveRoom } = useGame();
  const [guess, setGuess] = useState('');
  if (!state) return null;

  const currentPlayerId = state.turnOrder[state.currentTurnIndex];
  const isMyTurn = state.phase === 'playing' && currentPlayerId === localPlayerId;
  const hostGone = status === 'disconnected' && !isHost;

  const submitGuess = () => {
    const value = Number(guess);
    if (!Number.isInteger(value)) return;
    sendGuess(value);
    setGuess('');
  };

  return (
    <div className="page">
      <h1>猜密碼中</h1>
      <p className="range-display">
        目前範圍：<strong>{state.min}</strong> ~ <strong>{state.max}</strong>
      </p>

      {errorMessage && <p className="error">{errorMessage}</p>}

      {!hostGone && state.phase === 'playing' && (
        <>
          <p className="turn-indicator">
            {isMyTurn ? '輪到你猜了！' : `等待 ${playerName(currentPlayerId, state.players)} 猜測…`}
          </p>
          {isMyTurn && (
            <div className="row">
              <input
                type="number"
                min={state.min}
                max={state.max}
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder={`${state.min} ~ ${state.max}`}
              />
              <button onClick={submitGuess} disabled={guess === ''}>
                送出
              </button>
            </div>
          )}
        </>
      )}

      {state.phase === 'finished' && state.loserId && (
        <div className="result-banner">
          <h2>🎉 {playerName(state.loserId, state.players)} 猜中密碼，輸了！</h2>
          {isHost && <button onClick={restart}>再玩一局</button>}
        </div>
      )}

      <h3>猜測紀錄</h3>
      <ol className="history-list">
        {state.history.map((h, i) => (
          <li key={i}>
            {playerName(h.playerId, state.players)} 猜 {h.value} →{' '}
            {h.result === 'too-low' ? '太小' : h.result === 'too-high' ? '太大' : '猜中了！'}
          </li>
        ))}
      </ol>

      <button className="secondary" onClick={leaveRoom}>
        離開房間
      </button>
    </div>
  );
}
