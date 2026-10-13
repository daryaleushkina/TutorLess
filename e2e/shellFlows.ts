import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import { schemas } from '../packages/api-client/src';

export async function profileSettings(page: Page, shell: 'site' | 'telegram') {
  await page.getByRole('link', { name: /Профиль/ }).click();
  for (const name of ['Подписка', 'Способы входа', 'Написать нам']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  const light = await page.getByRole('button', { name: 'Светлая', exact: true }).boundingBox();
  expect(light?.height ?? 0).toBeGreaterThanOrEqual(32);
  const theme = await page.locator('html').getAttribute('data-theme');
  const next = theme === 'light' ? 'dark' : 'light';
  await page.getByRole('button', { name: next === 'light' ? 'Светлая' : 'Тёмная', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', next);
  await expect(page.getByRole('button', { name: next === 'light' ? 'Светлая' : 'Тёмная', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', next);
  await page.getByRole('button', { name: 'Крупнее', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
  const saving = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith('/api/me/locale'));
  await page.getByRole('button', { name: 'English', exact: true }).click();
  expect((await saving).status()).toBe(200);
  await expect(page.getByRole('group', { name: 'Language' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const saved = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith('/api/me/locale'));
  await page.getByRole('button', { name: 'Русский', exact: true }).click();
  await saved;
  await page.route('**/api/me/locale', (route) => route.fulfill({ status: 400, json: { code: 'bad_request', message: 'synthetic', requestId: 'locale-failure' } }));
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Русский', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('alert')).toContainText('Не получилось сохранить язык.');
  if (shell === 'site') {
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Вход с Apple' })).toBeVisible();
  } else await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toHaveCount(0);
}

export async function switchExam(page: Page) {
  await page.getByRole('button', { name: 'Экзамен: GRE, сменить' }).click();
  const popup = page.getByRole('dialog', { name: 'Экзамен', exact: true });
  await expect(popup).toBeVisible();
  const saved = page.waitForRequest((request) => request.method() === 'PUT' && request.url().endsWith('/api/me/exam'));
  const toefl = popup.getByRole('button', { name: /TOEFL/ });
  await toefl.focus();
  await toefl.press('Enter');
  expect((await saved).postDataJSON()).toEqual({ exam: 'toefl' });
  await expect(popup).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Экзамен: TOEFL, сменить' })).toBeVisible();
  await expect(page.getByText('Здесь будут тренировки по четырём частям TOEFL.')).toBeVisible();
  for (const name of ['Reading', 'Listening', 'Writing', 'Speaking']) {
    await expect(page.getByRole('link', { name: new RegExp(`^${name}`) })).toHaveCount(0);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Начать', exact: true })).toHaveCount(0);
}

export async function pickInitialExam(page: Page) {
  const chooser = page.getByRole('heading', { name: /К какому экзамену|Which exam are you preparing/ });
  await expect(chooser).toBeVisible();
  await page.getByRole('button', { name: /^GRE/ }).click();
}

export async function firstSelection(page: Page, shell: 'site' | 'telegram') {
  await page.route(shell === 'site' ? '**/api/me' : '**/api/auth/telegram-mini-app', async (route) => {
    const response = await route.fetch();
    const json: unknown = await response.json();
    const body = shell === 'site' ? { ...schemas.User.parse(json), activeExam: null } : { ...schemas.Session.parse(json), user: { ...schemas.Session.parse(json).user, activeExam: null } };
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'К какому экзамену готовитесь?' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Разделы' })).toHaveCount(0);
  const request = page.waitForRequest((request) => request.method() === 'PUT' && request.url().endsWith('/api/me/exam'));
  await page.getByRole('button', { name: /^TOEFL/ }).click();
  expect((await request).postDataJSON()).toEqual({ exam: 'toefl' });
  await expect(page.getByText('Здесь будут тренировки по четырём частям TOEFL.')).toBeVisible();
}


export async function repeatRealMistake(page: Page) {
  const { startSession, pick } = await import('./training');
  const session = await startSession(page, 'practice', 1);
  await pick(page, session.items[0]!.question, true);
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await page.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect(page.getByRole('heading', { name: '0 из 1 верно', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  const repeat = page.getByRole('button', { name: /Повторить мои ошибки/ });
  await expect(repeat).toBeVisible();
  const posted = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/api/trainings');
  await repeat.click();
  expect(schemas.TrainingRequest.parse((await posted).postDataJSON())).toMatchObject({ exam: 'gre', source: 'mistakes', count: 1 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Text Completion/);
}
