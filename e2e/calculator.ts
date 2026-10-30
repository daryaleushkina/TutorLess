import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { schemas, type Question } from '../packages/api-client/src';
import { dictionaries } from '../apps/web/src/i18n/dict';
import { checkScreen, expect } from './fixtures';
import { startSession } from './training';

const raw: unknown = JSON.parse(readFileSync(new URL('../api/conformance/question-types.json', import.meta.url), 'utf8'));
if (!raw || typeof raw !== 'object' || !('answers' in raw) || !Array.isArray(raw.answers)) throw new Error('invalid question fixtures');
const examples = raw.answers.map((entry: unknown): Question => {
  if (!entry || typeof entry !== 'object' || !('question' in entry)) throw new Error('invalid question fixture');
  return schemas.Question.parse(entry.question);
});
const number = examples.find((q) => q.numericEntry?.format === 'number')!;
const fraction = examples.find((q) => q.numericEntry?.format === 'fraction')!;
const choice = examples.find((q) => q.section === 'quant' && q.questionType === 'multiple_choice_multi')!;

export async function startCalculator(page: Page, mode: 'practice' | 'check' = 'practice') {
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch(); const session = schemas.TrainingSession.parse(await response.json());
    await route.fulfill({ response, json: { ...session, items: [number, number, fraction, choice].map((question, position) => ({ position, question })) } });
  });
  // Подмена содержания сессии не меняет серверный набор; проверяем интерфейс, синхронизация покрыта training-types.
  await page.route('**/api/trainings/*/answers', (route) => route.fulfill({ status: 204 }));
  await startSession(page, mode, 50, 'Quant', 'numeric_entry');
  await page.getByRole('button', { name: 'Калькулятор', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Калькулятор', exact: true })).toBeVisible();
}
export async function calculatorKeys(page: Page, keys: string[]) {
  const labels = dictionaries.ru.training.calculator_keys;
  const dialog = page.getByRole('dialog', { name: 'Калькулятор', exact: true });
  for (const key of keys) await dialog.getByRole('button', { name: key in labels ? labels[key as keyof typeof labels] : key, exact: true }).click();
}
export async function calculatorFlow(page: Page, mode: 'practice' | 'check') {
  await startCalculator(page, mode);
  const trigger = page.getByRole('button', { name: 'Калькулятор', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Калькулятор', exact: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog).not.toHaveAttribute('aria-modal', 'true');
  await expect(page.getByRole('button', { name: 'Перенести в ответ', exact: true })).toBeDisabled();
  await calculatorKeys(page, ['(', '2', '+', '5', ')', '÷', '2', '=', 'M+', 'C', 'MR']);
  await expect(page.getByTestId('calculator-display')).toHaveText('3,5');
  let position: { x: number; y: number } | undefined;
  if (page.viewportSize()!.width >= 900 && !new URL(page.url()).pathname.startsWith('/tg')) {
    const box = (await dialog.boundingBox())!;
    await page.mouse.move(box.x + 50, box.y + 22); await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + 70, { steps: 5 }); await page.mouse.up();
    const moved = (await dialog.boundingBox())!;
    expect(moved.x).not.toBe(box.x); position = { x: moved.x, y: moved.y };
  }
  if (new URL(page.url()).pathname.startsWith('/tg/')) await page.locator('#tg-mock-back').click();
  else await dialog.getByRole('button', { name: 'Закрыть калькулятор' }).click();
  await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click(); await expect(page.getByTestId('calculator-display')).toHaveText('3,5');
  await page.getByRole('button', { name: 'Перенести в ответ', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Ответ', exact: true });
  await expect(input).toHaveValue('3,5'); await expect(input).toBeFocused();
  if (mode === 'practice') {
    await page.getByRole('button', { name: 'Проверить', exact: true }).click();
    await expect(trigger).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await trigger.click(); await expect(page.getByTestId('calculator-display')).toHaveText('3,5');
  if (position) {
    const box = (await dialog.boundingBox())!; expect(box.x).toBeCloseTo(position.x, 0); expect(box.y).toBeCloseTo(position.y, 0);
  }
  await calculatorKeys(page, ['C', 'MR']); await expect(page.getByTestId('calculator-display')).toHaveText('3,5');
  await page.getByRole('button', { name: 'Перенести в ответ', exact: true }).click();
  if (mode === 'practice') await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await trigger.click(); await expect(page.getByRole('button', { name: 'Перенести в ответ', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Закрыть калькулятор' }).click();
  if (mode === 'practice') await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await page.getByRole('button', { name: mode === 'check' ? 'Пропустить' : 'Дальше', exact: true }).click();
  await trigger.click(); await expect(page.getByRole('button', { name: 'Перенести в ответ', exact: true })).toHaveCount(0);
}
export async function calculatorKeyboard(page: Page) {
  await startCalculator(page, 'check');
  const dialog = page.getByRole('dialog', { name: 'Калькулятор', exact: true });
  await dialog.focus();
  await page.keyboard.type('(0.1+0,2)*10'); await page.keyboard.press('Enter');
  await expect(page.getByTestId('calculator-display')).toHaveText('3');
  await page.keyboard.press('a'); await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Вопрос 1 из 4', { exact: true })).toBeVisible();
  await page.keyboard.press('Delete'); await page.keyboard.type('12+34'); await page.keyboard.press('Backspace');
  await page.keyboard.type('5'); await page.keyboard.press('Enter'); await expect(page.getByTestId('calculator-display')).toHaveText('17');
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Калькулятор', exact: true })).toBeFocused();
  const input = page.getByRole('textbox', { name: 'Ответ', exact: true });
  await input.focus(); await page.keyboard.type('12,5'); await expect(input).toHaveValue('12,5');
  await page.getByRole('button', { name: 'Калькулятор', exact: true }).click();
  await input.focus(); await page.keyboard.type('6'); await expect(input).toHaveValue('12,56');
  await expect(page.getByTestId('calculator-display')).toHaveText('17');
}
export async function calculatorScreens(page: Page) {
  await startCalculator(page);
  await calculatorKeys(page, ['1', '8', '×', '1', '.', '2', '5', '=']);
  await checkScreen(page, page.viewportSize()!.width >= 900 && !new URL(page.url()).pathname.startsWith('/tg/') ? 'calculator-window' : 'calculator-sheet');
  await calculatorKeys(page, ['C', '1', '÷', '0', '=']);
  await checkScreen(page, 'calculator-error');
  await calculatorKeys(page, ['2', '2', '.', '5']);
  await page.evaluate(() => { document.documentElement.dataset.textSize = 'large'; });
  await checkScreen(page, 'calculator-large');
}
