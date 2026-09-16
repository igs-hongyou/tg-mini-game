import { init as initSdk, restoreInitData, initDataStartParam, initDataUser } from '@telegram-apps/sdk-react';
import { mockTelegramEnvForDev } from './mockEnv';

let initialized = false;

export async function initTelegram(): Promise<void> {
  if (initialized) return;
  await mockTelegramEnvForDev();
  restoreInitData();
  initSdk();
  initialized = true;
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

