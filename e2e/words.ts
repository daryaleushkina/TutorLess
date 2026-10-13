import type { Page } from '@playwright/test';
import { checkScreen, expect, navLink } from './fixtures';
import { schemas } from '../packages/api-client/src';

export async function wordsScreens(page: Page) {
  await navLink(page, 'Слова').click();
  await expect(page.getByRole('link', { name: /^zorble\b/ })).toBeVisible();
  await checkScreen(page, 'words');
  await page.getByRole('searchbox', { name: 'Найти слово' }).fill('no-such-fixture');
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
  await checkScreen(page, 'words-search-empty');
  await page.getByRole('searchbox').fill('zor');
  await expect(page.getByRole('link', { name: 'flimble', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: /^zorble\b/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'zorble' })).toBeVisible();
  await expect(page.getByText('Название выдуманного объекта.', { exact: true })).toBeVisible();
  await checkScreen(page, 'words-card');
}

export async function dictionaryFlow(page: Page) {
  // Меньшая страница проверяет догрузку на шести выдуманных словах; ответы по-прежнему из настоящего API.
  await page.route('**/api/words?**', async (route) => {
    const url = new URL(route.request().url()); url.searchParams.set('limit', '2');
    await route.fulfill({ response: await route.fetch({ url: url.toString() }) });
  });
  await navLink(page, 'Слова').click();
  await expect(page.getByRole('link', { name: /^zorble\b/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'flimble', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Показать ещё' }).click();
  await expect(page.getByRole('link', { name: 'flimble', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Показать ещё' }).click();
  await expect(page.getByRole('link', { name: 'plindle', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Показать ещё' })).toHaveCount(0);
  await expect(page.locator('main li a')).toHaveCount(6);
  await page.getByRole('searchbox').fill('ZOR');
  await expect(page.getByRole('link', { name: 'flimble', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: /^zorble\b/ }).click();
  await expect(page.getByRole('heading', { name: /^zorble\b/ })).toBeVisible();
  await expect(page.getByText('Выдуманный предмет для теста.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Послушать/ })).toHaveCount(0);
  if (new URL(page.url()).pathname.startsWith('/tg/')) await page.locator('#tg-mock-back').click();
  else await page.getByRole('link', { name: 'Назад', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('ZOR');
  await page.getByRole('link', { name: 'zorbling', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'zorbling', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Синонимы', exact: true })).toHaveCount(0);
  await expect(page.locator('main blockquote')).toHaveCount(0);
}

export async function wordsRecovery(page: Page) {
  let fail = true;
  await page.route('**/api/words?**', (route) => fail ? route.fulfill({ status: 503, json: { code: 'internal', message: 'fixture', requestId: 'fixture' } }) : route.continue());
  await navLink(page, 'Слова').click();
  await expect(page.getByRole('heading', { name: 'Не получилось загрузить слова' })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect(page.getByRole('link', { name: /^zorble\b/ })).toBeVisible();
  await page.context().setOffline(true);
  await page.getByRole('searchbox').fill('zor');
  await expect(page.getByRole('heading', { name: 'Нет сети' })).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByRole('link', { name: /^zorble\b/ })).toBeVisible();
}

export async function wordsRace(page: Page) {
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  let reached = false;
  await page.route('**/api/words?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('q') === 'zor') {
      reached = true; await held;
      await route.fulfill({ json: { words: [{ id: 'd3f00000-0000-4000-8000-000000000001', lemma: 'zorble' }] } });
    } else await route.continue();
  });
  await navLink(page, 'Слова').click();
  await expect(page.getByRole('link', { name: /^zorble\b/ })).toBeVisible();
  await page.getByRole('searchbox').fill('zor');
  await expect.poll(() => reached).toBe(true);
  await page.getByRole('searchbox').fill('flim');
  await expect(page.getByRole('link', { name: 'flimble', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^zorble\b/ })).toHaveCount(0);
  release();
  await expect(page.getByRole('searchbox')).toHaveValue('flim');
  await expect(page.getByRole('link', { name: /^zorble\b/ })).toHaveCount(0);
}

export function wordList(data: unknown) { return schemas.WordList.parse(data); }
