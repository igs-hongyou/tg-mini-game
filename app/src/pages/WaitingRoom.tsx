import { MIN_PLAYERS } from '../game/guessGame';
import { useGame } from '../net/GameContext';
import { buildRoomDeepLink } from '../telegram/botConfig';

export function WaitingRoom() {
  const { state, isHost, roomId, startGame, leaveRoom } = useGame();
  if (!state) return null;

  // Deep link into the bot's Direct Link Mini App (set up via @BotFather's /newapp) so
  // whoever opens it lands straight in this room, even if they've never messaged the bot.
  const deepLink = roomId ? buildRoomDeepLink(roomId) : '';
  const shareLink = deepLink
    ? `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent('一起來猜密碼，猜中密碼的人就輸了！')}`
    : '';

  const copyRoomId = async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      // clipboard API unavailable, ignore
    }
  };

  return (
    <div className="page">
      <h1>等候室</h1>
      <div className="room-code-display">
        房號：<strong>{roomId}</strong>
        <button className="link-button" onClick={copyRoomId}>
          複製
        </button>
        {shareLink && (
          <a className="link-button" href={shareLink} target="_blank" rel="noreferrer">
            分享到 Telegram
          </a>
        )}
      </div>

      <h2>玩家（{state.players.length}）</h2>
      <ul className="player-list">
        {state.players.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.id === state.hostId && ' 👑'}
          </li>
        ))}
      </ul>

      {isHost ? (
        <button disabled={state.players.length < MIN_PLAYERS} onClick={startGame}>
          {state.players.length < MIN_PLAYERS ? `至少需要 ${MIN_PLAYERS} 位玩家` : '開始遊戲'}
        </button>
      ) : (
        <p className="hint">等待房主開始遊戲…</p>
      )}

      <button className="secondary" onClick={leaveRoom}>
        離開房間
      </button>
    </div>
  );
}
