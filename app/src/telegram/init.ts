import { init as initSdk, restoreInitData, initDataStartParam, initDataUser, retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { mockTelegramEnvForDev } from './mockEnv';

const MOBILE_PLATFORMS = new Set(['android', 'android_x', 'ios']);

let initialized = false;

export async function initTelegram(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await mockTelegramEnvForDev();
  try {
    restoreInitData();
    initSdk();
  } catch {
    // Opened outside Telegram in production (e.g. someone visited the bare Pages URL
    // directly) with no launch params to restore. Degrade gracefully instead of leaving
    // the app blank: the UI already falls back to guest-friendly defaults everywhere
    // this SDK data would have been used (see getStartParam / getLocalDisplayName below).
    console.warn('[telegram] 非 Telegram 環境，略過 SDK 初始化。');
  }
}

export function getStartParam(): string | undefined {
  try {
    return initDataStartParam();
  } catch {
    return undefined;
  }
}

export function getLocalDisplayName(): string {
  try {
    const user = initDataUser();
    if (user) {
      return user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(' ');
    }
  } catch {
    // not running inside Telegram / init data unavailable
  }
  return `玩家${Math.floor(Math.random() * 1000)}`;
}

/** True on Telegram's mobile clients (iOS/Android), where the native share sheet is the
 *  expected way to send a link. Everywhere else (desktop, web) we copy to the clipboard
 *  instead — see WaitingRoom.tsx for why. */
export function isMobilePlatform(): boolean {
  try {
    return MOBILE_PLATFORMS.has(retrieveLaunchParams().tgWebAppPlatform);
  } catch {
    return false;
  }
}

