import { THEME_STORAGE_KEY } from '../../apps/web/src/styles/theme';
import { expect, miniAppUrl, test } from '../fixtures';

test.describe('умолчание', () => {
  test.use({ savedTheme: null });
  test('без выбора устройства тема тёмная при светлых Telegram и системе', async ({ page, tgUser, tgPlatform, tgInsets, watch }) => {
    watch(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(miniAppUrl(tgUser, { tgTheme: 'light', tgPlatform, tgInsets }));
    await expect(page.getByText('Три шага · около 25 минут')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('DeviceStorage', () => {
  test.use({ savedTheme: 'dark' });
  test('DeviceStorage главнее локальной копии; цвета клиента переключаются вместе с приложением', async ({ page, tgUser, tgPlatform, tgInsets, watch }) => {
    watch(page);
    await page.addInitScript((key) => {
      localStorage.setItem(`tg-mock-device:${key}`, 'light');
    }, THEME_STORAGE_KEY);
    await page.goto(miniAppUrl(tgUser, { tgTheme: 'dark', tgPlatform, tgInsets }));
    await expect(page.getByText('Три шага · около 25 минут')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe('light');
    const colors = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      return ['--color-bg', '--tg-header-color', '--tg-bg-color', '--tg-bottom-bar-color'].map((name) => css.getPropertyValue(name).trim().toLowerCase());
    });
    expect(colors.every((color) => color === colors[0])).toBe(true);
    expect(colors[0]).not.toBe('');
  });
});
