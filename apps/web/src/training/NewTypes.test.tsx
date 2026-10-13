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
import { ShellProvider } from '../shellContext';
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
  await expect.element(app.screen.getByRole('heading', { level: 1 })).toBeVisible();
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
  await expect.element(screen.getByText('22,5', { exact: true })).toBeVisible();
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


for (const shell of ['site', 'telegram'] as const) for (const device of [
  { name: 'iPhone', platform: 'ios', agent: 'iPhone', touch: 5, mode: 'text' },
  { name: 'iPad', platform: 'ios', agent: 'iPad', touch: 5, mode: 'text' },
  { name: 'iPadOS desktop UA', platform: 'ios', agent: 'Macintosh', touch: 5, mode: 'text' },
  { name: 'Android', platform: 'android', agent: 'Android', touch: 5, mode: 'decimal' },
  { name: 'computer', platform: 'tdesktop', agent: 'Macintosh', touch: 0, mode: 'decimal' },
]) test(`клавиатура ${shell}: ${device.name}`, async () => {
  // Платформа Telegram приоритетнее UA: iOS проверяется также с агентом компьютера.
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(device.agent);
  vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(device.touch);
  const wrap = (integer = false) => <ShellProvider value={{ shell, launch: shell === 'telegram' ? { initDataRaw: '', languageCode: 'ru', platform: device.platform } : null }}>
    <NumericInput value="" onChange={() => {}} label="Keyboard fixture" integer={integer} />
  </ShellProvider>;
  const app = await render(wrap());
  await expect.element(page.getByRole('textbox')).toHaveAttribute('inputmode', device.mode);
  await app.rerender(wrap(true));
  await expect.element(page.getByRole('textbox')).toHaveAttribute('inputmode', device.mode === 'text' ? 'text' : 'numeric');
});

test('дробь: Enter у числителя — next, у знаменателя — done', async () => {
  const { screen } = await boot([numeric(true)]);
  await expect.element(screen.getByRole('textbox', { name: 'Числитель' })).toHaveAttribute('enterkeyhint', 'next');
  await expect.element(screen.getByRole('textbox', { name: 'Знаменатель' })).toHaveAttribute('enterkeyhint', 'done');
});

for (const fraction of [false, true]) test(`число ${fraction ? 'дробью' : 'десятичное'}: начало записи не вызывает ошибку, длина имеет свою ошибку`, async () => {
  const { screen } = await boot([numeric(fraction)]);
  const input = screen.getByRole('textbox', { name: fraction ? 'Числитель' : 'Ответ', exact: true });
  for (const value of fraction ? ['-', ''] : ['-', '.', ',', '-0.']) {
    await input.fill(value);
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
  }
  if (fraction) {
    await input.fill('9');
    await screen.getByRole('textbox', { name: 'Знаменатель' }).fill('-');
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'Проверить', exact: true })).toBeDisabled();
  }
  await input.fill('1'.repeat(129));
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Не больше 128 символов в поле. Сократите запись числа.');
});

for (const check of [true, false]) test(`RC: стрелки вкладки и панели на позиции 2 ${check ? 'в проверке' : 'после проверки'} не листают вопросы`, async () => {
  const questions = [rc(), { ...rc(), id: '00000000-0000-4000-8000-000000000002' }, { ...rc(), id: '00000000-0000-4000-8000-000000000003' }];
  const { screen, training } = await boot(questions, { position: 1, ...(check ? {} : { answers: { 1: givenAnswer({ position: 1 }) } }) }, check);
  const tab = screen.getByRole('tab', { name: 'Вопрос', exact: true });
  await tab.click(); await userEvent.keyboard('{ArrowLeft}');
  await expect.element(screen.getByRole('tab', { name: 'Текст', exact: true })).toHaveFocus();
  await expect.element(screen.getByLabelText('Вопрос 2 из 3')).toBeVisible();
  const panel = screen.getByRole('tabpanel', { name: 'Текст', exact: true });
  (panel.element() as HTMLElement).focus(); await userEvent.keyboard('{ArrowLeft}');
  await expect.element(screen.getByLabelText('Вопрос 2 из 3')).toBeVisible();
  const queued = vi.spyOn(trainingRepository, 'holdSync');
  const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  event.preventDefault(); window.dispatchEvent(event);
  expect(queued).not.toHaveBeenCalled();
  await expect.poll(async () => (await trainingRepository.get(training.session.id))?.position).toBe(1);
});

test('стрелки в поле числа на позиции 2 не листают вопросы', async () => {
  const { screen, training } = await boot([numeric(), { ...numeric(), id: '00000000-0000-4000-8000-000000000002' }], { position: 1 }, true);
  await screen.getByRole('textbox', { name: 'Ответ', exact: true }).fill('22');
  await userEvent.keyboard('{ArrowLeft}{ArrowRight}');
  await expect.poll(async () => (await trainingRepository.get(training.session.id))?.position).toBe(1);
});

test('несколько ответов: доступность различает выбранный верный, пропущенный верный, выбранный неверный и невыбранный', async () => {
  const q = multi(); q.groups[0]!.options.push({ id: 'D', text: 'D word 0' });
  const { screen } = await boot([q]);
  await screen.getByRole('checkbox', { name: 'A word 0', exact: true }).click();
  await screen.getByRole('checkbox', { name: 'B word 0', exact: true }).click();
  await screen.getByRole('button', { name: 'Проверить', exact: true }).click();
  for (const [letter, state] of [['A', 'выбран, верный'], ['C', 'не выбран, верный'], ['B', 'выбран, неверный'], ['D', 'не выбран']]) {
    await expect.element(screen.getByRole('checkbox', { name: `${letter} word 0, ${state}`, exact: true })).toBeVisible();
  }
});

for (const [q, label] of [[rc(), 'Reading Comprehension'], [numeric(true), 'Ввод дробью']] as const) test(`название типа в h1 и разборе: ${label}`, async () => {
  const { screen } = await boot([q], { answers: { 0: givenAnswer({ dontKnow: true, optionIds: [] }) }, finish: { finishedAt: new Date().toISOString(), timedOut: false } });
  await screen.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await expect.element(screen.getByRole('link', { name: new RegExp(`Вопрос 1,.*${label}`) })).toBeVisible();
});

test('скрытый h1 числового задания совпадает с шапкой', async () => {
  const { screen } = await boot([numeric(true)]);
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Ввод дробью', exact: true })).toBeVisible();
});

test('русский разбор выводит десятичный ответ с запятой', async () => {
  const { screen } = await boot([numeric()]);
  await screen.getByRole('textbox', { name: 'Ответ', exact: true }).fill('22,5');
  await screen.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect.element(screen.getByText('22,5', { exact: true })).toBeVisible();
});

for (const type of ['text_completion', 'sentence_equivalence'] as const) test(`проверка: сохранённый частичный ${type} ведёт «Дальше»`, async () => {
  const q = questionFixture(type, type === 'text_completion' ? 3 : 1);
  const partial = [q.groups[0]!.options[0]!.id];
  const { screen } = await boot([q, numeric()], { answers: { 0: givenAnswer({ optionIds: partial }) } }, true);
  await expect.element(screen.getByRole('button', { name: 'Дальше', exact: true })).toBeVisible();
});

for (const check of [false, true]) test(`серия нажатий: одна запись ${check ? 'ответа проверки' : 'черновика'} и кнопка свободна`, async () => {
  const { screen, training } = await boot([numeric()], {}, check);
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const answer = trainingRepository.answer.bind(trainingRepository), draft = trainingRepository.draft.bind(trainingRepository);
  const write = check ? vi.spyOn(trainingRepository, 'answer').mockImplementation(async (...args) => { await held; await answer(...args); })
    : vi.spyOn(trainingRepository, 'draft').mockImplementation(async (...args) => { await held; await draft(...args); });
  const input = screen.getByRole('textbox', { name: 'Ответ', exact: true });
  for (const value of ['2', '22', '22,', '22,5']) paste(input.element(), value);
  try {
    await expect.poll(() => write.mock.calls.length).toBe(1);
    // Транзакция ещё не завершена: кнопка свободна и во время фоновой записи, а не только до и после неё.
    await expect.element(screen.getByRole('button', { name: check ? 'К списку вопросов' : 'Проверить', exact: true })).toBeEnabled();
  } finally { release(); }
  await expect.poll(async () => (await trainingRepository.get(training.session.id))?.drafts?.['0']).toEqual(['22,5']);
  expect(write).toHaveBeenCalledTimes(1);
});

for (const event of ['pagehide', 'visibilitychange'] as const) test(`уход ${event} сразу после ввода сохраняет последний черновик`, async () => {
  const { screen, training } = await boot([numeric()]);
  const write = vi.spyOn(trainingRepository, 'draft');
  const checkpoint = vi.spyOn(trainingRepository, 'checkpointDraft');
  paste(screen.getByRole('textbox', { name: 'Ответ', exact: true }).element(), '22,5');
  expect(write).not.toHaveBeenCalled();
  if (event === 'visibilitychange') {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); document.dispatchEvent(new Event(event));
  } else window.dispatchEvent(new Event(event));
  expect(checkpoint).toHaveBeenCalledWith(training.session.id, expect.objectContaining({ ids: ['22,5'] }), trainingRepository.reportOwner());
  await expect.poll(async () => (await trainingRepository.get(training.session.id))?.drafts?.['0']).toEqual(['22,5']);
});

for (const fraction of [false, true]) test(`длина ${fraction ? 'дроби' : 'числа'}: отдельная ошибка после 128 символов`, async () => {
  const { screen } = await boot([numeric(fraction)]);
  await screen.getByRole('textbox', { name: fraction ? 'Числитель' : 'Ответ', exact: true }).fill('1'.repeat(129));
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Не больше 128 символов в поле. Сократите запись числа.');
});

test('выбор предложения: доступность отмечает выбранное неверное и пропущенное верное', async () => {
  const q = sentence();
  const { screen } = await boot([q]);
  await screen.getByRole('button', { name: q.passage!.paragraphs[0]!.sentences[0]!.text, exact: true }).click();
  await screen.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: `${q.passage!.paragraphs[0]!.sentences[0]!.text}, выбран, неверный`, exact: true })).toBeVisible();
});


for (const fraction of [false, true]) for (const key of ['missing', 'broken'] as const) test(`число ${fraction ? 'дробью' : 'десятичное'} с ключом ${key} сохраняется и отправляется по форме`, async () => {
  const q = numeric(fraction);
  q.numericAnswer = key === 'missing' ? undefined : fraction ? { numerator: 'broken', denominator: '5' } : { number: 'broken' };
  const { screen, training } = await boot([q]);
  const sent: unknown[] = [];
  fakeServer({ [`POST /api/trainings/${training.session.id}/answers`]: async (req) => { sent.push(await req.json()); return new Response(null, { status: 204 }); } });
  if (fraction) {
    await screen.getByRole('textbox', { name: 'Числитель', exact: true }).fill('9');
    await screen.getByRole('textbox', { name: 'Знаменатель', exact: true }).fill('15');
  } else await screen.getByRole('textbox', { name: 'Ответ', exact: true }).fill('22,5');
  await screen.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect.poll(async () => (await trainingRepository.get(training.session.id))?.answers['0']?.numericAnswer).toEqual(fraction ? { numerator: '9', denominator: '15' } : { number: '22.5' });
  await trainingRepository.sync();
  expect(sent).toEqual([expect.objectContaining({ answers: [expect.objectContaining({ numericAnswer: fraction ? { numerator: '9', denominator: '15' } : { number: '22.5' } })] })]);
});

test('журнал ухода не подменяет нового владельца и переживает отказ необязательной очистки', async () => {
  const { screen } = await boot([numeric()]);
  const failed = vi.spyOn(trainingRepository.store.leavingDrafts, 'put').mockImplementationOnce(() => { throw new Error('storage unavailable'); });
  await screen.getByRole('textbox', { name: 'Ответ', exact: true }).fill('2');
  window.dispatchEvent(new Event('pagehide'));
  await expect.poll(() => failed.mock.calls.length).toBe(1);
  await expect.poll(async () => (await trainingRepository.list())[0]?.drafts?.['0']).toEqual(['2']);
  const owner = trainingRepository.reportOwner()!;
  const id = (await trainingRepository.list())[0]!.session.id;
  expect(() => trainingRepository.checkpointDraft(id, { position: 0, ids: ['wrong'] }, { ...owner, revision: owner.revision + 1 })).toThrow();
  vi.spyOn(trainingRepository.store.leavingDrafts, 'remove').mockImplementationOnce(() => { throw new Error('storage unavailable'); });
  await screen.getByRole('textbox', { name: 'Ответ', exact: true }).fill('22');
  await expect.poll(async () => (await trainingRepository.list())[0]?.drafts?.['0']).toEqual(['22']);
});
