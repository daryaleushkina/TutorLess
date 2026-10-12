import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { useState } from 'react';
import type { Question } from '@greprep/api-client';
import { fakeServer, json, OPTIONS, renderApp, user } from '../test/app';
import { givenAnswer, questionFixture, trainingSession } from '../test/training';
import { storedTraining, type StoredTraining } from './model';
import { trainingRepository } from './repository';
import { NumericInput } from './NumericAnswer';
import { answerFormat, draftAnswer } from './QuestionContent';
import { dictionaries } from '../i18n/dict';

const numeric = (fraction = false): Question => ({ ...questionFixture('numeric_entry'), groups: [], selectCount: 0, answer: [], prompt: 'Synthetic numeric fixture.',
  numericEntry: { format: fraction ? 'fraction' : 'number' }, numericAnswer: fraction ? { numerator: '3', denominator: '5' } : { number: '22.5' } });
const passage = { id: 'synthetic-passage', paragraphs: Array.from({ length: 5 }, (_, p) => ({ sentences: Array.from({ length: 3 }, (_, s) => ({
  id: `P${p}S${s}`, text: `Synthetic paragraph ${p + 1}, sentence ${s + 1}. A repeated sentence gives the reading panel enough content to scroll independently of the question.`,
})) })) };
const rc = (): Question => ({ ...questionFixture('multiple_choice'), section: 'verbal', passage, prompt: 'Synthetic reading question.' });
const sentence = (): Question => ({ ...rc(), questionType: 'select_in_passage', groups: [], selectCount: 0, answer: ['P0S1'] });
const multi = (): Question => ({ ...questionFixture('multiple_choice_multi'), selectCount: 0, answer: ['A', 'C'] });

function paste(field: Element, value: string) {
  if (!(field instanceof HTMLInputElement)) throw new Error('fixture input missing');
  const before = new InputEvent('beforeinput', { data: value, inputType: 'insertFromPaste', bubbles: true, cancelable: true });
  if (!field.dispatchEvent(before)) throw new Error('paste unexpectedly cancelled');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
  field.dispatchEvent(new InputEvent('input', { data: value, inputType: 'insertFromPaste', bubbles: true }));
}

async function boot(questions: Question[], over: Partial<StoredTraining> = {}, check = false) {
  fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/trainings/options': () => json(OPTIONS) });
  vi.spyOn(trainingRepository, 'requestSync').mockImplementation(() => {});
  const app = await renderApp({ path: '/' });
  await expect.element(app.screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
  const owner = await trainingRepository.store.currentOwner();
  if (!owner) throw new Error('fixture owner missing');
  const training = { ...storedTraining(trainingSession({ mode: check ? 'check' : 'practice', section: questions[0]!.section,
    questionTypes: [...new Set(questions.map((q) => q.questionType))], items: questions.map((question, position) => ({ position, question })) }), Date.now()), ...over };
  await trainingRepository.store.put(owner, training);
  await app.router.navigate({ to: '/training/$trainingId', params: { trainingId: training.session.id } });
  return { ...app, training };
}

test('число: вставка с ошибкой блокирует проверку, запятая нормализуется; Enter проверяет и итог учитывает число', async () => {
  const { screen, training } = await boot([numeric()]);
  const input = screen.getByRole('textbox', { name: 'Ответ', exact: true });
  await expect.element(input).toHaveAttribute('inputmode', 'decimal');
  paste(input.element(), '22,5,0');
  await expect.element(input).toHaveAttribute('aria-invalid', 'true');
  await expect.element(screen.getByRole('alert')).toMatchTextContent('Так число не записать');
  await expect.element(screen.getByRole('button', { name: 'Проверить', exact: true })).toBeDisabled();
  await input.fill('22,5');
  await userEvent.keyboard('{Enter}');
  await expect.element(screen.getByText('Верно.', { exact: true })).toBeVisible();
  await expect.poll(async () => (await trainingRepository.get(training.session.id))?.answers['0']?.numericAnswer).toEqual({ number: '22.5' });
  await screen.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect.element(screen.getByRole('heading', { name: '1 из 1 верно' })).toBeVisible();
  await screen.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await screen.getByRole('button', { name: 'Ошибки · 0' }).click();
  await expect.element(screen.getByText('Ошибок нет.')).toBeVisible();
  await screen.getByRole('button', { name: 'Все · 1' }).click();
  await screen.getByRole('link', { name: /^Вопрос 1,/ }).click();
  await expect.element(screen.getByText('Верно.', { exact: true })).toBeVisible();
  await screen.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await expect.element(screen.getByRole('dialog')).toBeVisible();
});

test('дробь: целые поля, нулевой знаменатель и неверная вставка; Enter переносит фокус, 9/15 засчитывается', async () => {
  const { screen } = await boot([numeric(true)]);
  const top = screen.getByRole('textbox', { name: 'Числитель' }), bottom = screen.getByRole('textbox', { name: 'Знаменатель' });
  await expect.element(top).toHaveAttribute('inputmode', 'numeric');
  paste(top.element(), '9x');
  await expect.element(screen.getByRole('alert')).toMatchTextContent('Введите целое число');
  await top.fill('9'); await userEvent.keyboard('{Enter}');
  await expect.element(bottom).toHaveFocus();
  await bottom.fill('0');
  await expect.element(screen.getByRole('alert')).toMatchTextContent('Знаменатель не может быть нулём');
  await expect.element(screen.getByRole('button', { name: 'Проверить', exact: true })).toBeDisabled();
  await bottom.fill('15'); await userEvent.keyboard('{Enter}');
  await expect.element(screen.getByText('Верно.', { exact: true })).toBeVisible();
});

test('несколько ответов: хотя бы один разрешает проверку, частичный неверен, верные пропущенные отмечены', async () => {
  const { screen } = await boot([multi()]);
  const check = screen.getByRole('button', { name: 'Проверить', exact: true });
  await expect.element(check).toBeDisabled();
  await screen.getByRole('checkbox', { name: 'A word 0', exact: true }).click();
  await expect.element(check).toBeEnabled();
  await screen.getByRole('checkbox', { name: 'B word 0', exact: true }).click();
  await screen.getByRole('checkbox', { name: 'B word 0', exact: true }).click();
  await check.click();
  await expect.element(screen.getByText('Неверно.', { exact: true })).toBeVisible();
  await expect.element(screen.getByRole('checkbox', { name: /C word 0/ })).toHaveAttribute('data-result', 'missed');
});

test('выбор предложения: одна кнопка сменяет другую, неверное и пропущенное верное видны в разборе', async () => {
  const { screen } = await boot([sentence()]);
  await expect.element(screen.getByRole('tablist')).not.toBeInTheDocument();
  const first = screen.getByRole('button', { name: /^Synthetic paragraph 1, sentence 1/ });
  const second = screen.getByRole('button', { name: /^Synthetic paragraph 1, sentence 2/ });
  await second.click(); await first.click();
  await expect.element(second).toHaveAttribute('aria-pressed', 'false');
  await screen.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect.element(screen.getByText('Неверно.', { exact: true })).toBeVisible();
  await expect.element(first).toHaveAttribute('data-result', 'wrong');
  await expect.element(second).toHaveAttribute('data-result', 'missed');
});

test('RC: первый вопрос открывает текст, второй — вопрос; вкладки и независимые прокрутки', async () => {
  const second = { ...rc(), id: '00000000-0000-4000-8000-000000000002' };
  const { screen } = await boot([rc(), second]);
  const text = screen.getByRole('tab', { name: 'Текст', exact: true }), question = screen.getByRole('tab', { name: 'Вопрос', exact: true });
  await expect.element(text).toHaveAttribute('aria-selected', 'true');
  const panel = screen.getByRole('tabpanel', { name: 'Текст', exact: true }).element();
  panel.scrollTop = 190;
  await question.click(); await text.click();
  await expect.poll(() => panel.scrollTop).toBe(190);
  await text.click(); await userEvent.keyboard('{ArrowRight}');
  await expect.element(question).toHaveFocus();
  await userEvent.keyboard('{Home}'); await expect.element(text).toHaveFocus();
  await userEvent.keyboard('{End}'); await expect.element(question).toHaveFocus();
  await userEvent.keyboard('{ArrowLeft}'); await expect.element(text).toHaveFocus();
  await question.click(); await screen.getByRole('radio', { name: 'A word 0', exact: true }).click();
  await screen.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect.element(screen.getByTestId('explanation')).toBeVisible();
  await screen.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect.element(question).toHaveAttribute('aria-selected', 'true');
  await page.viewport(1280, 800);
  try { await expect.element(screen.getByRole('tabpanel', { name: 'Текст', exact: true })).toBeVisible(); }
  finally { await page.viewport(390, 844); }
});

test('числа в проверке: неполная дробь не отвечена, полная — отвечена; итог и разбор не читают optionIds', async () => {
  const { screen, training } = await boot([numeric(true)], {}, true);
  await screen.getByRole('textbox', { name: 'Числитель' }).fill('9');
  await screen.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Вопрос 1, без ответа', exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Вопрос 1, без ответа', exact: true }).click();
  await screen.getByRole('textbox', { name: 'Знаменатель' }).fill('15');
  await screen.getByRole('button', { name: 'Отметить, чтобы вернуться' }).click();
  await screen.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Вопрос 1, отвечен, отмечен', exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Завершить проверку', exact: true }).click();
  await expect.element(screen.getByRole('heading', { name: '1 из 1 верно' })).toBeVisible();
  await expect.poll(async () => (await trainingRepository.get(training.session.id))?.answers['0']?.numericAnswer).toEqual({ numerator: '9', denominator: '15' });
});

test('неверный и неизвестный числовой ответ показывают верное значение, RC остаётся доступен в разборе', async () => {
  const questions = [numeric(), numeric(true), rc(), sentence()];
  const { screen } = await boot(questions, { answers: {
    0: givenAnswer({ optionIds: [], numericAnswer: { number: '21' } }),
    1: givenAnswer({ position: 1, optionIds: [], dontKnow: true }),
    2: givenAnswer({ position: 2 }), 3: givenAnswer({ position: 3, optionIds: [], sentenceId: 'P0S1' }),
  }, finish: { finishedAt: new Date().toISOString(), timedOut: false } });
  await screen.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await screen.getByRole('link', { name: /^Вопрос 1,/ }).click();
  await expect.element(screen.getByText('22.5', { exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
  await expect.element(screen.getByText('3 / 5', { exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
  await screen.getByRole('tab', { name: 'Текст', exact: true }).click();
  await expect.element(screen.getByText('Абзац 1', { exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
  await expect.element(screen.getByText('Верно.', { exact: true })).toBeVisible();
});

test('управляемое поле принимает значение снаружи и сохраняет нативное редактирование', async () => {
  function Input({ external }: { external?: string }) { const [value, setValue] = useState(''); return <NumericInput label="Fixture" value={value} onChange={setValue} externalValue={external} />; }
  const app = await render(<Input />);
  const input = page.getByRole('textbox', { name: 'Fixture' });
  await input.fill('1');
  const field = input.element();
  field.dispatchEvent(new InputEvent('beforeinput', { data: 'x', inputType: 'insertText', bubbles: true, cancelable: true }));
  await userEvent.keyboard('{Enter}');
  await app.rerender(<Input external="22.5" />);
  await expect.element(input).toHaveValue('22.5');
  await userEvent.keyboard('x');
  await expect.element(input).toHaveValue('22.5');
});

test('поле принимает необязательные единицы до и после числа, связывает их с полем и убирает при отсутствии', async () => {
  const changed = vi.fn();
  const app = await render(<NumericInput label="Fixture units" value="22.5" onChange={changed} unitBefore="$" unitAfter="USD" describedBy="fixture-error" />);
  const input = page.getByRole('textbox', { name: 'Fixture units', exact: true });
  await expect.element(page.getByText('$', { exact: true })).toBeVisible();
  await expect.element(page.getByText('USD', { exact: true })).toBeVisible();
  const descriptions = input.element().getAttribute('aria-describedby')!.split(' ');
  expect(descriptions[0]).toBe('fixture-error');
  expect(descriptions.slice(1).map((id) => document.getElementById(id)?.textContent)).toEqual(['$', 'USD']);
  await app.rerender(<NumericInput label="Fixture units" value="22.5" onChange={changed} unitAfter="%" />);
  await expect.element(page.getByText('$', { exact: true })).not.toBeInTheDocument();
  await expect.element(page.getByText('%', { exact: true })).toBeVisible();
  await app.rerender(<NumericInput label="Fixture units" value="22.5" onChange={changed} />);
  await expect.element(page.getByText('%', { exact: true })).not.toBeInTheDocument();
  await expect.element(input).not.toHaveAttribute('aria-describedby');
  await expect.element(input).toHaveValue('22.5');
  await input.click(); await userEvent.keyboard('x');
  expect(changed).not.toHaveBeenCalled();
});

test('у нескольких ответов с заданным количеством проверка ждёт все варианты и клавиши остаются в реестре', async () => {
  const q = { ...multi(), selectCount: 2 };
  const { screen } = await boot([q]);
  await expect.element(screen.getByText('Выберите 2 ответа.', { exact: true })).toBeVisible();
  await userEvent.keyboard('a');
  await expect.element(screen.getByRole('button', { name: 'Проверить', exact: true })).toBeDisabled();
  await userEvent.keyboard('c');
  await expect.element(screen.getByRole('button', { name: 'Проверить', exact: true })).toBeEnabled();
  await screen.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect.element(screen.getByText('Верно.', { exact: true })).toBeVisible();
});

test('черновики кодеков: неполные значения и неизвестный выбор не становятся полными ответами', () => {
  const n = numeric(true), format = answerFormat(n)!;
  expect(format.decode(givenAnswer({ optionIds: [], numericAnswer: { numerator: '9' } }))).toEqual(['9', '']);
  expect(format.decode(givenAnswer({ optionIds: [], numericAnswer: { denominator: '15' } }))).toEqual(['', '15']);
  expect(format.select(n, [], 'a')).toEqual({ value: [], limit: false });
  expect(format.isComplete(n, undefined)).toBe(false);
  const s = sentence(), sentenceFormat = answerFormat(s)!;
  expect(sentenceFormat.decode(givenAnswer({ optionIds: [] }))).toEqual([]);
  expect(sentenceFormat.isComplete(s, draftAnswer(s, ['missing']))).toBe(false);
  expect(answerFormat(multi())!.isComplete(multi(), draftAnswer(multi(), []))).toBe(false);
  expect(answerFormat(multi())!.instruction({ ...multi(), selectCount: 3 }, dictionaries.en.training)).toBe('Choose 3 answers.');
});
