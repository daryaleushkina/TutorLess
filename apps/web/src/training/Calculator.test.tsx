import { beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Question } from '@greprep/api-client';
import { fakeServer, json, renderApp, user } from '../test/app';
import { questionFixture, trainingOptions, trainingSession } from '../test/training';
import { storedTraining } from './model';
import { trainingRepository } from './repository';
import { clearSessionCalculator, sessionCalculator } from './calculator/store';

beforeEach(() => clearSessionCalculator(trainingSession().id));
const number = (): Question => ({ ...questionFixture('numeric_entry'), groups: [], answer: [], selectCount: 0, numericEntry: { format: 'number' }, numericAnswer: { number: '0.3' } });
async function boot(questions: Question[] = [number(), number()], check = false, locale: 'ru' | 'en' = 'ru') {
  fakeServer({ 'GET /api/me': () => json(user({ locale })), 'GET /api/trainings/options': () => json(trainingOptions()) });
  vi.spyOn(trainingRepository, 'requestSync').mockImplementation(() => {});
  const app = await renderApp({ path: '/' });
  await expect.element(app.screen.getByRole('heading', { level: 1 })).toBeVisible();
  const owner = await trainingRepository.store.currentOwner();
  if (!owner) throw new Error('fixture owner missing');
  const training = storedTraining(trainingSession({ section: questions[0]!.section, mode: check ? 'check' : 'practice', timeLimitSeconds: check ? 300 : undefined,
    questionTypes: [...new Set(questions.map((q) => q.questionType))], items: questions.map((question, position) => ({ position, question })) }), Date.now());
  await trainingRepository.store.put(owner, training);
  await app.router.navigate({ to: '/training/$trainingId', params: { trainingId: training.session.id } });
  return app;
}

test('Quant: калькулятор немодальный, переносит число и возвращает фокус', async () => {
  const question = number();
  const session = trainingSession({ section: 'quant', questionTypes: ['numeric_entry'], items: [{ position: 0, question }] });
  fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(session) });
  const { screen } = await renderApp({ path: '/training/new' });
  await screen.getByRole('button', { name: /Начать ·/ }).click();
  await screen.getByRole('button', { name: 'Калькулятор', exact: true }).click();
  const dialog = screen.getByRole('dialog', { name: 'Калькулятор', exact: true });
  await expect.element(dialog).toBeVisible();
  expect(dialog.element().getAttribute('aria-modal')).not.toBe('true');
  await expect.element(screen.getByRole('button', { name: 'Перенести в ответ', exact: true })).toBeDisabled();
  for (const name of ['0', 'Десятичный разделитель', '1', 'Плюс', '0', 'Десятичный разделитель', '2', 'Равно']) await dialog.getByRole('button', { name, exact: true }).click();
  await expect.element(screen.getByTestId('calculator-display')).toHaveTextContent('0,3');
  await screen.getByRole('button', { name: 'Перенести в ответ', exact: true }).click();
  await expect.element(screen.getByRole('textbox', { name: 'Ответ', exact: true })).toHaveValue('0,3');
  await expect.element(screen.getByRole('textbox', { name: 'Ответ', exact: true })).toHaveFocus();
  await expect.element(dialog).not.toBeInTheDocument();
});

test('ошибка, пустой дисплей, live только для результата; состояние между вопросами и после возврата', async () => {
  const { screen, router } = await boot();
  const trigger = screen.getByRole('button', { name: 'Калькулятор', exact: true });
  await trigger.click();
  const dialog = screen.getByRole('dialog', { name: 'Калькулятор', exact: true });
  for (const name of ['1', 'Разделить', '0', 'Равно']) await dialog.getByRole('button', { name, exact: true }).click();
  await expect.element(screen.getByTestId('calculator-display')).toHaveTextContent('На ноль делить нельзя');
  await expect.element(screen.getByRole('button', { name: 'Перенести в ответ', exact: true })).toBeDisabled();
  await expect.element(screen.getByText('Исправьте ошибку перед переносом')).toBeVisible();
  await dialog.getByRole('button', { name: '2', exact: true }).click();
  expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain('На\u00a0ноль');
  await dialog.getByRole('button', { name: 'Память: прибавить', exact: true }).click();
  await dialog.getByRole('button', { name: 'Закрыть калькулятор' }).click();
  await expect.element(trigger).toHaveFocus();
  await screen.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await expect.element(trigger).not.toBeInTheDocument();
  await screen.getByRole('button', { name: 'Дальше', exact: true }).click();
  await trigger.click();
  await expect.element(screen.getByTestId('calculator-display')).toHaveTextContent('2');
  await dialog.getByRole('button', { name: 'Очистить всё' }).click();
  await dialog.getByRole('button', { name: 'Память: вызвать' }).click();
  await expect.element(screen.getByTestId('calculator-display')).toHaveTextContent('2');
  await dialog.getByRole('button', { name: 'Закрыть калькулятор' }).click();
  await screen.getByRole('button', { name: 'Закрыть тренировку' }).click();
  await screen.getByRole('link', { name: /Продолжить тренировку/ }).click();
  await trigger.click(); await expect.element(screen.getByTestId('calculator-display')).toHaveTextContent('2');
  await screen.getByRole('button', { name: 'Перенести в ответ', exact: true }).click();
  await screen.getByRole('textbox', { name: 'Ответ', exact: true }).fill('3');
  await trigger.click(); await screen.getByRole('button', { name: 'Перенести в ответ', exact: true }).click();
  await expect.element(screen.getByRole('textbox', { name: 'Ответ', exact: true })).toHaveValue('2');
  await screen.getByRole('button', { name: 'Проверить', exact: true }).click();
  await screen.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => sessionCalculator(trainingSession().id).calculator.display).toBe('');
  expect(router.state.location.pathname).toContain('/training/');
});

test('английский: клавиатура только внутри диалога, Enter считает, Esc возвращает фокус', async () => {
  const { screen } = await boot([number()], true, 'en');
  await screen.getByRole('button', { name: 'Calculator', exact: true }).click();
  await userEvent.keyboard('(0.1+0,2)*10{Enter}');
  await expect.element(screen.getByTestId('calculator-display')).toHaveTextContent('3');
  await userEvent.keyboard('{Control>}1{/Control}a{ArrowRight}');
  await expect.element(screen.getByTestId('calculator-display')).toHaveTextContent('3');
  await userEvent.keyboard('{Delete}12+34{Backspace}5{Enter}');
  await expect.element(screen.getByTestId('calculator-display')).toHaveTextContent('17');
  await userEvent.keyboard('{Escape}');
  await expect.element(screen.getByRole('button', { name: 'Calculator', exact: true })).toHaveFocus();
  await screen.getByRole('button', { name: 'Calculator', exact: true }).click();
  const input = screen.getByRole('textbox', { name: 'Answer', exact: true });
  await input.click(); await userEvent.keyboard('0.3');
  await expect.element(input).toHaveValue('0.3');
  await expect.element(screen.getByTestId('calculator-display')).toHaveTextContent('17');
  await screen.getByRole('button', { name: 'Transfer to answer', exact: true }).click();
  await expect.element(input).toHaveValue('17');
});

for (const question of [questionFixture('quantitative_comparison'), { ...number(), numericEntry: { format: 'fraction' as const }, numericAnswer: { numerator: '3', denominator: '5' } }]) test(`нет переноса: ${question.questionType} ${question.numericEntry?.format ?? ''}`, async () => {
  const { screen } = await boot([question], true);
  await screen.getByRole('button', { name: 'Калькулятор', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Перенести в ответ', exact: true })).not.toBeInTheDocument();
  await screen.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await expect.element(screen.getByRole('dialog', { name: 'Вопросы', exact: true })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Калькулятор', exact: true })).not.toBeInTheDocument();
});

test('широкое окно: перетаскивание, границы, альтернатива жесту и переход к шторке', async () => {
  await page.viewport(1280, 800);
  try {
    const { screen } = await boot([number()], true);
    await screen.getByRole('button', { name: 'Калькулятор', exact: true }).click();
    const dialog = document.querySelector<HTMLDialogElement>('[data-calculator]')!;
    const heading = dialog.firstElementChild!;
    await expect.poll(() => dialog.dataset.mode).toBe('window');
    const rect = dialog.getBoundingClientRect();
    const pointer = (type: string, x: number, y: number, id = 1) => heading.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, isPrimary: true, clientX: x, clientY: y }));
    // Синтетический pointer не зарегистрирован браузером; захват проверяется настоящей мышью в e2e.
    vi.spyOn(heading, 'setPointerCapture').mockImplementation(() => {});
    vi.spyOn(heading, 'releasePointerCapture').mockImplementation(() => {});
    pointer('pointerdown', rect.x + 10, rect.y + 10);
    pointer('pointerdown', rect.x, rect.y, 2);
    pointer('pointermove', rect.x, rect.y, 2);
    pointer('pointermove', -100, -100); pointer('pointerup', -100, -100, 2); pointer('pointerup', -100, -100);
    await expect.poll(() => dialog.getBoundingClientRect().left).toBeGreaterThanOrEqual(16);
    const field = screen.getByRole('textbox', { name: 'Ответ', exact: true }).element().getBoundingClientRect();
    expect(dialog.getBoundingClientRect().left).toBeGreaterThanOrEqual(field.right);
    pointer('pointerdown', 20, 20); pointer('pointermove', 3000, 3000); pointer('lostpointercapture', 0, 0);
    expect(dialog.getBoundingClientRect().right).toBeLessThanOrEqual(1280);
    await screen.getByRole('button', { name: 'Переместить окно' }).click();
    await screen.getByRole('button', { name: 'Вернуть окно справа' }).click();
    await expect.poll(() => dialog.getBoundingClientRect().left).toBeGreaterThan(500);
    await page.viewport(760, 400);
    await expect.poll(() => dialog.dataset.mode).toBe('sheet');
    expect(dialog.style.left).toBe('');
    await page.viewport(1280, 800);
    await expect.poll(() => dialog.dataset.mode).toBe('window');
    await screen.getByRole('button', { name: 'Закрыть калькулятор' }).click();
    await expect.element(screen.getByRole('button', { name: 'Калькулятор', exact: true })).toHaveFocus();
  } finally { await page.viewport(390, 844); }
});
