// Direct Link Mini App set up via @BotFather's /newapp — lets anyone open the game (and
// auto-join a room via the startapp param) without having chatted with the bot before.
export const BOT_USERNAME = 'little_minigame_bot';
export const MINI_APP_SHORT_NAME = 'guessnum';

export function buildRoomDeepLink(roomId: string): string {
  return `https://t.me/${BOT_USERNAME}/${MINI_APP_SHORT_NAME}?startapp=${encodeURIComponent(roomId)}`;
}
