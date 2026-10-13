import type { Page, Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { schemas, trainingNumericSolution, type Question } from '../packages/api-client/src';
import { checkScreen, expect } from './fixtures';
import { pick, startSession, finishCheck } from './training';

const raw: unknown = JSON.parse(readFileSync(new URL('../api/conformance/question-types.json', import.meta.url), 'utf8'));
if (!raw || typeof raw !== 'object' || !('answers' in raw) || !Array.isArray(raw.answers)) throw new Error('invalid conformance fixtures');
const conformance = { answers: raw.answers.map((value: unknown) => {
  if (!value || typeof value !== 'object' || !('question' in value) || !('answer' in value) || !('correct' in value) || typeof value.correct !== 'boolean' || !('badAnswer' in value) || typeof value.badAnswer !== 'boolean') throw new Error('invalid answer fixture');
  return { question: schemas.Question.parse(value.question), answer: schemas.GivenAnswer.parse(value.answer), correct: value.correct, badAnswer: value.badAnswer };
}) };

export const NEW_TYPES = [['multiple_choice_multi', 'Quant'], ['numeric_entry', 'Quant'], ['select_in_passage', 'Verbal'], ['multiple_choice', 'Verbal']] as const;

async function chooseAnswer(page: Page, q: Question, partial = false) {
  if (q.passage && q.questionType !== 'select_in_passage' && page.viewportSize()!.width < 900) await page.getByRole('tab', { name: 'Вопрос', exact: true }).click();
  if (q.questionType === 'select_in_passage') {
    const correct = q.passage!.paragraphs.flatMap((p) => p.sentences).find((s) => q.answer.includes(s.id))!;
    await page.getByRole('button', { name: correct.text, exact: true }).click(); return;
  }
  if (q.questionType === 'numeric_entry') {
    const value = trainingNumericSolution(q)!;
    if (value.number !== undefined) await page.getByRole('textbox', { name: 'Ответ', exact: true }).fill(value.number.replace('.', ','));
    else {
      // Несокращённый ответ — значение, а не строковое совпадение с ключом.
      await page.getByRole('textbox', { name: 'Числитель', exact: true }).fill(String(BigInt(value.numerator!) * 3n));
      await page.getByRole('textbox', { name: 'Знаменатель', exact: true }).fill(String(BigInt(value.denominator!) * 3n));
    }
    return;
  }
  if (partial) {
    const option = q.groups[0]!.options.find((o) => q.answer.includes(o.id))!;
    await page.getByRole('checkbox', { name: option.text, exact: true }).click();
  } else await pick(page, q);
}

export async function newTypesSession(page: Page, [type, section]: typeof NEW_TYPES[number], mode: 'practice' | 'check' = 'practice') {
  const announced = new Set<string>();
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/home' || request.method() === 'POST' && /^\/api\/trainings(?:$|\/[^/]+\/(?:answers|finish)$)/.test(path)) {
      expect(request.headers()['x-training-capabilities']?.split(',')).toEqual(['text_completion', 'sentence_equivalence', 'quantitative_comparison', 'multiple_choice', 'multiple_choice_multi', 'numeric_entry', 'select_in_passage', 'passage']);
      announced.add(path === '/api/home' ? 'home' : path.endsWith('/answers') ? 'answers' : path.endsWith('/finish') ? 'finish' : 'start');
    }
  });
  const home = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/home');
  await page.reload(); await home;
  const session = await startSession(page, mode, 50, section, type);
  expect(session.items.every((i) => !i.question.figure)).toBe(true);
  if (section === 'Verbal') expect(session.items.some((i) => i.question.passage)).toBe(true);
  const delivered = new Set<number>();
  let sync = false;
  await page.route('**/api/trainings/*/answers', async (route) => {
    const capabilities = route.request().headers()['x-training-capabilities']!.split(',');
    expect(capabilities).toEqual(expect.arrayContaining(['multiple_choice_multi', 'numeric_entry', 'select_in_passage', 'passage']));
    expect(capabilities).not.toContain('figure');
    if (!sync) { await route.abort('internetdisconnected'); return; }
    const response = await route.fetch();
    expect(response.status()).toBe(204);
    for (const answer of schemas.AnswerBatch.parse(route.request().postDataJSON()).answers) delivered.add(answer.position);
    await route.fulfill({ response });
  });
  await page.context().setOffline(true);
  let correct = 0;
  for (const item of session.items) {
    await expect(page.getByLabel(`Вопрос ${item.position + 1} из ${session.items.length}`, { exact: true })).toBeVisible();
    const partial = type === 'multiple_choice_multi' && item.position === 0 && item.question.answer.length > 1;
    await chooseAnswer(page, item.question, partial);
    if (mode === 'practice') {
      await page.getByRole('button', { name: 'Проверить', exact: true }).click();
      await expect(page.getByText(partial ? 'Неверно.' : 'Верно.', { exact: true })).toBeVisible();
    }
    if (!partial) correct++;
    if (item.position === 0) {
      await page.context().setOffline(false); await page.reload();
      if (item.question.passage && item.question.questionType !== 'select_in_passage' && page.viewportSize()!.width < 900) await page.getByRole('tab', { name: 'Вопрос', exact: true }).click();
      if (mode === 'practice') await expect(page.getByText(partial ? 'Неверно.' : 'Верно.', { exact: true })).toBeVisible();
      else {
        await expect(page.getByLabel(`Вопрос 1 из ${session.items.length}`, { exact: true })).toBeVisible();
        if (type === 'numeric_entry') await expect(page.getByRole('textbox').first()).not.toHaveValue('');
        else if (type === 'select_in_passage') await expect(page.getByRole('button', { name: item.question.passage!.paragraphs.flatMap((p) => p.sentences).find((s) => item.question.answer.includes(s.id))!.text, exact: true })).toHaveAttribute('aria-pressed', 'true');
        else await expect(page.getByRole(item.question.selectCount === 1 ? 'radio' : 'checkbox', { name: item.question.groups[0]!.options.find((o) => item.question.answer.includes(o.id))!.text, exact: true })).toHaveAttribute('aria-checked', 'true');
      }
      expect(delivered.size).toBe(0); await page.context().setOffline(true);
    }
    await page.getByRole('button', { name: item.position === session.items.length - 1 ? mode === 'check' ? 'К списку вопросов' : 'К итогу' : 'Дальше', exact: true }).click();
  }
  if (mode === 'check') await finishCheck(page);
  await expect(page.getByRole('heading', { name: `${correct} из ${session.items.length} верно`, exact: true })).toBeVisible();
  const result = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith(`/api/trainings/${session.id}/finish`));
  sync = true; await page.context().setOffline(false);
  expect(schemas.TrainingSummary.parse(await (await result).json()).correct).toBe(correct);
  await expect.poll(() => delivered.size).toBe(session.items.length);
  expect([...announced].sort()).toEqual(['answers', 'finish', 'home', 'start']);
}

export async function numericConformanceUi(page: Page) {
  // UI проверяется на тех же примерах, что общая проверка: своих таблиц ожидаемых ответов здесь нет.
  const examples = conformance.answers.filter((c) => c.question.questionType === 'numeric_entry' && !c.badAnswer);
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch(); const session = schemas.TrainingSession.parse(await response.json());
    await route.fulfill({ response, json: { ...session, items: examples.map((c, position) => ({ position, question: c.question })) } });
  });
  await page.route('**/api/trainings/*/answers', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/trainings/*/finish', (route) => route.fulfill({ status: 200, json: { correct: 0, total: examples.length, unanswered: 0, durationSeconds: 0, review: [] } }));
  await startSession(page, 'practice', 50, 'Quant', 'numeric_entry');
  for (let index = 0; index < examples.length; index++) {
    const c = examples[index]!, value = c.answer.numericAnswer;
    if (value?.number !== undefined) await page.getByRole('textbox', { name: 'Ответ', exact: true }).fill(value.number.replace('.', ','));
    else if (value) {
      await page.getByRole('textbox', { name: 'Числитель', exact: true }).fill(value.numerator!);
      await page.getByRole('textbox', { name: 'Знаменатель', exact: true }).fill(value.denominator!);
    }
    if (!value) await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
    else await page.getByRole('button', { name: 'Проверить', exact: true }).click();
    await expect(page.getByText(value ? c.correct ? 'Верно.' : 'Неверно.' : 'Разберём', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: index === examples.length - 1 ? 'К итогу' : 'Дальше', exact: true }).click();
  }
}

async function pasteText(page: Page, field: Locator, value: string) {
  await field.fill('');
  await page.evaluate((value) => { const source = document.createElement('textarea'); source.id = 'clipboard-fixture'; source.value = value; document.body.append(source); source.focus(); source.select(); }, value);
  await page.keyboard.press('ControlOrMeta+c'); await page.evaluate(() => document.getElementById('clipboard-fixture')?.remove());
  await field.focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('ControlOrMeta+v');
}

export async function numericInvalidPaste(page: Page) {
  await startSession(page, 'practice', 50, 'Quant', 'numeric_entry');
  const number = page.getByRole('textbox', { name: 'Ответ', exact: true });
  const numerator = page.getByRole('textbox', { name: 'Числитель', exact: true });
  const field = await number.count() ? number : numerator;
  await pasteText(page, field, '22,5,0');
  await expect(field).toHaveValue('22,5,0'); await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Проверить', exact: true })).toBeDisabled();
  await page.reload(); await expect(field).toHaveValue('22,5,0');
}

export async function readingScroll(page: Page) {
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch(); const session = schemas.TrainingSession.parse(await response.json());
    const first = session.items.find((i) => i.question.passage)!;
    const passage = first.question.passage!;
    const paragraphs = Array.from({ length: 12 }, () => passage.paragraphs[0]!);
    const question = { ...first.question, passage: { ...passage, paragraphs } };
    await route.fulfill({ response, json: { ...session, items: [0, 1].map((position) => ({ position, question: { ...question, id: position === 0 ? question.id : '00000000-0000-4000-8000-000000000099' } })) } });
  });
  await page.route('**/api/trainings/*/answers', (route) => route.fulfill({ status: 204 }));
  const session = await startSession(page, 'practice', 50, 'Verbal', 'multiple_choice');
  if (page.viewportSize()!.width < 900) await expect(page.getByRole('tab', { name: 'Текст', exact: true })).toHaveAttribute('aria-selected', 'true');
  const text = page.getByRole('tabpanel', { name: 'Текст', exact: true });
  await text.evaluate((element) => { element.scrollTop = 370; });
  await expect.poll(() => text.evaluate((e) => e.scrollTop)).toBeGreaterThan(100);
  const top = await text.evaluate((e) => e.scrollTop);
  if (page.viewportSize()!.width < 900) {
    await page.getByRole('tab', { name: 'Вопрос', exact: true }).click();
    await page.getByRole('tab', { name: 'Текст', exact: true }).click();
    await expect.poll(() => text.evaluate((e) => e.scrollTop)).toBe(top);
  }
  await chooseAnswer(page, session.items[0]!.question);
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  if (page.viewportSize()!.width < 900) await expect(page.getByRole('tab', { name: 'Вопрос', exact: true })).toHaveAttribute('aria-selected', 'true');
}

export async function newTypesScreens(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-12T09:00:00Z'));
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch(); const session = schemas.TrainingSession.parse(await response.json());
    await route.fulfill({ response, json: { ...session, items: session.items.toSorted((a, b) => a.question.id.localeCompare(b.question.id)).map((item, position) => ({ ...item, position })) } });
  });
  await page.route('**/api/trainings/*/answers', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/trainings/*/finish', (route) => route.fulfill({ status: 200, json: { correct: 0, total: 3, unanswered: 0, durationSeconds: 0, review: [] } }));
  const home = new URL(page.url()).pathname;
  let phase = 0;
  for (const [type, section] of NEW_TYPES) {
    await page.clock.setFixedTime(new Date(Date.UTC(2026, 9, 12, 9) + phase++ * 1000));
    await page.goto(home);
    const session = await startSession(page, 'practice', 50, section, type);
    const names = new Set<string>();
    for (const item of session.items) {
      const q = item.question;
      const name = q.questionType === 'numeric_entry' ? q.numericEntry?.format === 'fraction' ? 'fraction' : 'number' : q.questionType === 'select_in_passage' ? 'sentence' : q.passage ? 'rc' : 'multi';
      if (!names.has(name)) {
        if (name === 'rc') {
          await checkScreen(page, 'training-b-rc-text');
          if (page.viewportSize()!.width < 900) await page.getByRole('tab', { name: 'Вопрос', exact: true }).click();
        }
        await chooseAnswer(page, q);
        await checkScreen(page, `training-b-${name}`);
        if (name === 'number' || name === 'fraction') {
          const field = page.getByRole('textbox', { name: name === 'number' ? 'Ответ' : 'Знаменатель', exact: true });
          await pasteText(page, field, name === 'number' ? '22,5,0' : '0');
          await expect(field).toHaveAttribute('aria-invalid', 'true');
          await checkScreen(page, `training-b-${name}-bad`);
          await chooseAnswer(page, q);
        }
        names.add(name);
        await page.getByRole('button', { name: 'Проверить', exact: true }).click();
        await checkScreen(page, `training-b-${name}-correct`);
      } else await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
      await page.getByRole('button', { name: item.position === session.items.length - 1 ? 'К итогу' : 'Дальше', exact: true }).click();
    }
    await expect(page.getByRole('link', { name: 'Все ответы и разборы', exact: true })).toBeVisible();
  }
  for (const [type, section] of NEW_TYPES.slice(0, 3)) {
    await page.clock.setFixedTime(new Date(Date.UTC(2026, 9, 12, 9) + phase++ * 1000));
    await page.goto(home);
    const session = await startSession(page, 'practice', 50, section, type);
    const q = session.items[0]!.question;
    if (type === 'multiple_choice_multi') {
      const correct = q.groups[0]!.options.find((o) => q.answer.includes(o.id))!;
      const wrong = q.groups[0]!.options.find((o) => !q.answer.includes(o.id))!;
      await page.getByRole('checkbox', { name: correct.text, exact: true }).click();
      await page.getByRole('checkbox', { name: wrong.text, exact: true }).click();
    } else if (type === 'select_in_passage') {
      const wrong = q.passage!.paragraphs.flatMap((p) => p.sentences).find((s) => !q.answer.includes(s.id))!;
      await page.getByRole('button', { name: wrong.text, exact: true }).click();
    } else if (q.numericEntry?.format === 'number') await page.getByRole('textbox', { name: 'Ответ', exact: true }).fill('999');
    else {
      await page.getByRole('textbox', { name: 'Числитель', exact: true }).fill('999');
      await page.getByRole('textbox', { name: 'Знаменатель', exact: true }).fill('1');
    }
    await page.getByRole('button', { name: 'Проверить', exact: true }).click();
    await expect(page.getByText('Неверно.', { exact: true })).toBeVisible();
    await checkScreen(page, `training-b-${type === 'multiple_choice_multi' ? 'multi' : type === 'select_in_passage' ? 'sentence' : 'number'}-wrong`);
  }
}

export async function explicitNumericExamples(page: Page) {
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch(); const session = schemas.TrainingSession.parse(await response.json());
    const base = session.items[0]!.question;
    await route.fulfill({ response, json: { ...session, items: [
      { position: 0, question: { ...base, prompt: 'Synthetic decimal entry fixture.', numericEntry: { format: 'number' }, numericAnswer: { number: '22.50' } } },
      { position: 1, question: { ...base, prompt: 'Synthetic fraction entry fixture.', numericEntry: { format: 'fraction' }, numericAnswer: { numerator: '3', denominator: '5' } } },
    ] } });
  });
  await page.route('**/api/trainings/*/answers', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/trainings/*/finish', (route) => route.fulfill({ status: 200, json: { correct: 2, total: 2, unanswered: 0, durationSeconds: 0, review: [] } }));
  await startSession(page, 'practice', 50, 'Quant', 'numeric_entry');
  const number = page.getByRole('textbox', { name: 'Ответ', exact: true });
  await number.fill('22,5');
  await expect(page.getByRole('button', { name: 'Проверить', exact: true })).toBeEnabled();
  await page.reload(); await expect(number).toHaveValue('22,5');
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.getByText('Верно.', { exact: true })).toBeVisible();
  await expect(page.getByText('22,5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await page.getByRole('textbox', { name: 'Числитель', exact: true }).fill('9');
  await page.getByRole('textbox', { name: 'Знаменатель', exact: true }).fill('15');
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.getByText('Верно.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2 из 2 верно', exact: true })).toBeVisible();
}

export async function flaggedHover(page: Page) {
  await startSession(page, 'check');
  await page.getByRole('button', { name: 'Отметить, чтобы вернуться', exact: true }).click();
  const marked = page.getByRole('button', { name: 'Снять отметку', exact: true });
  await expect(marked).toBeEnabled();
  await expect(marked).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Вопросы', exact: true }).hover();
  const selectedBackground = await marked.evaluate((button) => getComputedStyle(button).backgroundColor);
  await marked.hover();
  await expect(marked).toHaveCSS('background-color', selectedBackground);
}


export async function readingKeyboard(page: Page, mode: 'practice' | 'check') {
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch(); const session = schemas.TrainingSession.parse(await response.json());
    const q = session.items.find((i) => i.question.passage)!.question;
    await route.fulfill({ response, json: { ...session, items: Array.from({ length: 3 }, (_, position) => ({ position, question: { ...q, id: `00000000-0000-4000-8000-00000000009${position}` } })) } });
  });
  await page.route('**/api/trainings/*/answers', (route) => route.fulfill({ status: 204 }));
  const session = await startSession(page, mode, 50, 'Verbal', 'multiple_choice');
  await chooseAnswer(page, session.items[0]!.question);
  if (mode === 'practice') await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(page.getByLabel('Вопрос 2 из 3', { exact: true })).toBeVisible();
  if (mode === 'practice') {
    await chooseAnswer(page, session.items[1]!.question);
    await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  }
  if (page.viewportSize()!.width < 900) {
    const tab = page.getByRole('tab', { name: 'Вопрос', exact: true });
    await tab.focus(); await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Текст', exact: true })).toBeFocused();
    await expect(page.getByLabel('Вопрос 2 из 3', { exact: true })).toBeVisible();
    await page.keyboard.press('ArrowRight'); await expect(tab).toBeFocused();
  }
  const panel = page.getByRole('tabpanel', { name: page.viewportSize()!.width < 900 ? 'Вопрос' : 'Текст', exact: true });
  await panel.focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Вопрос 2 из 3', { exact: true })).toBeVisible();
}

export async function readingShortcuts(page: Page) {
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch(); const session = schemas.TrainingSession.parse(await response.json());
    const q = session.items.find((i) => i.question.passage)!.question;
    await route.fulfill({ response, json: { ...session, items: [0, 1].map((position) => ({ position, question: { ...q, id: `00000000-0000-4000-8000-00000000009${position}` } })) } });
  });
  await page.route('**/api/trainings/*/answers', (route) => route.fulfill({ status: 204 }));
  const session = await startSession(page, 'practice', 50, 'Verbal', 'multiple_choice');
  const q = session.items[0]!.question;
  const text = page.getByRole('tabpanel', { name: 'Текст', exact: true });
  const textTab = page.getByRole('tab', { name: 'Текст', exact: true });
  const questionTab = page.getByRole('tab', { name: 'Вопрос', exact: true });
  for (const [index, option] of q.groups[0]!.options.entries()) {
    if (page.viewportSize()!.width < 900) await textTab.click();
    await text.focus(); await page.keyboard.press(String.fromCharCode(65 + index));
    if (page.viewportSize()!.width < 900) await questionTab.click();
    await expect(page.getByRole('radio', { name: option.text, exact: true })).toHaveAttribute('aria-checked', 'true');
  }
  if (page.viewportSize()!.width < 900) {
    await questionTab.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Проверить', exact: true })).toBeVisible();
  }
  await chooseAnswer(page, q);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Верно.', { exact: true })).toBeVisible();
}

export async function longOpenQuestion(page: Page) {
  await page.route('**/api/trainings/*/answers', (route) => {
    const answers = schemas.AnswerBatch.parse(route.request().postDataJSON()).answers;
    expect(answers[0]!.elapsedMs).toBe(86_400_000);
    return route.fulfill({ status: 204 });
  });
  const session = await startSession(page, 'practice', 50, 'Quant', 'numeric_entry');
  await page.clock.setFixedTime(new Date(Date.now() + 2 * 86_400_000));
  await chooseAnswer(page, session.items[0]!.question);
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.getByText('Верно.', { exact: true })).toBeVisible();
}

export async function suspendedWriteExit(page: Page, telegram = false) {
  const home = new URL(page.url()).pathname;
  const session = await startSession(page, 'practice', 50, 'Quant', 'numeric_entry');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      const request = original.call(this, value, key);
      if (this.name === 'trainings') {
        // Транзакция не сообщает о завершении: экран обязан выйти, не дожидаясь её.
        request.addEventListener = () => {};
        document.documentElement.dataset.fixtureWrite = 'pending';
      }
      return request;
    };
  });
  await chooseAnswer(page, session.items[0]!.question);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-write', 'pending');
  await page.locator(telegram ? '#tg-mock-back' : 'button[aria-label="Закрыть тренировку"]').click();
  await expect(page.getByRole('heading', { name: 'Тренировка', exact: true })).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === home);
}

export async function partialBatch(page: Page) {
  const number = conformance.answers.find((c) => c.correct && c.question.questionType === 'numeric_entry' && c.question.numericEntry?.format === 'number')!.question;
  const fraction = conformance.answers.find((c) => c.correct && c.question.questionType === 'numeric_entry' && c.question.numericEntry?.format === 'fraction')!.question;
  const sentence = conformance.answers.find((c) => c.correct && c.question.questionType === 'select_in_passage')!.question;
  const questions = [number, fraction, sentence, number, sentence];
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch(); const session = schemas.TrainingSession.parse(await response.json());
    await route.fulfill({ response, json: { ...session, items: questions.map((question, position) => ({ position, question })) } });
  });
  const sent = new Map<number, import('../packages/api-client/src').GivenAnswer>();
  await page.route('**/api/trainings/*/answers', async (route) => {
    for (const answer of schemas.AnswerBatch.parse(route.request().postDataJSON()).answers) sent.set(answer.position, answer);
    await route.fulfill({ status: 204 });
  });
  await page.route('**/api/trainings/*/finish', (route) => route.fulfill({ status: 200, json: { correct: 1, total: 5, unanswered: 4, durationSeconds: 0, review: [] } }));
  await startSession(page, 'check', 50, 'Quant', 'numeric_entry');
  const input = page.getByRole('textbox', { name: 'Ответ', exact: true });
  await input.fill('-');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Вопрос 1 из 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
  await page.getByRole('textbox', { name: 'Числитель', exact: true }).fill('9');
  await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
  await page.getByRole('button', { name: 'Отметить, чтобы вернуться', exact: true }).click();
  await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ответ', exact: true }).fill('-');
  await page.getByRole('textbox', { name: 'Ответ', exact: true }).fill('');
  await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
  await chooseAnswer(page, sentence);
  await page.getByRole('button', { name: 'К списку вопросов', exact: true }).click();
  await finishCheck(page);
  await expect.poll(() => sent.size).toBe(5);
  for (let position = 0; position < 4; position++) {
    expect(sent.get(position)).not.toHaveProperty('numericAnswer');
    expect(sent.get(position)).not.toHaveProperty('sentenceId');
  }
  expect(sent.get(4)?.sentenceId).toBe(sentence.answer[0]);
}
