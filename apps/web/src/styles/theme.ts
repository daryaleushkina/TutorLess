export type Theme = 'light' | 'dark';
let appliedThemeRevision = 0;
export const THEME_STORAGE_KEY = 'greprep.theme';

/** DeviceStorage передаётся только из оболочки мини-аппа: сайт не загружает SDK. */
export interface DeviceThemeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}

function parseTheme(value: unknown): Theme {
  return value === 'light' ? 'light' : 'dark';
}

export function readTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Запрет хранилища не мешает запуску: тёмное умолчание (решение Даши 10.10.2026).
    return 'dark';
  }
}

export function applyTheme(theme: Theme): void {
  appliedThemeRevision++;
  const html = document.documentElement;
  html.dataset.theme = theme;
  html.style.colorScheme = theme;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
}

function copyTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // Копия ускоряет следующий запуск; сам выбор уже хранится в DeviceStorage.
    console.warn('Не удалось сохранить локальную копию темы', error);
  }
}

export async function restoreTheme(device?: DeviceThemeStorage): Promise<void> {
  // Скрипт в head — единственный источник темы до кадра; здесь только уточнение от клиента.
  if (!device) return;
  const revision = appliedThemeRevision;
  try {
    const saved = await device.getItem(THEME_STORAGE_KEY);
    // Человек мог успеть выбрать тему в профиле, пока клиент отвечал на фоновое чтение.
    if (revision !== appliedThemeRevision) return;
    // На старом клиенте выбор мог сохраниться только локально; отсутствие ключа его не отменяет.
    if (saved === null) return;
    // Битое значение — это «выбора нет», то есть тёмная (решение Даши 10.10.2026), но не молча.
    if (saved !== 'light' && saved !== 'dark') console.warn('Непонятная тема в DeviceStorage, беру тёмную', saved);
    const theme = parseTheme(saved);
    copyTheme(theme);
    applyTheme(theme);
  } catch (error) {
    // Чтение настройки — необязательный фон: при отказе остаётся локальная тема.
    console.warn('Не удалось прочитать тему из DeviceStorage', error);
  }
}

/** Запись нужна будущему переключателю G2. Отказ основного хранилища возвращается вызывающему коду. */
export async function saveTheme(theme: Theme, device?: DeviceThemeStorage): Promise<void> {
  if (device) {
    await device.setItem(THEME_STORAGE_KEY, theme);
    copyTheme(theme);
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
  applyTheme(theme);
}
