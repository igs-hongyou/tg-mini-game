import { emitEvent, isTMA, mockTelegramEnv } from '@telegram-apps/sdk-react';

// Mocks the Telegram environment only in local dev, so the app is usable in a plain
// browser tab while iterating. import.meta.env.DEV is false in the production build,
// so this whole block is tree-shaken out of the real bundle.
export async function mockTelegramEnvForDev() {
  if (!import.meta.env.DEV) return;
  if (await isTMA('complete')) return;

  const themeParams = {
    accent_text_color: '#6ab2f2',
    bg_color: '#17212b',
    button_color: '#5288c1',
    button_text_color: '#ffffff',
    destructive_text_color: '#ec3942',
    header_bg_color: '#17212b',
    hint_color: '#708499',
    link_color: '#6ab3f3',
    secondary_bg_color: '#232e3c',
    section_bg_color: '#17212b',
    section_header_text_color: '#6ab3f3',
    subtitle_text_color: '#708499',
    text_color: '#f5f5f5',
  } as const;
  const noInsets = { left: 0, top: 0, bottom: 0, right: 0 } as const;

  const fakeUserId = Math.floor(Math.random() * 1_000_000);

  const startParam = new URLSearchParams(window.location.search).get('startapp');
  const launchParamEntries: [string, string][] = [
    ['tgWebAppThemeParams', JSON.stringify(themeParams)],
    [
      'tgWebAppData',
      new URLSearchParams([
        ['auth_date', (Date.now() / 1000).toFixed(0)],
        ['hash', 'dev-mock-hash'],
        ['signature', 'dev-mock-signature'],
        ['user', JSON.stringify({ id: fakeUserId, first_name: `玩家${fakeUserId % 1000}` })],
      ]).toString(),
    ],
    ['tgWebAppVersion', '8.4'],
    ['tgWebAppPlatform', 'tdesktop'],
  ];
  if (startParam) {
    launchParamEntries.push(['tgWebAppStartParam', startParam]);
  }

  mockTelegramEnv({
    onEvent([name]) {
      if (name === 'web_app_request_theme') {
        return emitEvent('theme_changed', { theme_params: themeParams });
      }
      if (name === 'web_app_request_viewport') {
        return emitEvent('viewport_changed', {
          height: window.innerHeight,
          width: window.innerWidth,
          is_expanded: true,
          is_state_stable: true,
        });
      }
      if (name === 'web_app_request_content_safe_area') {
        return emitEvent('content_safe_area_changed', noInsets);
      }
      if (name === 'web_app_request_safe_area') {
        return emitEvent('safe_area_changed', noInsets);
      }
    },
    launchParams: new URLSearchParams(launchParamEntries),
  });

  console.info('[dev] 非 Telegram 環境，已套用模擬環境參數，僅供本機開發使用。');
}
