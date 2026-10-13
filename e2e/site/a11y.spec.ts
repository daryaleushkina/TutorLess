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

test('«Тренировка» без нарушений', async ({ site: page }) => {
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

import { startSession } from '../training';
test('вопрос и итог тренировки без нарушений', async ({ site: page }) => {
  const session = await startSession(page);
  expect(await violations(page)).toEqual([]);
  for (let index = 0; index < session.items.length; index++) {
    await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
    await page.getByRole('button', { name: index < session.items.length - 1 ? /^Дальше$/ : 'К итогу', exact: true }).click();
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

import { navLink as wordsNav } from '../fixtures';
test('словарь и карточка без нарушений', async ({ site: page }) => {
 await wordsNav(page, 'Слова').click();
 await expect(page.getByRole('link', { name: /^zorble\b/ })).toBeVisible();
 expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
 await page.getByRole('link', { name: /^zorble\b/ }).click();
 await expect(page.getByRole('heading', { name: /^zorble\b/ })).toBeVisible();
 expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});
