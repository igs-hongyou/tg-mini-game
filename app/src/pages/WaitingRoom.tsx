import { shareURL } from '@telegram-apps/sdk-react';
import { useState } from 'react';
import { MIN_PLAYERS } from '../game/guessGame';
import { useGame } from '../net/GameContext';
import { buildRoomDeepLink } from '../telegram/botConfig';
import { isMobilePlatform } from '../telegram/init';
import { copyToClipboard } from '../utils/clipboard';

const INVITE_TEXT = '一起來猜密碼，猜中密碼的人就輸了！';
const TOAST_DURATION_MS = 2000;

export function WaitingRoom() {
  const { state, isHost, roomId, status, errorMessage, startGame, leaveRoom } = useGame();
  const [toast, setToast] = useState<string | null>(null);
  if (!state) return null;

  // Deep link into the bot's Direct Link Mini App (set up via @BotFather's /newapp) so
  // whoever opens it lands straight in this room, even if they've never messaged the bot.
  const deepLink = roomId ? buildRoomDeepLink(roomId) : '';
  const hostGone = status === 'disconnected' && !isHost;
  // Telegram's own share sheet (shareURL) closes the Mini App — expected/fine on mobile,
  // but on desktop it would also kill the host's WebRTC connection. So desktop copies the
  // link to the clipboard instead of invoking the native share sheet.
  const mobile = isMobilePlatform();

  const copyWithToast = async (text: string, successMessage: string) => {
    const ok = await copyToClipboard(text);
    setToast(ok ? successMessage : '複製失敗，請手動選取複製');
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  };

  const copyRoomId = () => {
    if (roomId) copyWithToast(roomId, '房號已複製');
  };

  const shareInvite = () => {
    if (!deepLink) return;
    if (mobile && shareURL.isAvailable()) {
      shareURL(deepLink, INVITE_TEXT);
      return;
    }
    copyWithToast(deepLink, '邀請連結已複製');
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
          <button className="link-button" onClick={shareInvite}>
            {mobile ? '分享邀請' : '複製邀請連結'}
          </button>
        )}
      </div>
      {toast && <p className="toast">{toast}</p>}
      {!mobile && <p className="hint">複製邀請連結後，貼到任何 Telegram 對話分享即可，不會關閉這個頁面。</p>}

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
