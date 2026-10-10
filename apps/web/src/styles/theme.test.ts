import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, readTheme, restoreTheme, saveTheme, THEME_STORAGE_KEY } from './theme';

const values = new Map<string, string>();
const dataset: Record<string, string> = {};
const scheme = { colorScheme: '' };
const meta = { setAttribute: vi.fn() };
const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };

beforeEach(() => {
  values.clear();
  vi.clearAllMocks();
  storage.getItem.mockImplementation((key) => values.get(key) ?? null);
  storage.setItem.mockImplementation((key, value) => { values.set(key, value); });
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('document', { documentElement: { dataset, style: scheme }, querySelector: () => meta });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('выбор темы на устройстве', () => {
  it.each(['light', 'dark'])('умолчание тёмное при системной и Telegram теме %s', async (external) => {
    const matchMedia = vi.fn(() => ({ matches: external === 'dark' }));
    vi.stubGlobal('matchMedia', matchMedia);
    vi.stubGlobal('Telegram', { WebApp: { colorScheme: external } });
    await restoreTheme();
    expect(dataset.theme).toBe('dark');
    expect(scheme.colorScheme).toBe('dark');
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it.each(['light', 'dark'])('сохранённая тема %s применяется и записывается', async (theme) => {
    await saveTheme(theme === 'light' ? 'light' : 'dark');
    expect(readTheme()).toBe(theme);
    await restoreTheme();
    expect(dataset.theme).toBe(theme);
    expect(values.get(THEME_STORAGE_KEY)).toBe(theme);
    expect(meta.setAttribute).toHaveBeenCalledWith('content', theme);
  });

  it.each(['broken', '', 'LIGHT'])('битое значение «%s» → тёмная', (value) => {
    values.set(THEME_STORAGE_KEY, value);
    expect(readTheme()).toBe('dark');
  });

  it('бросающий доступ к localStorage → тёмная', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
    expect(readTheme()).toBe('dark');
    await restoreTheme();
    expect(dataset.theme).toBe('dark');
  });

  it('без meta меняется атрибут и нативная схема', () => {
    vi.stubGlobal('document', { documentElement: { dataset, style: scheme }, querySelector: () => null });
    applyTheme('light');
    expect(dataset.theme).toBe('light');
    expect(scheme.colorScheme).toBe('light');
  });

  it('DeviceStorage главнее копии: первая тема синхронно, после ответа — сохранённая', async () => {
    values.set(THEME_STORAGE_KEY, 'dark');
    let answer: ((value: string | null) => void) | undefined;
    const restoring = restoreTheme({ getItem: () => new Promise((resolve) => { answer = resolve; }), setItem: vi.fn() });
    expect(dataset.theme).toBe('dark');
    answer?.('light');
    await restoring;
    expect(dataset.theme).toBe('light');
    expect(values.get(THEME_STORAGE_KEY)).toBe('light');
  });

  it('пустой DeviceStorage сохраняет локальный выбор, битый → тёмная', async () => {
    values.set(THEME_STORAGE_KEY, 'light');
    await restoreTheme({ getItem: async () => null, setItem: vi.fn() });
    expect(dataset.theme).toBe('light');
    await restoreTheme({ getItem: async () => 'corrupt', setItem: vi.fn() });
    expect(dataset.theme).toBe('dark');
    expect(values.get(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('DeviceStorage недоступен при чтении → локальная тема', async () => {
    values.set(THEME_STORAGE_KEY, 'light');
    await restoreTheme({ getItem: async () => { throw new Error('timeout'); }, setItem: vi.fn() });
    expect(dataset.theme).toBe('light');
    expect(console.warn).toHaveBeenCalled();
  });

  it('запись мини-аппа — DeviceStorage и локальная копия; отказ не меняет тему', async () => {
    const setItem = vi.fn(async () => {});
    await saveTheme('light', { getItem: vi.fn(), setItem });
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'light');
    expect(values.get(THEME_STORAGE_KEY)).toBe('light');
    setItem.mockRejectedValue(new Error('denied'));
    await expect(saveTheme('dark', { getItem: vi.fn(), setItem })).rejects.toThrow('denied');
    expect(dataset.theme).toBe('light');
    expect(readTheme()).toBe('light');
  });

  it('сайт не меняет тему, если сохранение не удалось; мини-апп хранит выбор в DeviceStorage без копии', async () => {
    applyTheme('dark');
    storage.setItem.mockImplementation(() => { throw new Error('quota'); });
    await expect(saveTheme('light')).rejects.toThrow('quota');
    expect(dataset.theme).toBe('dark');
    await saveTheme('light', { getItem: vi.fn(), setItem: vi.fn(async () => {}) });
    expect(dataset.theme).toBe('light');
    await restoreTheme({ getItem: async () => 'dark', setItem: vi.fn() });
    expect(dataset.theme).toBe('dark');
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('тема до первого кадра', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

  it('статически dark; скрипт до preload, ключ совпадает с модулем', () => {
    expect(html).toContain('data-theme="dark"');
    expect(script).toBeDefined();
    expect(script).toContain(THEME_STORAGE_KEY);
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('rel="preload"'));
  });

  it.each([null, 'dark', 'light', 'corrupt', 'throws'])('сохранённое «%s» применяется ещё до загрузки приложения', (value) => {
    const root = { dataset: { theme: 'dark' }, style: { colorScheme: '' } };
    const setAttribute = vi.fn();
    runInNewContext(script ?? '', {
      localStorage: { getItem() { if (value === 'throws') throw new Error('denied'); return value; } },
      document: { documentElement: root, querySelector: () => ({ setAttribute }) },
    });
    const wanted = value === 'light' ? 'light' : 'dark';
    expect(root.dataset.theme).toBe(wanted);
    expect(root.style.colorScheme).toBe(wanted);
    expect(setAttribute).toHaveBeenCalledWith('content', wanted);
  });
});
