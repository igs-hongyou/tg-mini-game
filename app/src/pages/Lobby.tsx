import { useEffect, useState } from 'react';
import { DEFAULT_MAX, DEFAULT_MIN } from '../game/guessGame';
import { useGame } from '../net/GameContext';
import { takeStartParam } from '../telegram/init';

export function Lobby() {
  const { createRoom, joinExistingRoom, status, errorMessage } = useGame();
  const [min, setMin] = useState(DEFAULT_MIN);
  const [max, setMax] = useState(DEFAULT_MAX);
  const [roomCode, setRoomCode] = useState('');
  const busy = status === 'connecting';

  useEffect(() => {
    const startParam = takeStartParam();
    if (startParam) {
      setRoomCode(startParam);
      joinExistingRoom(startParam);
    }
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <h1>猜密碼小遊戲</h1>
      <p className="hint">多人輪流猜數字，範圍會越猜越小，猜中密碼的人就輸了。</p>

      <section className="card">
        <h2>建立新房間</h2>
        <div className="row">
          <label>
            範圍下限
            <input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} />
          </label>
          <label>
            範圍上限
            <input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} />
          </label>
        </div>
        <button disabled={busy || min >= max} onClick={() => createRoom(min, max)}>
          {busy ? '建立中…' : '建立房間'}
        </button>
      </section>

      <section className="card">
        <h2>加入房間</h2>
        <input
          className="room-code-input"
          placeholder="輸入房號，例如 tgmg-AB3CD"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
        />
        <button disabled={busy || !roomCode.trim()} onClick={() => joinExistingRoom(roomCode)}>
          {busy ? '連線中…' : '加入房間'}
        </button>
      </section>

      {errorMessage && <p className="error">{errorMessage}</p>}
    </div>
  );
}
