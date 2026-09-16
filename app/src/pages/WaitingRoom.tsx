import { MIN_PLAYERS } from '../game/guessGame';
import { useGame } from '../net/GameContext';
import { buildRoomDeepLink } from '../telegram/botConfig';

export function WaitingRoom() {
  const { state, isHost, roomId, status, errorMessage, startGame, leaveRoom } = useGame();
  if (!state) return null;

  // Deep link into the bot's Direct Link Mini App (set up via @BotFather's /newapp) so
  // whoever opens it lands straight in this room, even if they've never messaged the bot.
  // This is copied to the clipboard rather than opened as a `t.me/share/url` link: opening
  // that link navigates Telegram's WebView away from the Mini App and closes it — which for
  // the host would also kill the WebRTC connection everyone else is relying on.
  const deepLink = roomId ? buildRoomDeepLink(roomId) : '';
  const hostGone = status === 'disconnected' && !isHost;

  const copyRoomId = async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      // clipboard API unavailable, ignore
    }
  };

  const copyInviteLink = async () => {
    if (!deepLink) return;
    try {
      await navigator.clipboard.writeText(deepLink);
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
          複製房號
        </button>
        {deepLink && (
          <button className="link-button" onClick={copyInviteLink}>
            複製邀請連結
          </button>
        )}
      </div>
      <p className="hint">複製邀請連結後，貼到任何 Telegram 對話分享即可，不會關閉這個頁面。</p>

      {errorMessage && <p className="error">{errorMessage}</p>}

      <h2>玩家（{state.players.length}）</h2>
      <ul className="player-list">
        {state.players.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.id === state.hostId && ' 👑'}
          </li>
        ))}
      </ul>

      {hostGone ? null : isHost ? (
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
