import { THEME_STORAGE_KEY } from '../../apps/web/src/styles/theme';
import { expect, test } from '../fixtures';

test('без сохранённого выбора тема тёмная даже при светлой теме системы', async ({ page, watch }) => {
  watch(page);
  await page.addInitScript((key) => localStorage.removeItem(key), THEME_STORAGE_KEY);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/signin');
  await expect(page.getByRole('button', { name: 'Вход с Apple' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
});

test('светлый выбор устройства сохраняется после перезагрузки при тёмной системе', async ({ page, watch }) => {
  watch(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'light'), THEME_STORAGE_KEY);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/signin');
  await expect(page.getByRole('button', { name: 'Вход с Apple' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Вход с Apple' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
});
