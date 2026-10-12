// Каждый экран сайта на ширине своего проекта: вёрстка и эталонный снимок (AGENTS.md, «Тесты»).
import { schemas } from '../../packages/api-client/src';
import { checkScreen, expect, navLink, test } from '../fixtures';

// Имя аккаунта стенда уникально для изоляции; на эталонах отображаем одно синтетическое имя.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/me', async (route) => {
    const response = await route.fetch();
    if (!response.ok()) { await route.fulfill({ response }); return; }
    const account = schemas.User.parse(await response.json());
    await route.fulfill({ response, json: { ...account, name: 'Тест', identities: [{ provider: 'apple', linkedAt: '2026-10-01T00:00:00Z' }] } });
  });
});

test('вход', async ({ page, watch }) => {
  watch(page);
  await page.goto('/signin');
  await expect(page.getByRole('button', { name: 'Вход с Apple' })).toBeVisible();
  // Вход подменой — только на стенде; на снимке его нет, чтобы эталон был тем экраном, что видят люди.
  await page.locator('form').evaluate((form) => { form.style.display = 'none'; });
  await checkScreen(page, 'signin');
  await page.goto('/signin?reason=expired');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.locator('form').evaluate((form) => { form.style.display = 'none'; });
  await checkScreen(page, 'signin-expired');
  await page.goto('/signin?reason=failed');
  await expect(page.getByRole('alert')).toHaveText('Не получилось войти. Попробуйте ещё раз.');
  await page.locator('form').evaluate((form) => { form.style.display = 'none'; });
  await checkScreen(page, 'signin-failed');
});

test('главная T2, пустые вкладки и настройки', async ({ site: page }) => {
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.', { exact: true })).toBeVisible();
  await checkScreen(page, 'home');
  await navLink(page, 'Слова').click();
  await expect(page.getByText('Здесь будут слова: учить, повторять и искать.')).toBeVisible();
  await checkScreen(page, 'words');
  await navLink(page, 'Экзамен').click();
  await expect(page.getByText('Здесь будут пробные экзамены GRE и эссе с оценкой.')).toBeVisible();
  await checkScreen(page, 'exam');
  await navLink(page, 'Прогресс').click();
  await expect(page.getByText('Здесь будет точность по разделам, история тренировок и примерный балл.')).toBeVisible();
  await checkScreen(page, 'progress');
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
  await expect(page.getByText('Вход с Apple', { exact: true })).toBeVisible();
  if (page.viewportSize()!.width >= 900) await expect(page.getByRole('navigation', { name: 'Разделы' }).locator('[aria-current="page"]')).toHaveCount(1);
  await checkScreen(page, 'settings');
  await page.getByRole('button', { name: 'Крупнее', exact: true }).click();
  await checkScreen(page, 'profile-large');
  await page.getByRole('button', { name: 'Обычный', exact: true }).click();

});

test('конструктор и темы тренировки', async ({ site: page }) => {
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  await expect(page.getByRole('button', { name: /^Начать ·/ })).toBeEnabled();
  await checkScreen(page, 'training-builder');
  await page.getByRole('button', { name: /Темы и сложность/ }).click();
  await expect(page.getByRole('heading', { name: 'Темы и сложность' })).toBeVisible();
  await checkScreen(page, 'training-topics');
  await page.getByRole('button', { name: /^Готово ·/ }).click();
  await page.getByRole('button', { name: /^Начать ·/ }).click();
  await expect(page.getByRole('heading', { name: /Text Completion/ })).toBeVisible();
  await page.getByRole('link', { name: 'Закрыть тренировку' }).click();
  await expect(page.getByRole('link', { name: /Продолжить тренировку/ })).toBeVisible();
  await checkScreen(page, 'home-training');
});

import { stableTrainingScreens, stableReviewScreens } from '../training';
test('вопросы, разбор, проверка со списком и итог', async ({ site: page }) => { await stableTrainingScreens(page); });
test('все ответы, отдельный разбор и жалоба', async ({ site: page }) => { await stableReviewScreens(page); });


test('главная T5 — загрузка', async ({ site: page }) => {
  const readyCard = await page.locator('article').boundingBox();
  const readySections = await page.getByRole('heading', { name: 'Разделы', exact: true }).boundingBox();
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/trainings/options?**', async (route) => { await held; await route.continue(); });
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Загружаем тренировку' })).toBeAttached();
  await checkScreen(page, 'home-loading');
  const loadingCard = await page.locator('article').boundingBox();
  const loadingSections = await page.getByRole('heading', { name: 'Разделы', exact: true }).boundingBox();
  expect(Math.abs(loadingCard!.height - readyCard!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(loadingSections!.y - readySections!.y)).toBeLessThanOrEqual(1);
  release();
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.', { exact: true })).toBeVisible();
});

test('ошибка главной и повтор', async ({ site: page }) => {
  test.info().annotations.push({ type: 'expects-5xx', description: 'сервер падает нарочно' });
  let fail = true;
  await page.route('**/api/trainings/options?**', (route) => fail ? route.fulfill({ status: 500, json: { code: 'internal', message: 'e2e', requestId: 'e2e' } }) : route.continue());
  await page.reload();
  await expect(page.getByText('Не получилось загрузить тренировку')).toBeVisible();
  await checkScreen(page, 'home-failed');
  fail = false;
  await page.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.', { exact: true })).toBeVisible();
});

import { homeNoNetworkScreen, homeStatsScreens, selectionScreens } from '../shellScreens';
test('T3, T3-busy, T7 и пустой TOEFL', async ({ site }) => selectionScreens(site, 'site'));
test('T1 и T2-offline на загруженных данных', async ({ site }) => homeStatsScreens(site));
test('T5-offline: загрузить нечего', async ({ site }) => homeNoNetworkScreen(site));

import { homeFirstOfflineScreen } from '../shellScreens';
test('T2-offline: отказ старта внутри первой карточки', async ({ site: page }) => { await homeFirstOfflineScreen(page); });
