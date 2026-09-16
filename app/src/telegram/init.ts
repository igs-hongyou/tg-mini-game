import { init as initSdk, restoreInitData, initDataUser, retrieveLaunchParams } from '@telegram-apps/sdk-react';
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

function getStartParam(): string | undefined {
  // This is the `startapp` value from a Direct Link Mini App (t.me/bot/app?startapp=...),
  // which Telegram exposes as its own top-level launch param — not initData's start_param
  // field, which is a different (attachment-menu) mechanism and stays empty here.
  try {
    return retrieveLaunchParams().tgWebAppStartParam;
  } catch {
    return undefined;
  }
}

let startParamConsumed = false;

/** The `startapp` deep-link param (used to auto-join a shared room), returned only once per
 *  session. Telegram's launch params never change after launch, so without this, leaving a
 *  room would send you straight back into it the moment Lobby remounts and re-reads the same
 *  param — you'd never actually be able to leave. */
export function takeStartParam(): string | undefined {
  if (startParamConsumed) return undefined;
  startParamConsumed = true;
  return getStartParam();
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

