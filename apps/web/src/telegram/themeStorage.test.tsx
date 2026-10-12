import { emitEvent, init, mockTelegramEnv } from '@tma.js/sdk-react';
import { expect, it, vi } from 'vitest';
import { readTheme, restoreTheme, saveTheme, THEME_STORAGE_KEY } from '../styles/theme';
import { telegramThemeStorage } from './sdk';

it('настоящий SDK читает и записывает тему через мост DeviceStorage; отказ и таймаут сохраняют локальный выбор', async () => {
  const device = new Map([[THEME_STORAGE_KEY, 'light']]);
  let mode: 'ok' | 'denied' | 'silent' = 'ok';
  mockTelegramEnv({
    launchParams: { tgWebAppVersion: '9.0', tgWebAppPlatform: 'android', tgWebAppThemeParams: {} },
    resetPostMessage: true,
    onEvent({ name, params }) {
      if (name !== 'web_app_device_storage_get_key' && name !== 'web_app_device_storage_save_key') return;
      if (typeof params !== 'object' || params === null || !('req_id' in params) || typeof params.req_id !== 'string') throw new Error('Нет req_id');
      if (mode === 'silent') return;
      if (mode === 'denied') {
        emitEvent('device_storage_failed', { req_id: params.req_id, error: 'DENIED' });
        return;
      }
      if (!('key' in params) || typeof params.key !== 'string') throw new Error('Нет ключа');
      if (name === 'web_app_device_storage_get_key') {
        emitEvent('device_storage_key_received', { req_id: params.req_id, value: device.get(params.key) ?? null });
      } else {
        if (!('value' in params) || typeof params.value !== 'string') throw new Error('Нет значения');
        device.set(params.key, params.value);
        emitEvent('device_storage_key_saved', { req_id: params.req_id });
      }
    },
  });
  const cleanup = init({ acceptCustomStyles: false });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const storage = telegramThemeStorage();
    expect(storage).toBeDefined();
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    await restoreTheme(storage);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(readTheme()).toBe('light');
    await saveTheme('dark', storage);
    expect(device.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(readTheme()).toBe('dark');
    mode = 'denied';
    await expect(saveTheme('light', storage)).rejects.toThrow();
    expect(readTheme()).toBe('dark');
    mode = 'silent';
    vi.useFakeTimers();
    const reading = restoreTheme(storage);
    await vi.advanceTimersByTimeAsync(3000);
    await reading;
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(warn).toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
    cleanup();
  }
});
