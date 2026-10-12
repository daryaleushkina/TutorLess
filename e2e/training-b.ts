import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import { startSession, pick, trainingBack } from './training';
import { checkScreen } from './fixtures';

export async function practiceBackB(page: Page) {
  await startSession(page);
  await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await expect(page.getByText('Разберём', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  const chosen = page.getByRole('radio').first();
  await chosen.click();
  await expect(chosen).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Предыдущий вопрос' }).click();
  await expect(page.getByText(/ответ уже засчитан/)).toBeVisible();
  await expect(page.getByTestId('explanation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Показать разбор' }).click();
  await expect(page.getByTestId('explanation')).toBeVisible();
  await page.getByRole('button', { name: 'К вопросу 2' }).click();
  await expect(chosen).toHaveAttribute('aria-checked', 'true');
}

export async function equivalenceB(page: Page) {
  await startSession(page, 'practice', 5, 'Verbal', 'sentence_equivalence');
  const choices = page.getByRole('checkbox');
  const check = page.getByRole('button', { name: 'Проверить', exact: true });
  await expect(check).toBeDisabled();
  await choices.nth(0).click();
  await expect(check).toBeDisabled();
  await choices.nth(1).click();
  await expect(check).toBeEnabled();
  await choices.nth(2).click();
  await expect(choices.nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect(choices.nth(2)).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('kbd')).toHaveCount(0);
}

export async function quantBuilderB(page: Page) {
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  await page.getByRole('button', { name: 'Quant', exact: true }).click();
  await page.getByRole('group', { name: 'Вопросов', exact: true }).getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: 'Проверка', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Вопросов', exact: true })).toHaveCount(0);
  await expect(page.getByText('На время, как на экзамене: 21 мин на 12 вопросов, разбор — в конце.', { exact: true })).toBeVisible();
  const answer = page.waitForResponse((response) => response.url().endsWith('/api/trainings') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /^Начать ·/ }).click();
  expect((await answer).request().postDataJSON()).toMatchObject({ section: 'quant', count: 12, mode: 'check' });
  await expect(page.getByRole('timer')).toBeVisible();
}

export async function invalidReviewBackB(page: Page) {
  const session = await startSession(page, 'practice', 3);
  for (const item of session.items) {
    await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
    await page.getByRole('button', { name: item.position === session.items.length - 1 ? 'К итогу' : 'Дальше', exact: true }).click();
  }
  await page.getByRole('link', { name: 'Все ответы и разборы', exact: true }).click();
  const href = await page.getByRole('link', { name: /^Вопрос 1,/ }).getAttribute('href');
  if (!href) throw new Error('fixture review link missing');
  const url = new URL(href, page.url());
  url.pathname = url.pathname.replace(/\/\d+$/, '/invalid');
  await page.goto(url.toString());
  await expect(page.getByRole('heading', { name: 'Тренировки нет на устройстве', exact: true })).toBeVisible();
  await checkScreen(page, 'training-b-invalid-review');
  await trainingBack(page);
  await expect(page.getByRole('heading', { name: 'Разбор тренировки', exact: true })).toBeVisible();
}

export const EXISTING_ANSWERS_B = [['text_completion', 'Verbal'], ['sentence_equivalence', 'Verbal'], ['quantitative_comparison', 'Quant'], ['multiple_choice', 'Quant']] as const;

export async function existingAnswersB(page: Page, [type, section]: typeof EXISTING_ANSWERS_B[number]) {
  const session = await startSession(page, 'practice', 50, section, type);
  for (const item of session.items) {
    const check = page.getByRole('button', { name: 'Проверить', exact: true });
    await expect(check).toBeDisabled();
    await pick(page, item.question);
    await expect(check).toBeEnabled();
    await check.click();
    await expect(page.getByText('Верно.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: item.position === session.items.length - 1 ? 'К итогу' : 'Дальше', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: `${session.items.length} из ${session.items.length} верно`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
}

export async function checkStatesB(page: Page) {
  await page.clock.install();
  const session = await startSession(page, 'check');
  await pick(page, session.items[0]!.question);
  await page.getByRole('button', { name: 'Отметить, чтобы вернуться' }).click();
  await page.clock.fastForward((session.timeLimitSeconds! - 60) * 1000);
  await expect(page.getByRole('timer')).toHaveAttribute('data-low', 'true');
  await page.getByRole('button', { name: 'Вопросы', exact: true }).click();
  const list = page.getByRole('dialog', { name: 'Вопросы', exact: true });
  await expect(list.getByRole('button', { name: 'Вопрос 1, отвечен, отмечен', exact: true })).toBeVisible();
  await list.getByRole('button', { name: 'Завершить проверку', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Без ответа: 2. Завершить?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.clock.fastForward(60001);
  await expect(page.getByRole('heading', { name: 'Время вышло', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'К итогу', exact: true }).click();
  await page.getByRole('link', { name: 'Все ответы и разборы', exact: true }).click();
  await page.getByRole('button', { name: 'Отмеченные · 1', exact: true }).click();
  await expect(page.getByRole('link', { name: /^Вопрос / })).toHaveCount(1);
  await page.getByRole('link', { name: /^Вопрос 1,/ }).click();
  await expect(page.getByRole('button', { name: 'Следующий вопрос' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'К итогу', exact: true })).toBeVisible();
}
