import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gradeTrainingAnswer, schemas, type DataFigure, type GivenAnswer, type Question, type TrainingSession } from '../packages/api-client/src';
import { checkScreen, expect } from './fixtures';
import { chooseAnswer } from './training-types';
import { finishCheck, startSession, trainingBack } from './training';

const TYPES = ['text_completion', 'sentence_equivalence', 'quantitative_comparison', 'multiple_choice', 'multiple_choice_multi', 'numeric_entry', 'select_in_passage'];
const QUANT_TYPES = ['quantitative_comparison', 'multiple_choice', 'multiple_choice_multi', 'numeric_entry'];
const VERBAL_TYPES = ['text_completion', 'sentence_equivalence', 'multiple_choice', 'multiple_choice_multi', 'select_in_passage'];
const CAPABILITIES = [...TYPES, 'passage', 'figure'];

export async function seedFigureSession(page: Page, mode: 'practice' | 'check') {
  const paths = new Set<string>();
  let headers: Record<string, string> = {};
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/trainings' && request.method() === 'POST') headers = request.headers();
    if (/^\/api\/(?:home|trainings(?:\/options|\/[^/]+(?:\/answers|\/finish)?)?)$/.test(path)) {
      expect(request.headers()['x-training-capabilities']?.split(',')).toEqual(CAPABILITIES);
      paths.add(path);
    }
  });
  await page.reload();
  const session = await startSession(page, mode, 50, 'Quant', 'numeric_entry');
  const figures = session.items.filter((item) => item.question.figure);
  expect(figures.length).toBeGreaterThan(0);
  let finishStatus = 0;
  page.on('response', (response) => { if (response.url().endsWith(`/api/trainings/${session.id}/finish`)) finishStatus = response.status(); });
  for (const item of session.items) {
    await expect(page.getByLabel(`Вопрос ${item.position + 1} из ${session.items.length}`, { exact: true })).toBeVisible();
    const q = item.question;
    if (q.figure) {
      await expect(page.getByRole('figure', { name: q.figure.description, exact: true })).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
      await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
      await expect(page.getByRole('heading', { name: 'Сообщить об ошибке', exact: true })).toBeVisible();
      await expect(page.locator('[data-data-figure]')).toHaveCount(1);
      await expect(page.locator('[data-data-figure]')).toHaveAttribute('aria-label', q.figure.description);
      await trainingBack(page);
      await expect(page.getByRole('figure', { name: q.figure.description, exact: true })).toBeVisible();
    }
    await chooseAnswer(page, q);
    if (mode === 'practice') {
      await page.getByRole('button', { name: 'Проверить', exact: true }).click();
      if (q.figure) await expect(page.getByRole('figure', { name: q.figure.description, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: item.position === session.items.length - 1 ? mode === 'check' ? 'К списку вопросов' : 'К итогу' : 'Дальше', exact: true }).click();
  }
  if (mode === 'check') await finishCheck(page);
  await expect(page.getByRole('heading', { name: `${session.items.length} из ${session.items.length} верно`, exact: true })).toBeVisible();
  await expect.poll(() => finishStatus).toBe(200);
  await page.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await expect(page.locator('[data-data-figure]')).toHaveCount(figures.length);
  const item = figures[0]!;
  await page.getByRole('link', { name: new RegExp(`^Вопрос ${item.position + 1},`) }).click();
  await expect(page.getByRole('figure', { name: item.question.figure!.description, exact: true })).toBeVisible();
  // Экран истории пока читает IndexedDB. Дополнительно проверяем настоящий GET договора
  // с теми же возможностями и авторизацией, не меняя модель хранения этой задачей.
  const read = await page.request.get(`/api/trainings/${session.id}`, { headers });
  expect(read.status()).toBe(200);
  const reloaded = schemas.TrainingSession.parse(await read.json());
  expect(reloaded.items[item.position]!.question.figure).toEqual(item.question.figure);
  await page.reload();
  await expect(page.getByRole('figure', { name: item.question.figure!.description, exact: true })).toBeVisible();
  expect(paths).toContain('/api/trainings/options');
}

/** Сервер собирает один раздел. Только этот UI-сценарий объединяет два настоящих
 * ответа стенда, чтобы смена форматов проверялась в одном состоянии сессии. */
export async function allTypesSession(page: Page, mode: 'practice' | 'check') {
  let mixed: TrainingSession | undefined;
  const delivered = new Map<number, GivenAnswer>();
  await page.route('**/api/trainings', async (route) => {
    const request = schemas.TrainingRequest.parse(route.request().postDataJSON());
    const sessions = await Promise.all(['quant', 'verbal'].map(async (section) => {
      const response = await route.fetch({ postData: { ...request, section, topicIds: [], count: 50, questionTypes: section === 'quant' ? QUANT_TYPES : VERBAL_TYPES } });
      expect(response.status()).toBe(201); return schemas.TrainingSession.parse(await response.json());
    }));
    const available = sessions.flatMap((s) => s.items.map((i) => i.question));
    const find = (matches: (q: Question) => boolean) => { const q = available.find(matches); if (!q) throw new Error('missing GRE format fixture'); return q; };
    const questions = [
      find((q) => q.questionType === 'text_completion' && q.groups.length === 3), find((q) => q.questionType === 'sentence_equivalence'),
      find((q) => q.questionType === 'quantitative_comparison'), find((q) => q.questionType === 'multiple_choice' && !q.passage && !q.figure),
      find((q) => q.questionType === 'multiple_choice_multi' && !q.passage && !q.figure),
      find((q) => q.questionType === 'numeric_entry' && q.numericEntry?.format === 'number' && !q.figure),
      find((q) => q.questionType === 'numeric_entry' && q.numericEntry?.format === 'fraction'), find((q) => q.questionType === 'select_in_passage'),
      find((q) => q.questionType === 'multiple_choice' && !!q.passage), find((q) => q.figure?.kind === 'bar'), find((q) => q.figure?.kind === 'line'),
    ];
    mixed = schemas.TrainingSession.parse({ ...sessions[0], questionTypes: TYPES, items: questions.map((question, position) => ({ position, question })) });
    await route.fulfill({ status: 201, json: mixed });
  });
  await page.route('**/api/trainings/*/answers', async (route) => {
    for (const answer of schemas.AnswerBatch.parse(route.request().postDataJSON()).answers) {
      const question = mixed!.items[answer.position]!.question;
      expect(gradeTrainingAnswer(question, answer).badAnswer).toBe(false);
      if (question.questionType === 'numeric_entry' && !answer.dontKnow) { expect(answer.numericAnswer).toBeDefined(); expect(answer.sentenceId).toBeUndefined(); expect(answer.optionIds).toEqual([]); }
      else if (question.questionType === 'select_in_passage' && !answer.dontKnow) { expect(answer.sentenceId).toBeDefined(); expect(answer.numericAnswer).toBeUndefined(); expect(answer.optionIds).toEqual([]); }
      else { expect(answer.sentenceId).toBeUndefined(); expect(answer.numericAnswer).toBeUndefined(); }
      delivered.set(answer.position, answer);
    }
    await route.fulfill({ status: 204 });
  });
  await page.route('**/api/trainings/*/finish', (route) => route.fulfill({ status: 200, json: { correct: 10, total: 11, unanswered: 1, durationSeconds: 0, review: [] } }));
  const session = await startSession(page, mode, 50, 'Quant', 'numeric_entry');
  for (const item of session.items) {
    const q = item.question;
    await expect(page.getByLabel(`Вопрос ${item.position + 1} из ${session.items.length}`, { exact: true })).toBeVisible();
    // Несколько ответов намеренно пропускаем: «Не знаю» не наследует выбранные слова.
    if (mode === 'practice' && item.position === 4) await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
    else if (mode === 'check' && item.position === 4) { await page.getByRole('button', { name: 'Пропустить', exact: true }).click(); continue; }
    else {
      await chooseAnswer(page, q);
      // На каждой форме заново читаем сохранённый черновик; на первом вопросе нет ключа ответа.
      await page.reload();
      if (q.passage && q.questionType !== 'select_in_passage' && page.viewportSize()!.width < 900) await page.getByRole('tab', { name: 'Вопрос', exact: true }).click();
      if (q.questionType === 'numeric_entry') await expect(page.getByRole('textbox').first()).not.toHaveValue('');
      else if (q.questionType === 'select_in_passage') await expect(page.getByRole('button', { name: q.passage!.paragraphs.flatMap((p) => p.sentences).find((s) => s.id === q.answer[0])!.text, exact: true })).toHaveAttribute('aria-pressed', 'true');
      else for (const group of q.groups) for (const option of group.options.filter((o) => q.answer.includes(o.id))) await expect(page.getByRole(q.selectCount === 1 ? 'radio' : 'checkbox', { name: option.text, exact: true })).toHaveAttribute('aria-checked', 'true');
      if (item.position > 0) {
        await page.getByRole('button', { name: 'Предыдущий вопрос', exact: true }).click();
        if (mode === 'practice') await page.getByRole('button', { name: `К вопросу ${item.position + 1}`, exact: true }).click();
        else await page.getByRole('button', { name: /^(Дальше|Пропустить)$/, exact: true }).click();
      }
      if (mode === 'practice') await page.getByRole('button', { name: 'Проверить', exact: true }).click();
    }
    if (q.figure) await expect(page.getByRole('figure', { name: q.figure.description, exact: true })).toBeVisible();
    await page.getByRole('button', { name: item.position === session.items.length - 1 ? mode === 'check' ? 'К списку вопросов' : 'К итогу' : 'Дальше', exact: true }).click();
  }
  if (mode === 'check') await finishCheck(page);
  await expect(page.getByRole('heading', { name: '10 из 11 верно', exact: true })).toBeVisible();
  await expect.poll(() => delivered.size).toBe(mode === 'practice' ? 11 : 10);
  if (mode === 'practice') expect(delivered.get(4)?.dontKnow).toBe(true);
  else expect(delivered.has(4)).toBe(false);
  await page.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await page.getByRole('link', { name: /^Вопрос 1,/ }).click();
  for (const item of session.items) {
    await expect(page.getByRole('heading', { name: `Вопрос ${item.position + 1}`, exact: true })).toBeVisible();
    if (item.question.figure) await expect(page.getByRole('figure', { name: item.question.figure.description, exact: true })).toBeVisible();
    if (item.position < session.items.length - 1) await page.getByRole('button', { name: 'Следующий', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Предыдущий вопрос', exact: true }).click();
  await expect(page.getByRole('figure', { name: session.items[9]!.question.figure!.description, exact: true })).toBeVisible();
}

export async function figureScreens(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-12T09:00:00Z'));
  await page.route('**/api/trainings', async (route) => {
    const request = schemas.TrainingRequest.parse(route.request().postDataJSON());
    const response = await route.fetch({ postData: { ...request, topicIds: [], count: 50, questionTypes: QUANT_TYPES } });
    const session = schemas.TrainingSession.parse(await response.json());
    const bar = session.items.find((i) => i.question.figure?.kind === 'bar')!.question;
    const line = session.items.find((i) => i.question.figure?.kind === 'line' && i.question.questionType === 'multiple_choice')!.question;
    const table: DataFigure = { ...bar.figure!, id: 'synthetic-table', kind: 'table', title: 'Synthetic depot data table' };
    const wide: DataFigure = { ...table, id: 'synthetic-wide-table', title: 'Synthetic data from six depots', series: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, label: `Depot ${i + 1} — weekly parcels`, values: [i * 5, 0, -i * 10] })), description: 'Synthetic table with six depots; Monday values 0, 5, 10, 15, 20, 25; Tuesday all zero; Wednesday 0, −10, −20, −30, −40, −50.' };
    await route.fulfill({ response, json: { ...session, items: [bar, line, { ...bar, figure: table }, { ...bar, figure: wide }].map((question, position) => ({ position, question: { ...question, id: `00000000-0000-4000-8000-00000000009${position}` } })) } });
  });
  await page.route('**/api/trainings/*/answers', (route) => route.fulfill({ status: 204 }));
  const session = await startSession(page, 'practice', 50, 'Quant', 'multiple_choice_multi');
  const names = ['bar', 'line', 'table', 'table-wide'];
  for (const item of session.items) {
    await expect(page.getByRole('figure', { name: item.question.figure!.description, exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    if (page.viewportSize()!.width >= 900) {
      const figure = await page.locator('[data-data-figure]').boundingBox(); const question = await page.locator('[data-figure-question] > div').boundingBox();
      expect(figure!.x + figure!.width).toBeLessThanOrEqual(question!.x);
    }
    await checkScreen(page, `training-figure-${names[item.position]}`);
    if (item.position < 2) {
      await page.locator('html').evaluate((el) => { el.setAttribute('data-text-size', 'large'); });
      await checkScreen(page, `training-figure-${names[item.position]}-large`);
      await page.locator('html').evaluate((el) => { el.removeAttribute('data-text-size'); });
    }
    if (item.position === 3) {
      const scroll = page.locator('[data-figure-scroll]');
      await scroll.focus(); await page.keyboard.press('ArrowRight');
      await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await expect(page.getByLabel('Вопрос 4 из 4', { exact: true })).toBeVisible();
      await scroll.evaluate((el) => { if (el instanceof HTMLElement) el.blur(); });
      await scroll.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await checkScreen(page, 'training-figure-table-wide-scrolled');
      // Крупный текст расширяет столбцы, и браузер иногда сдвигает прокрутку рамки вслед за ними (снимок
      // гейта 13.11.2026 ушёл на ~37 px). Снимаем на той же прокрутке, что до увеличения, когда вёрстка устоялась.
      const left = await scroll.evaluate((el) => el.scrollLeft);
      await page.locator('html').evaluate((el) => { el.setAttribute('data-text-size', 'large'); });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await scroll.evaluate((el, value) => { el.scrollLeft = value; }, left);
      await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBe(left);
      await checkScreen(page, 'training-figure-table-wide-large');
      return;
    }
    await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
    await checkScreen(page, `training-figure-${names[item.position]}-answer`);
    await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  }
}
