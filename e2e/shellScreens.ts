import type { Page } from '@playwright/test';
import { schemas } from '../packages/api-client/src';
import { checkScreen, expect, navLink } from './fixtures';

export async function selectionScreens(page: Page, shell: 'site' | 'telegram') {
  await page.getByRole('button', { name: 'Экзамен: GRE, сменить' }).click();
  await checkScreen(page, 'exam-switch');
  await page.keyboard.press('Escape');
  await page.route(shell === 'site' ? '**/api/me' : '**/api/auth/telegram-mini-app', async (route) => {
    const response = await route.fetch();
    const value: unknown = await response.json();
    const body = shell === 'site' ? { ...schemas.User.parse(value), activeExam: null } : { ...schemas.Session.parse(value), user: { ...schemas.Session.parse(value).user, activeExam: null } };
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'К какому экзамену готовитесь?' })).toBeVisible();
  await checkScreen(page, 'exam-selection');
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/me/exam', async (route) => { await held; const response = await route.fetch(); const account = schemas.User.parse(await response.json()); await route.fulfill({ response, json: shell === 'site' ? { ...account, name: 'Тест' } : account }); });
  await page.getByRole('button', { name: /^TOEFL/ }).click();
  await expect(page.getByRole('button', { name: /^TOEFL/ })).toHaveAttribute('aria-busy', 'true');
  await checkScreen(page, 'exam-selection-busy');
  release();
  await expect(page.getByText('Здесь будут тренировки по четырём частям TOEFL.')).toBeVisible();
  await checkScreen(page, 'home-toefl');
  await navLink(page, 'Экзамен').click();
  await expect(page.getByText('Здесь будут пробные экзамены TOEFL с оценкой Writing и Speaking.')).toBeVisible();
  await checkScreen(page, 'exam-toefl');
}

export async function homeStatsScreens(page: Page) {
  await page.route('**/api/home?**', (route) => route.fulfill({ json: { lastTraining: { request: { exam: 'gre', section: 'verbal', questionTypes: ['text_completion'], mode: 'practice', count: 10 }, size: 10 }, sections: [{ section: 'verbal', total: 100, correct: 68 }, { section: 'quant', total: 100, correct: 74 }, { section: 'essay', total: 0, correct: 0 }], mistakes: 12, weakSpot: { section: 'verbal', questionType: 'text_completion', accuracy: 52 }, week: { days: 4, answers: 86, minutes: 130 } } }));
  await page.reload();
  await expect(page.getByText('68 %', { exact: true })).toBeVisible();
  await checkScreen(page, 'home-statistics');
  await page.context().setOffline(true);
  await expect(page.getByText('Нет сети — обновим, когда она появится.')).toBeVisible();
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await checkScreen(page, 'home-offline-cached');
  await page.context().setOffline(false);
}

export async function homeNoNetworkScreen(page: Page) {
  await page.route('**/api/home?**', (route) => route.abort('internetdisconnected'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Нет сети', exact: true })).toBeVisible();
  await checkScreen(page, 'home-offline');
}

export async function homeFirstOfflineScreen(page: Page) {
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect(page.locator('article').getByRole('alert')).toHaveText('Чтобы начать, нужна сеть: задания скачаются целиком, и дальше можно без неё.');
  await checkScreen(page, 'home-first-offline');
  await page.context().setOffline(false);
}
