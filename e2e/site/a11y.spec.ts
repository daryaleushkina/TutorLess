// Доступность (axe, WCAG 2.2 AA) на ширине проекта.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations;
}

test('вход без нарушений', async ({ page, watch }) => {
  watch(page);
  await page.goto('/signin');
  await expect(page.getByRole('button', { name: 'Вход с Apple' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('«Сегодня» без нарушений', async ({ site: page }) => {
  await expect(page.getByText('Три шага · около 25 минут')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

import { startSession } from '../training';
test('вопрос и итог тренировки без нарушений', async ({ site: page }) => {
  const session = await startSession(page);
  expect(await violations(page)).toEqual([]);
  for (let index = 0; index < session.items.length; index++) {
    await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
    await page.getByRole('button', { name: index < session.items.length - 1 ? /Дальше ·/ : 'Итог', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: '0 из 3 верно' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

import { finishForReview } from '../training';
test('список ответов, разбор и жалоба без нарушений', async ({ site: page }) => {
  await finishForReview(page);
  await page.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await expect(page.getByRole('heading', { name: 'Разбор проверки' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await page.getByRole('link', { name: /Вопрос 1, неверно/ }).click();
  await page.getByRole('button', { name: /^Почему не/ }).click();
  expect(await violations(page)).toEqual([]);
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await expect(page.getByRole('heading', { name: 'Сообщить об ошибке' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
