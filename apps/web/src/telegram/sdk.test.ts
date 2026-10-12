import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceStorage } from '@tma.js/sdk-react';

// SDK Telegram подменён: проверяется наш порядок запуска и три исхода, а не сам @tma.js.
const sdk = vi.hoisted(() => {
  const avail = <T extends (...a: never[]) => unknown>(fn: T, available = true) =>
    Object.assign(vi.fn(fn), { isAvailable: vi.fn(() => available), ifAvailable: vi.fn() });
  const device = { getItem: avail(async () => null), setItem: avail(async () => {}) };
  return {
    init: vi.fn(),
    deviceStorage: device,
    DeviceStorage: vi.fn(function (_options: ConstructorParameters<typeof DeviceStorage>[0]) { return device; }),
    request2Fp: vi.fn(),
    createRequestId: vi.fn(),
    hapticFeedback: { impactOccurred: { ifAvailable: vi.fn() } },
    themeParams: { mount: vi.fn(), bindCssVars: vi.fn(), isDark: Object.assign(vi.fn(() => false), { sub: vi.fn(() => () => {}) }) },
    miniApp: {
      mount: vi.fn(),
      bindCssVars: vi.fn(),
      setHeaderColor: { ifAvailable: vi.fn() },
      setBgColor: { ifAvailable: vi.fn() },
      setBottomBarColor: { ifAvailable: vi.fn() },
    },
    initData: { restore: vi.fn(), raw: vi.fn((): string | undefined => 'query_id=1&hash=x'), user: vi.fn(() => ({ language_code: 'en' })) },
    mainButton: { mount: { ifAvailable: vi.fn() } },
    secondaryButton: { mount: { ifAvailable: vi.fn() } },
    swipeBehavior: { mount: { ifAvailable: vi.fn() } },
    backButton: { mount: { ifAvailable: vi.fn() } },
    viewport: {
      mount: avail(async (_o?: unknown) => {}),
      bindCssVars: vi.fn(),
      expand: { ifAvailable: vi.fn() },
      requestFullscreen: avail(async () => {}),
      isFullscreen: vi.fn(() => false),
    },
    retrieveLaunchParams: vi.fn(() => ({ tgWebAppPlatform: 'ios', tgWebAppVersion: '10.1' })),
  };
});
vi.mock('@tma.js/sdk-react', () => sdk);
vi.mock('./mockEnv', () => ({ mockTelegramEnvForDev: vi.fn(async () => {}), restoreMockChrome: vi.fn() }));

import { syncTelegramTheme, startTelegram, telegramThemeStorage } from './sdk';

function environment(opts: { hash?: string; storage?: Record<string, string>; storageThrows?: boolean } = {}) {
  vi.stubGlobal('location', { hash: opts.hash ?? '' });
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => {
      if (opts.storageThrows) throw new DOMException('denied', 'SecurityError');
      return opts.storage?.[k] ?? null;
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal('document', { documentElement: {} });
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#0A0F1F' }));
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
  sdk.init.mockImplementation(() => {});
  sdk.initData.raw.mockImplementation(() => 'query_id=1&hash=x');
  sdk.viewport.mount.mockImplementation(async () => {});
  sdk.viewport.requestFullscreen.mockImplementation(async () => {});
  sdk.viewport.requestFullscreen.isAvailable.mockReturnValue(true);
  sdk.viewport.isFullscreen.mockReturnValue(false);
  sdk.retrieveLaunchParams.mockImplementation(() => ({ tgWebAppPlatform: 'ios', tgWebAppVersion: '10.1' }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('startTelegram', () => {
  it('родные кнопки действий не монтируются; системная кнопка назад остаётся', async () => {
    environment();
    expect((await startTelegram()).kind).toBe('ok');
    expect(sdk.mainButton.mount.ifAvailable).not.toHaveBeenCalled();
    expect(sdk.secondaryButton.mount.ifAvailable).not.toHaveBeenCalled();
    expect(sdk.backButton.mount.ifAvailable).toHaveBeenCalledOnce();
  });
  it('цвета клиента применяются сразу после miniApp.mount, до ожидания viewport', async () => {
    environment();
    vi.stubGlobal('document', { documentElement: {} });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#0A0F1F' }));
    vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
    expect((await startTelegram()).kind).toBe('ok');
    for (const method of [sdk.miniApp.setHeaderColor, sdk.miniApp.setBgColor, sdk.miniApp.setBottomBarColor]) {
      expect(method.ifAvailable).toHaveBeenCalledWith('#0A0F1F');
      expect(method.ifAvailable.mock.invocationCallOrder[0]).toBeGreaterThan(sdk.miniApp.mount.mock.invocationCallOrder[0]!);
      expect(method.ifAvailable.mock.invocationCallOrder[0]).toBeLessThan(sdk.viewport.mount.mock.invocationCallOrder[0]!);
    }
  });
  it('запуск из Telegram: параметры, язык; на телефоне — полноэкранный режим', async () => {
    environment({ hash: '#tgWebAppData=x' });
    expect(await startTelegram()).toEqual({ kind: 'ok', launch: { initDataRaw: 'query_id=1&hash=x', languageCode: 'en' } });
    expect(sdk.themeParams.mount).toHaveBeenCalled();
    expect(sdk.viewport.bindCssVars).toHaveBeenCalled();
    expect(sdk.viewport.requestFullscreen).toHaveBeenCalled();
  });

  it.each([
    ['tdesktop', false],
    ['android', true],
    ['macos', false],
  ])('платформа %s — полноэкранный режим: %s', async (platform, wanted) => {
    environment();
    sdk.retrieveLaunchParams.mockImplementation(() => ({ tgWebAppPlatform: platform, tgWebAppVersion: '10.1' }));
    await startTelegram();
    expect(sdk.viewport.requestFullscreen.mock.calls.length > 0).toBe(wanted);
  });

  it('уже полноэкранный, клиент не умеет или отказал — остаёмся как есть, запуск не падает', async () => {
    environment();
    sdk.viewport.isFullscreen.mockReturnValue(true);
    expect((await startTelegram()).kind).toBe('ok');
    expect(sdk.viewport.requestFullscreen).not.toHaveBeenCalled();
    sdk.viewport.isFullscreen.mockReturnValue(false);
    sdk.viewport.requestFullscreen.mockImplementation(async () => {
      throw new Error('UNSUPPORTED');
    });
    expect((await startTelegram()).kind).toBe('ok');
    sdk.retrieveLaunchParams.mockImplementation(() => {
      throw new Error('no launch params');
    });
    expect((await startTelegram()).kind).toBe('ok');
  });

  it('клиент не ответил про размеры — живём на запасных значениях, запуск не падает', async () => {
    environment();
    sdk.viewport.mount.mockImplementation(async () => {
      throw new Error('timeout');
    });
    expect((await startTelegram()).kind).toBe('ok');
    expect(sdk.viewport.bindCssVars).not.toHaveBeenCalled();
  });

  it('SDK не принял параметры, а запустил Telegram (фрагмент адреса) — сбой, а не уход на сайт', async () => {
    environment({ hash: '#tgWebAppData=broken' });
    sdk.init.mockImplementation(() => {
      throw new Error('InvalidLaunchParamsError');
    });
    expect(await startTelegram()).toMatchObject({ kind: 'failed' });
  });

  it('то же после перезагрузки (параметры сохранены SDK) — сбой', async () => {
    environment({ storage: { 'tapps/launchParams': 'x' } });
    sdk.init.mockImplementation(() => {
      throw new Error('InvalidLaunchParamsError');
    });
    expect(await startTelegram()).toMatchObject({ kind: 'failed' });
  });

  it('/tg/ открыли в обычном браузере — это не Telegram (и при запрете хранилища тоже)', async () => {
    sdk.init.mockImplementation(() => {
      throw new Error('UnknownEnvError');
    });
    environment();
    expect(await startTelegram()).toEqual({ kind: 'not-telegram' });
    environment({ storageThrows: true });
    expect(await startTelegram()).toEqual({ kind: 'not-telegram' });
  });

  it('Telegram запустил без initData — сбой', async () => {
    environment();
    sdk.initData.raw.mockImplementation(() => undefined);
    expect(await startTelegram()).toMatchObject({ kind: 'failed' });
  });
});

describe('syncTelegramTheme', () => {
  let changed = () => {};
  const disconnect = vi.fn();
  const observe = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('MutationObserver', class {
      constructor(callback: () => void) { changed = callback; }
      observe = observe;
      disconnect = disconnect;
    });
  });
  it('тема приложения не меняется; шапке, фону и нижней панели — наш фон из токенов', () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal('document', { documentElement: { dataset } });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => ' #0E0F14 ' }));
    sdk.themeParams.isDark.mockReturnValue(true);
    syncTelegramTheme();
    expect(dataset.theme).toBeUndefined();
    expect(sdk.miniApp.setHeaderColor.ifAvailable).toHaveBeenCalledWith('#0E0F14');
    expect(sdk.miniApp.setBgColor.ifAvailable).toHaveBeenCalledWith('#0E0F14');
    expect(sdk.miniApp.setBottomBarColor.ifAvailable).toHaveBeenCalledWith('#0E0F14');
    expect(sdk.themeParams.isDark.sub).not.toHaveBeenCalled();
  });

  it('фон не в hex (токены ещё не загрузились) — цвета клиенту не трогаем', () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal('document', { documentElement: { dataset } });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));
    sdk.themeParams.isDark.mockReturnValue(false);
    syncTelegramTheme();
    expect(dataset.theme).toBeUndefined();
    expect(sdk.miniApp.setHeaderColor.ifAvailable).not.toHaveBeenCalled();
  });

  it('выбор приложения обновляет три цвета клиента; отписка снимает наблюдение', () => {
    const html = { dataset: { theme: 'dark' } };
    let background = '#0A0F1F';
    vi.stubGlobal('document', { documentElement: html });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => background }));
    const stop = syncTelegramTheme();
    expect(observe).toHaveBeenCalledWith(html, { attributes: true, attributeFilter: ['data-theme'] });
    html.dataset.theme = 'light';
    background = '#E2E3F1';
    changed();
    for (const method of [sdk.miniApp.setHeaderColor, sdk.miniApp.setBgColor, sdk.miniApp.setBottomBarColor]) {
      expect(method.ifAvailable).toHaveBeenLastCalledWith(background);
    }
    stop();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});


describe('telegramThemeStorage', () => {
  it('старый клиент → localStorage, поддерживаемый → SDK с таймаутом', async () => {
    sdk.deviceStorage.getItem.isAvailable.mockReturnValue(false);
    expect(telegramThemeStorage()).toBeUndefined();
    sdk.deviceStorage.getItem.isAvailable.mockReturnValue(true);
    sdk.deviceStorage.setItem.isAvailable.mockReturnValue(false);
    expect(telegramThemeStorage()).toBeUndefined();
    sdk.deviceStorage.setItem.isAvailable.mockReturnValue(true);
    const storage = telegramThemeStorage();
    await storage?.getItem('theme');
    await storage?.setItem('theme', 'light');
    expect(sdk.deviceStorage.getItem).toHaveBeenCalledWith('theme');
    expect(sdk.deviceStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    const options = sdk.DeviceStorage.mock.calls[0]?.[0];
    expect(typeof options?.isTma === 'function' && options.isTma()).toBe(true);
    expect(options?.version).toBe('10.1');
    options?.request('web_app_device_storage_get_key', 'device_storage_key_received', { params: { key: 'theme', req_id: 'r' } });
    expect(sdk.request2Fp).toHaveBeenCalledWith('web_app_device_storage_get_key', 'device_storage_key_received', { params: { key: 'theme', req_id: 'r' }, timeout: 3000 });
    options?.request('web_app_request_theme', 'theme_changed');
    expect(sdk.request2Fp).toHaveBeenLastCalledWith('web_app_request_theme', 'theme_changed', { timeout: 3000 });
  });
});
