// Каждый экран мини-аппа: вёрстка (ничего не наезжает на капсулу, не шире экрана, последнее видно, листается) и
// эталонный снимок. Новый экран или состояние — новая строка здесь (AGENTS.md, «Тесты»).
import { checkScreen, expect, miniAppUrl, navLink, signInitData, test } from '../fixtures';

test('«Тренировка»', async ({ miniApp: page }) => {
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.', { exact: true })).toBeVisible();
  await checkScreen(page, 'home');
});

test('пустые вкладки и настройки', async ({ miniApp: page }) => {
  await navLink(page, 'Экзамен').click();
  await expect(page.getByText('Здесь будут пробные экзамены GRE и эссе с оценкой.')).toBeVisible();
  await checkScreen(page, 'exam');
  await navLink(page, 'Прогресс').click();
  await expect(page.getByText('Здесь будет точность по разделам, история тренировок и примерный балл.')).toBeVisible();
  await checkScreen(page, 'progress');
  await page.getByRole('link', { name: 'Профиль', exact: true }).click();
  await expect(page.getByText('Версия e2e')).toBeVisible();
  await checkScreen(page, 'settings');
  await page.getByRole('button', { name: 'Крупнее', exact: true }).click();
  await checkScreen(page, 'profile-large');
  await page.getByRole('button', { name: 'Обычный', exact: true }).click();
  await page.locator('#tg-mock-back').click();

});

test('раздел не догрузился — «Нет сети» с повтором и доступными вкладками', async ({ page, watch, tgUser, tgTheme, tgPlatform, tgInsets, me }) => {
  watch(page);
  await me.api('PUT', '/me/exam', { exam: 'gre' });
  await page.route(/\/sections\.lazy-[^/]+\.js(?:\?.*)?$/, (route) => route.abort('internetdisconnected'));
  await page.goto(miniAppUrl(tgUser, { tgTheme, tgPlatform, tgInsets }));
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.', { exact: true })).toBeVisible();
  await navLink(page, 'Прогресс').click();
  await expect(page.getByRole('heading', { name: 'Нет сети', exact: true })).toBeVisible();
  await checkScreen(page, 'section-offline');
});

test('загрузка — скелет T5', async ({ page, watch, tgUser, tgTheme, tgPlatform, tgInsets, me }) => {
  watch(page);
  await me.api('PUT', '/me/exam', { exam: 'gre' });
  // Запрос вариантов держим, пока снимаем скелет; потом отпускаем — дальше обычный экран.
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/api/trainings/options?**', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(miniAppUrl(tgUser, { tgTheme, tgPlatform, tgInsets }));
  await expect(page.getByRole('status').filter({ hasText: 'Загружаем тренировку' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Экзамен: GRE, сменить' })).toBeVisible();
  await checkScreen(page, 'home-loading');
  release();
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.', { exact: true })).toBeVisible();
});

test('не получилось загрузить тренировку — «Повторить»', async ({ page, watch, tgUser, tgTheme, tgPlatform, tgInsets, me }) => {
  test.info().annotations.push({ type: 'expects-5xx', description: 'сервер «падает» нарочно' });
  watch(page);
  await me.api('PUT', '/me/exam', { exam: 'gre' });
  let fail = true;
  await page.route('**/api/trainings/options?**', (route) =>
    fail ? route.fulfill({ status: 500, json: { code: 'internal', message: 'e2e', requestId: 'e2e' } }) : route.continue(),
  );
  await page.goto(miniAppUrl(tgUser, { tgTheme, tgPlatform, tgInsets }));
  await expect(page.getByText('Не получилось загрузить тренировку')).toBeVisible();
  await checkScreen(page, 'home-failed');
  fail = false;
  await page.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.', { exact: true })).toBeVisible();
});

test('Telegram сообщил высоту больше видимой — капсула вкладок всё равно на экране', async ({ page, watch, tgUser, tgTheme, tgPlatform, tgInsets, me }) => {
  watch(page);
  await me.api('PUT', '/me/exam', { exam: 'gre' });
  // Так бывает на iPhone (docs/HANDOFF.md, «Telegram»): stableHeight на 120 px больше видимой части.
  await page.goto(`${miniAppUrl(tgUser, { tgTheme, tgPlatform, tgInsets })}&tgViewportExtra=120`);
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.', { exact: true })).toBeVisible();
  await checkScreen(page, 'home-tall-viewport');
});

test('вход не прошёл (initData подделана) — «Не получилось войти» во весь экран', async ({ page, watch, tgUser, tgTheme, tgPlatform, tgInsets, me }) => {
  watch(page);
  await me.api('PUT', '/me/exam', { exam: 'gre' });
  const forged = new URLSearchParams(signInitData(tgUser));
  forged.set('user', JSON.stringify({ ...tgUser, id: tgUser.id + 1 }));
  const url = new URL(miniAppUrl(tgUser, { tgTheme, tgPlatform, tgInsets }), 'https://x');
  url.searchParams.set('tgInitData', forged.toString());
  await page.goto(url.pathname + url.search);
  await expect(page.getByRole('heading', { name: 'Не получилось войти' })).toBeVisible();
  await checkScreen(page, 'signin-failed');
});

test('конструктор и темы тренировки', async ({ miniApp: page }) => {
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  await expect(page.getByRole('button', { name: /^(Начать ·|Начинаем…)/ })).toBeEnabled();
  await checkScreen(page, 'training-b-builder');
  await page.getByRole('button', { name: /^Тип/ }).click();
  await checkScreen(page, 'training-b-types');
  await page.getByRole('radio', { name: 'Text Completion', exact: true }).click();
  await page.getByRole('button', { name: /Темы и сложность/ }).click();
  await expect(page.getByRole('heading', { name: 'Темы и сложность' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Готово · 3 темы из 3', exact: true })).toBeVisible();
  await checkScreen(page, 'training-b-topics');
  await page.getByRole('button', { name: /^Готово ·/ }).click();
  await page.getByRole('button', { name: /^(Начать ·|Начинаем…)/ }).click();
  await expect(page.getByRole('heading', { name: /Text Completion/ })).toBeVisible();
  await page.locator('#tg-mock-back').click();
  await expect(page.getByRole('link', { name: /Продолжить тренировку/ })).toBeVisible();
  await checkScreen(page, 'home-training');
});

import { stableTrainingScreens, stableReviewScreens, stableCheckReviewScreens } from '../training';
test('вопросы, разбор, проверка со списком и итог', async ({ miniApp: page }) => { await stableTrainingScreens(page); });
test('все ответы, отдельный разбор и жалоба', async ({ miniApp: page }) => { await stableReviewScreens(page); });

import { homeNoNetworkScreen, homeStatsScreens, selectionScreens } from '../shellScreens';
test('T3, T3-busy, T7 и пустой TOEFL', async ({ miniApp }) => selectionScreens(miniApp, 'telegram'));
test('T1 и T2-offline на загруженных данных', async ({ miniApp }) => homeStatsScreens(miniApp));
test('T5-offline: загрузить нечего', async ({ miniApp }) => homeNoNetworkScreen(miniApp));

import { homeFirstOfflineScreen } from '../shellScreens';
test('T2-offline: отказ старта внутри первой карточки', async ({ miniApp: page }) => { await homeFirstOfflineScreen(page); });

test('проверка: все ответы, отмеченные и разбор Quant по фильтру', async ({ miniApp: page }) => { await stableCheckReviewScreens(page); });

import { newTypesScreens } from '../training-types';
test('B новые: RC, предложения, несколько ответов, число и дробь', async ({ miniApp }) => { await newTypesScreens(miniApp); });

import { wordsScreens } from '../words';
test('словарь: список, пустой поиск и карточка', async ({ miniApp }) => wordsScreens(miniApp));
