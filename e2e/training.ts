import type { Page } from '@playwright/test';
import { schemas } from '../packages/api-client/src';
import { checkScreen, expect } from './fixtures';
import { e2eSlot } from '../tools/dev/e2e-slot';

async function closeSession(page: Page) {
  // BackButton виден и в конструкторе: сначала ждём экран сессии, как прежде ждали его собственную ссылку.
  if (await page.getByRole('dialog', { name: 'Вопросы', exact: true }).count()) await page.getByRole('dialog', { name: 'Вопросы', exact: true }).getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Text Completion|Sentence Equivalence|Quantitative Comparison|Multiple Choice/);
  if (new URL(page.url()).pathname.startsWith('/tg/')) await page.locator('#tg-mock-back').click();
  else await page.getByRole('button', { name: 'Закрыть тренировку' }).click();
  const exit = page.getByRole('dialog', { name: 'Выйти из проверки?', exact: true });
  if (await exit.count()) await exit.getByRole('button', { name: 'Выйти', exact: true }).click();
}

export async function actionButtonsFit(page: Page) {
  await expect.poll(() => page.locator('footer button:visible').evaluateAll((buttons) => buttons.length > 0 && buttons.every((button) => {
    return button.scrollWidth <= button.clientWidth && button.getBoundingClientRect().height >= 54;
  }))).toBe(true);
}

export async function buildAndResume(page: Page) {
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  await expect(page.getByRole('heading', { name: 'Новая тренировка' })).toBeVisible();
  if (new URL(page.url()).pathname.startsWith('/tg/')) await expect(page.locator('#tg-mock-back')).toBeVisible();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: /Темы и сложность/ }).click();
  await expect(page.getByRole('heading', { name: 'Темы и сложность' })).toBeVisible();
  await page.getByRole('button', { name: 'Лёгкая', exact: true }).click();
  await page.getByRole('button', { name: /^Готово ·/ }).click();
  await page.getByRole('button', { name: /^(Начать ·|Начинаем…)/ }).click();
  await expect(page).toHaveURL(/\/training\/[0-9a-f-]{36}/);
  await expect(page.getByRole('heading', { name: /Text Completion|Sentence Equivalence/ })).toBeVisible();
  await closeSession(page);
  const resume = page.getByRole('link', { name: /Продолжить тренировку/ });
  await expect(resume).toContainText(/Вопрос\s1\sиз\s\d · Text Completion/);
  expect(await resume.textContent()).toMatch(/Вопрос\u00a01\u00a0из\u00a0\d/);
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  await expect(page.getByRole('button', { name: /^Тип/ })).toContainText('Text Completion');
  // В devseed одно лёгкое задание этого типа: последняя сборка хранит ограниченное доступностью число.
  await expect(page.getByRole('button', { name: /^(Начать ·|Начинаем…)/ })).toContainText('1\u00a0вопрос');
  if (new URL(page.url()).pathname.startsWith('/tg/')) await page.locator('#tg-mock-back').click();
  else await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(resume).toBeVisible();
  await page.reload();
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.getByRole('heading', { name: /Text Completion|Sentence Equivalence/ })).toBeVisible();
}

export async function presetMatchesForm(page: Page) {
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  await page.getByRole('button', { name: 'Проверка', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Вопросов', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Тип/ }).click();
  await page.getByRole('radio', { name: 'Все типы вперемешку', exact: true }).click();
  const posted = page.waitForRequest((req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/trainings');
  await page.getByRole('button', { name: /^(Начать ·|Начинаем…)/ }).click();
  expect(schemas.TrainingRequest.parse((await posted).postDataJSON())).toMatchObject({ exam: 'gre', section: 'verbal', count: 12, mode: 'check',
    questionTypes: ['text_completion', 'sentence_equivalence', 'multiple_choice', 'multiple_choice_multi', 'select_in_passage'] });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Text Completion|Sentence Equivalence|Multiple Choice|Multiple Answer|Select in Passage/);
}

export async function resumeCounterStaysTogether(page: Page) {
  // Граничный счётчик 10: у devseed только три задания типа. Ответы стенда проверяются договором до подмены.
  await page.route('**/api/trainings/options?*', async (route) => {
    const response = await route.fetch(); const options = schemas.TrainingOptions.parse(await response.json());
    await route.fulfill({ response, json: { ...options, types: options.types.map((type) => ({ ...type,
      topics: type.topics.map((topic) => ({ ...topic, available: { easy: 10, medium: 10, hard: 10 } })) })) } });
  });
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch(); const session = schemas.TrainingSession.parse(await response.json());
    const items = Array.from({ length: 10 }, (_, position) => ({ ...session.items[position % session.items.length], position }));
    await route.fulfill({ response, json: schemas.TrainingSession.parse({ ...session, items }) });
  });
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  await page.getByRole('button', { name: /^(Начать ·|Начинаем…)/ }).click();
  await closeSession(page);
  const resume = page.getByRole('link', { name: /Продолжить тренировку/ });
  await expect(resume).toContainText(/Вопрос\s1\sиз\s10/);
  const lines = await resume.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? ''; const start = text.indexOf('Вопрос');
      if (start < 0) continue;
      const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + 'Вопрос\u00a01\u00a0из\u00a010'.length);
      return range.getClientRects().length;
    }
    return 0;
  });
  expect(lines).toBe(1);
}

export async function unavailableStorageKeepsSession(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, 'open', { value: () => { throw new DOMException('fixture unavailable', 'SecurityError'); } });
  });
  await page.reload();
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  await expect(page.getByText('Нет места на устройстве', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Начать ·|Начинаем…)/ })).toBeDisabled();
  if (new URL(page.url()).pathname.startsWith('/tg/')) await page.locator('#tg-mock-back').click();
  else await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Настроить тренировку' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Начать', exact: true })).toBeDisabled();
  await page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Слова', exact: true }).click();
  await expect(page.getByText('Здесь будут слова: учить, повторять и искать.')).toBeVisible();
}

export async function offlineBuilder(page: Page) {
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  const start = page.getByRole('button', { name: /^(Начать ·|Начинаем…)/ });
  await expect(start).toBeEnabled();
  let attempts = 0;
  page.on('request', (req) => { if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/trainings') attempts++; });
  await page.context().setOffline(true);
  await expect(page.getByText('Нет сети — тренировку не начать. Попробуйте, когда она появится.')).toBeVisible();
  await expect(start).toBeDisabled();
  expect(attempts).toBe(0);
  await page.context().setOffline(false);
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByRole('heading', { name: /Text Completion|Sentence Equivalence/ })).toBeVisible();
}

export async function startSession(page: Page, mode: 'practice' | 'check' = 'practice', count = 3, section = 'Verbal', type = 'text_completion') {
  if (count < 5) await page.route('**/api/trainings/options?*', async (route) => {
    const response = await route.fetch(); const options = schemas.TrainingOptions.parse(await response.json());
    await route.fulfill({ response, json: { ...options,
      types: options.types.map((row) => row.questionType !== type ? row : { ...row, topics: row.topics.map((topic, index) => ({ ...topic, available: index === 0 ? (count === 3 ? { easy: 1, medium: 1, hard: 1 } : { easy: count, medium: 0, hard: 0 }) : { easy: 0, medium: 0, hard: 0 } })) }),
      presets: options.presets.map((preset) => preset.kind === 'timed' ? { ...preset, request: { ...preset.request, count } } : preset),
    } });
  }, { times: 1 });
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  await page.getByRole('button', { name: section, exact: true }).click();
  await page.getByRole('button', { name: 'Практика', exact: true }).click();
  await chooseTrainingType(page, type);
  await page.getByRole('button', { name: String(count <= 5 ? 5 : count <= 10 ? 10 : count <= 15 ? 15 : 20), exact: true }).click();
  await page.getByRole('button', { name: mode === 'check' ? 'Проверка' : 'Практика', exact: true }).click();
  const response = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/trainings');
  await page.getByRole('button', { name: /^(Начать ·|Начинаем…)/ }).click();
  const session = schemas.TrainingSession.parse(await (await response).json());
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Text Completion|Sentence Equivalence|Quantitative Comparison|Multiple Choice|Multiple Answer|Numeric Entry|Select in Passage/);
  return session;
}

export async function pick(page: Page, question: import('../packages/api-client/src').Question, wrong = false) {
  for (let index = 0; index < question.groups.length; index++) {
    const group = question.groups[index]!;
    const chosen = wrong && index === 0 ? [group.options.find((option) => !question.answer.includes(option.id))!.id, ...question.answer.filter((id) => group.options.some((option) => option.id === id)).slice(1)] : question.answer.filter((id) => group.options.some((option) => option.id === id));
    const container = page.getByRole(question.selectCount === 1 ? 'radiogroup' : 'group').nth(index);
    for (const id of chosen) {
      const option = container.getByRole(question.selectCount === 1 ? 'radio' : 'checkbox').nth(group.options.findIndex((option) => option.id === id));
      await expect(option).toBeEnabled();
      await option.click();
      await expect(option).toHaveAttribute('aria-checked', 'true');
    }
  }
}

export async function practiceThroughSummary(page: Page) {
  const session = await startSession(page);
  await pick(page, session.items[0]!.question);
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.getByText('Верно.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Дальше$/ }).click();
  await pick(page, session.items[1]!.question, true);
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.getByText('Неверно.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Почему не/ }).click();
  await expect(page.getByTestId('explanation-option')).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByText('Incorrect.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('explanation')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  await page.getByRole('button', { name: /^Дальше$/ }).click();
  await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await expect(page.getByTestId('explanation')).toBeVisible();
  await page.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect(page.getByRole('heading', { name: '1 из 3 верно' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Что повторить' })).toBeVisible();
  const request = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/trainings');
  await page.getByRole('button', { name: /^Повторить ·/ }).click();
  const repeated = schemas.TrainingRequest.parse((await request).postDataJSON());
  expect(repeated).toMatchObject({ exam: 'gre', mode: 'practice', section: 'verbal', count: 5 });
  expect(repeated.topicIds?.length).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Не знаю', exact: true })).toBeVisible();
}

export async function checkWithReturn(page: Page) {
  const session = await startSession(page, 'check');
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'Отметить, чтобы вернуться' }).click();
  await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
  await pick(page, session.items[1]!.question);
  await page.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await expect(page.getByText('Отвечено 1 из 3 · отмечено 1')).toBeVisible();
  await page.getByRole('button', { name: 'Вопрос 1, без ответа, отмечен', exact: true }).click();
  await pick(page, session.items[0]!.question);
  await page.getByRole('button', { name: 'Снять отметку' }).click();
  await page.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await page.getByRole('button', { name: 'Вопрос 3, без ответа', exact: true }).click();
  await page.getByRole('button', { name: 'К списку вопросов' }).click();
  await finishCheck(page);
  await expect(page.getByRole('heading', { name: '2 из 3 верно' })).toBeVisible();
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  await expect(page.getByRole('link', { name: /Продолжить тренировку/ })).toHaveCount(0);
}

export async function partialCheckAnswer(page: Page) {
  // Три случайных задания не гарантируют TC3; берём весь доступный набор этого типа.
  const session = await startSession(page, 'check', 50);
  const item = session.items.find(({ question }) => question.groups.length === 3);
  if (!item) throw new Error('fixture TC3 missing');
  await page.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await page.getByRole('button', { name: `Вопрос ${item.position + 1}, без ответа`, exact: true }).click();
  const first = page.getByRole('radiogroup').nth(0).getByRole('radio').nth(0);
  await first.click();
  await expect(first).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Отметить, чтобы вернуться' }).click();
  const incomplete = page.getByRole('button', { name: `Вопрос ${item.position + 1}, без ответа, отмечен`, exact: true });
  for (const reload of [false, true]) {
    if (reload) {
      await page.reload();
      await expect(first).toHaveAttribute('aria-checked', 'true');
    }
    await page.getByRole('button', { name: 'Вопросы', exact: true }).click();
    await expect(page.getByText(`Отвечено 0 из ${session.items.length} · отмечено 1`, { exact: true })).toBeVisible();
    await expect(incomplete).toHaveAttribute('data-answered', 'false');
    if (!reload) await incomplete.click();
  }
  await incomplete.click();
  await pick(page, item.question);
  await page.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await expect(page.getByText(`Отвечено 1 из ${session.items.length} · отмечено 1`, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Вопрос ${item.position + 1}, отвечен, отмечен`, exact: true })).toHaveAttribute('data-answered', 'true');
  await finishCheck(page);
  await expect(page.getByRole('heading', { name: `1 из ${session.items.length} верно` })).toBeVisible();
}

export async function timeRunsOut(page: Page, closed = false) {
  await page.clock.install();
  const session = await startSession(page, 'check');
  await pick(page, session.items[0]!.question, true);
  if (closed) await closeSession(page);
  await page.clock.fastForward((session.timeLimitSeconds! + 1) * 1000);
  if (closed) await page.goto((new URL(page.url()).pathname.startsWith('/tg') ? '/tg' : '') + '/training/' + session.id);
  await expect(page.getByRole('heading', { name: 'Время вышло', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect(page.getByRole('heading', { name: '0 из 3 верно' })).toBeVisible();
  await expect(page.getByText('Время вышло — неотвеченные не считаются ошибками темы.')).toBeVisible();
  await expect(page.getByText('Не успели: 2\u00a0вопроса.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Что повторить' })).toBeVisible();
  await expect(page.getByText('Проверка · Verbal · 5\u00a0минут из 5')).toBeVisible();
}

export async function reloadSession(page: Page) {
  const session = await startSession(page);
  await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await page.getByRole('button', { name: /^Дальше$/ }).click();
  await pick(page, session.items[1]!.question);
  await expect(page.getByRole('button', { name: 'Проверить', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel('Вопрос 2 из 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Проверить', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.getByText('Верно.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Верно.', { exact: true })).toBeVisible();
}

export async function offlineSession(page: Page, me: import('./fixtures').Me) {
  const session = await startSession(page);
  await page.context().setOffline(true);
  await pick(page, session.items[0]!.question);
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await page.getByRole('button', { name: /^Дальше$/ }).click();
  await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await page.getByRole('button', { name: /^Дальше$/ }).click();
  await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await page.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect(page.getByRole('heading', { name: '1 из 3 верно' })).toBeVisible();
  const before = schemas.TrainingSession.parse(await me.api('GET', '/trainings/' + session.id));
  expect(before.items.every((item) => !item.answer)).toBe(true);
  await page.context().setOffline(false);
  await expect.poll(async () => schemas.TrainingSession.parse(await me.api('GET', '/trainings/' + session.id)).items.filter((item) => item.answer).length).toBe(3);
  await expect.poll(async () => schemas.TrainingSession.parse(await me.api('GET', '/trainings/' + session.id)).finishedAt).toBeTruthy();
  const stored = schemas.TrainingSession.parse(await me.api('GET', '/trainings/' + session.id));
  expect(stored.items[0]!.answer?.optionIds).toEqual(session.items[0]!.question.answer);
  expect(stored.items[1]!.answer?.dontKnow).toBe(true);
}

export async function keyboardSession(page: Page) {
  const session = await startSession(page, 'check', 3, 'Quant', 'multiple_choice');
  const question = session.items[0]!.question;
  const index = question.groups[0]!.options.findIndex((option) => question.answer.includes(option.id));
  await page.getByRole('heading', { level: 1 }).focus();
  await page.keyboard.press(String.fromCharCode(65 + index));
  await expect(page.getByRole('radio').nth(index)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Вопрос 2 из 3', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Вопрос 1 из 3', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Вопрос 2 из 3', { exact: true })).toBeVisible();
}

/** Только эталоны вида: весь набор берём с сервера, порядок и количество фиксируем; поведение выше — без подмены тренировок. */
export async function stableTrainingScreens(page: Page, capture = true) {
  let blanks = 1;
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch();
    const session = schemas.TrainingSession.parse(await response.json());
    const sorted = session.items.toSorted((a, b) => a.question.id.localeCompare(b.question.id));
    const first = sorted.find((item) => item.question.groups.length === blanks) ?? sorted[0]!;
    const chosen = [first, ...sorted.filter((item) => item !== first)].slice(0, 3);
    await route.fulfill({ response, json: { ...session, items: chosen.map((item, position) => ({ ...item, position })), ...(session.mode === 'check' && { timeLimitSeconds: 270 }) } });
  });
  await page.route('**/api/trainings/*/answers', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/trainings/*/finish', (route) => route.fulfill({ status: 200, json: { correct: 0, total: 3, unanswered: 0, durationSeconds: 60, review: [] } }));
  await page.clock.setFixedTime(new Date());
  const session = await startSession(page, 'practice', 50);
  if (capture) {
    await checkScreen(page, 'training-b-question');
    await page.context().setOffline(true);
    await expect(page.getByText('Нет сети — ответы сохранятся и уйдут сами.')).toBeVisible();
    await checkScreen(page, 'training-b-offline');
    await page.context().setOffline(false);
  }
  await pick(page, session.items[0]!.question, true);
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await page.getByRole('button', { name: /^Почему не/ }).click();
  if (capture) await checkScreen(page, 'training-b-explanation');
  await page.getByRole('button', { name: /^Дальше$/ }).click();
  await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
  if (capture) await checkScreen(page, 'training-b-dont-know');
  await page.getByRole('button', { name: /^Дальше$/ }).click();
  if (capture) {
    await page.getByRole('button', { name: 'Предыдущий вопрос' }).click();
    await checkScreen(page, 'training-b-past');
    await page.getByRole('button', { name: 'К вопросу 3', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await page.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect(page.getByRole('heading', { name: '0 из 3 верно' })).toBeVisible();
  if (capture) await checkScreen(page, 'training-b-summary');
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  const check = await startSession(page, 'check', 50);
  await page.getByRole('button', { name: 'Отметить, чтобы вернуться' }).click();
  // Снимок нужен после сохранения отметки: иначе в эталон попадает временно неактивная кнопка.
  await expect(page.getByRole('button', { name: 'Снять отметку', exact: true })).toBeEnabled();
  if (capture) {
    await expect.poll(() => page.getByRole('button', { name: 'Вопросы', exact: true }).locator('..').evaluate((tools) => {
      const first = tools.firstElementChild!.getBoundingClientRect();
      const last = tools.lastElementChild!.getBoundingClientRect();
      const row = tools.getBoundingClientRect();
      return Math.abs(first.left - row.left) < 1 && Math.abs(last.right - row.right) < 1;
    }), { message: 'R14: «Вопросы» и «Вернуться» у разных краёв строки' }).toBe(true);
    await checkScreen(page, 'training-b-timed');
    if (new URL(page.url()).pathname.startsWith('/tg/')) await trainingBack(page);
    else await page.getByRole('button', { name: 'Закрыть тренировку', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Выйти из проверки?', exact: true })).toBeVisible();
    await checkScreen(page, 'training-b-exit');
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
  await pick(page, check.items[1]!.question);
  await page.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await expect(page.getByText('Отвечено 1 из 3 · отмечено 1')).toBeVisible();
  if (capture) await checkScreen(page, 'training-b-overview');
  if (capture) {
    await page.clock.setFixedTime(new Date(Date.now() + 271000));
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await expect(page.getByRole('heading', { name: 'Время вышло', exact: true })).toBeVisible();
    await checkScreen(page, 'training-b-timeout');
    await page.getByRole('button', { name: 'К итогу', exact: true }).click();
    await page.getByRole('button', { name: 'Готово', exact: true }).click();
  } else await closeSession(page);
  if (!capture) return session;
  for (const [type, section, count, name] of [
    ['text_completion', 'Verbal', 2, 'training-b-tc2'], ['text_completion', 'Verbal', 3, 'training-b-tc3'],
    ['sentence_equivalence', 'Verbal', 1, 'training-b-se'], ['quantitative_comparison', 'Quant', 1, 'training-b-qc'], ['multiple_choice', 'Quant', 1, 'training-b-mc'],
  ] as const) {
    blanks = count;
    const session = await startSession(page, 'practice', 50, section, type);
    await checkScreen(page, name);
    if (type === 'sentence_equivalence' || type === 'quantitative_comparison' || count === 3) {
      await pick(page, session.items[0]!.question);
      if (count === 3) await checkScreen(page, 'training-b-tc3-selected');
      await page.getByRole('button', { name: 'Проверить', exact: true }).click();
      await expect(page.getByText('Верно.', { exact: true })).toBeVisible();
      await checkScreen(page, `${name}-correct`);
    }
    await closeSession(page);
  }
  return session;
}

export async function trainingBack(page: Page) {
  if (new URL(page.url()).pathname.startsWith('/tg/')) {
    const native = page.locator('#tg-mock-back');
    await expect(native).toBeVisible();
    // Родная кнопка находится вне WebView. В подмене DOM её перекрывает верхний слой dialog.
    if (await page.locator('dialog[open]').count()) await native.dispatchEvent('click');
    else await native.click();
  }
  else if (new URL(page.url()).pathname.includes('/report/')) await page.getByRole('dialog').getByRole('button', { name: 'Назад', exact: true }).click();
  else if (/\/review\/\d+$/.test(new URL(page.url()).pathname)) await page.getByRole('button', { name: 'Закрыть тренировку', exact: true }).click();
  else await page.getByRole('link', { name: 'Назад', exact: true }).click();
}

export async function finishForReview(page: Page) {
  const session = await startSession(page, 'check');
  await pick(page, session.items[0]!.question, true);
  await expect(page.getByTestId('explanation')).toHaveCount(0);
  await page.getByRole('button', { name: /^Дальше$/ }).click();
  await pick(page, session.items[1]!.question);
  await page.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await finishCheck(page);
  await expect(page.getByRole('heading', { name: '1 из 3 верно' })).toBeVisible();
  return session;
}

export async function reviewAllAnswers(page: Page) {
  const session = await finishForReview(page);
  await page.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await expect(page.getByRole('heading', { name: 'Разбор проверки' })).toBeVisible();
  for (const name of ['Все · 3', 'Ошибки · 2']) {
    await expect.poll(() => page.getByRole('button', { name, exact: true }).evaluate((button) => {
      const range = document.createRange(); range.selectNodeContents(button); return range.getClientRects().length;
    })).toBe(1);
  }
  await expect(page.getByRole('link', { name: /Вопрос 2, верно/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Вопрос 3, без ответа/ })).toBeVisible();
  await page.getByRole('button', { name: 'Ошибки · 2' }).click();
  await expect(page.getByRole('link', { name: /Вопрос 2, верно/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Вопрос 1, неверно/ }).click();
  await expect(page.getByText('Ваш ответ', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Верный ответ', { exact: true }).first()).toBeVisible();
  if (!new URL(page.url()).pathname.startsWith('/tg/') && (page.viewportSize()?.width ?? 0) >= 900) {
    const prompt = await page.locator('section').filter({ has: page.locator('[lang="en"]') }).first().boundingBox();
    const explanation = await page.getByTestId('explanation').boundingBox();
    expect(prompt).not.toBeNull(); expect(explanation).not.toBeNull();
    expect(explanation!.x).toBeGreaterThan(prompt!.x + prompt!.width);
  }
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByTestId('explanation')).toContainText(session.items[0]!.question.explanation.solution.en.split('*').join(''));
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  await trainingBack(page);
  await page.getByRole('link', { name: /Вопрос 3, без ответа/ }).click();
  await expect(page.getByText('без ответа', { exact: true })).toBeVisible();
  await trainingBack(page); await trainingBack(page);
  await expect(page.getByRole('heading', { name: '1 из 3 верно' })).toBeVisible();
}

/** У API пока нет чтения жалоб. Проверяем запись только счётчиком своей базы e2e, без текста. */
export async function reportCount(me: import('./fixtures').Me, trainingId: string) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const current = schemas.User.parse(await me.api('GET', '/me'));
  const id = schemas.TrainingSession.shape.id.parse(trainingId);
  const query = `SELECT count(*) FROM question_reports WHERE user_id = '${current.id}' AND training_id = '${id}'`;
  const { stdout } = await promisify(execFile)('docker', ['compose', '--env-file', '/dev/null', '-p', 'greprep', 'exec', '-T', 'postgres', 'psql', '-U', 'greprep', '-d', e2eSlot().database, '-Atc', query]);
  return Number(stdout.trim());
}

export async function reportFromQuestionAndReview(page: Page, me: import('./fixtures').Me, offline = false) {
  const session = await startSession(page);
  if (offline) await page.context().setOffline(true);
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await expect(page.getByRole('button', { name: 'Отправить', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'В задании', exact: true }).click();
  // Только синтетический ввод: тело сообщения не читается и не печатается.
  await page.getByRole('textbox', { name: 'Что не так' }).fill('Synthetic e2e fixture');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Спасибо — проверим и поправим' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Text Completion/ })).toBeVisible();
  if (offline) {
    expect(await reportCount(me, session.id)).toBe(0);
    await page.context().setOffline(false);
  }
  await expect.poll(() => reportCount(me, session.id)).toBe(1);
  for (let index = 0; index < session.items.length; index++) {
    await page.getByRole('button', { name: 'Не знаю', exact: true }).click();
    await page.getByRole('button', { name: index < session.items.length - 1 ? /^Дальше$/ : 'К итогу', exact: true }).click();
  }
  await page.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await page.getByRole('link', { name: /Вопрос 2, без ответа/ }).click();
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await page.getByRole('button', { name: 'В разборе', exact: true }).click();
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Спасибо — проверим и поправим' })).toBeVisible();
  await expect.poll(() => reportCount(me, session.id)).toBe(2);
  await expect(page.getByRole('heading', { name: 'Вопрос 2', exact: true })).toBeVisible();
}


export async function stableReviewScreens(page: Page) {
  const session = await stableTrainingScreens(page, false);
  await page.goto((new URL(page.url()).pathname.startsWith('/tg/') ? '/tg' : '') + '/training/' + session.id);
  await page.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await expect(page.getByRole('heading', { name: 'Разбор тренировки' })).toBeVisible();
  await checkScreen(page, 'training-b-review');
  await page.getByRole('link', { name: /Вопрос 1, неверно/ }).click();
  await page.getByRole('button', { name: /^Почему не/ }).click();
  await checkScreen(page, 'training-b-review-item');
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await page.getByRole('button', { name: 'В разборе', exact: true }).click();
  await page.getByRole('textbox', { name: 'Что не так' }).fill('Проверьте, пожалуйста, разбор этого задания.');
  await checkScreen(page, 'training-b-report');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Спасибо — проверим и поправим' })).toBeVisible();
  await checkScreen(page, 'training-b-report-feedback');
  await expect(page.getByRole('heading', { name: 'Вопрос 1', exact: true })).toBeVisible();
}


export async function reportDraftAndLimit(page: Page) {
  await startSession(page);
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  const input = page.getByRole('textbox', { name: 'Что не так' });
  await page.getByRole('button', { name: 'В разборе', exact: true }).click();
  await input.fill('Synthetic draft');
  await expect(page.getByRole('status').filter({ hasText: 'Черновик сохранён' })).toHaveCount(1);
  await page.reload();
  await expect(input).toHaveValue('Synthetic draft');
  await expect(page.getByRole('button', { name: 'В разборе', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await input.fill('');
  await page.evaluate(() => {
    const source = document.createElement('textarea'); source.id = 'clipboard-fixture'; source.value = 'first\nsecond';
    (document.querySelector('dialog[open]') ?? document.body).append(source); source.focus(); source.select();
  });
  await page.keyboard.press('ControlOrMeta+c');
  await page.evaluate(() => { document.getElementById('clipboard-fixture')?.remove(); });
  await input.focus(); await page.keyboard.press('ControlOrMeta+v');
  await expect(input).toHaveValue('first\nsecond');
  await expect(page.locator('#report-truncated')).toHaveCount(0);
  await input.fill('a'.repeat(1800));
  await expect(page.getByText('1800 / 2000', { exact: true })).toBeVisible();
  // Настоящий буфер обмена и родная вставка: WebKit помечает её insertFromPaste.
  await page.evaluate(() => {
    const source = document.createElement('textarea'); source.id = 'clipboard-fixture'; source.value = 'b'.repeat(201);
    (document.querySelector('dialog[open]') ?? document.body).append(source); source.focus(); source.select();
  });
  await page.keyboard.press('ControlOrMeta+c');
  await page.evaluate(() => { document.getElementById('clipboard-fixture')?.remove(); });
  await input.focus();
  await input.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('fixture textarea missing');
    element.setSelectionRange(10, 10);
  });
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('#report-truncated')).toContainText('Вставка сокращена');
  await expect.poll(() => input.evaluate((element) => element instanceof HTMLTextAreaElement ? element.selectionStart : null)).toBe(210);
  await expect(input).toHaveValue('a'.repeat(10) + 'b'.repeat(200) + 'a'.repeat(1790));
  await page.keyboard.press('ControlOrMeta+z');
  await expect(input).toHaveValue('a'.repeat(1800));
  await expect(page.locator('#report-truncated')).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(input).toHaveValue('a'.repeat(10) + 'b'.repeat(200) + 'a'.repeat(1790));
  // Полностью отклонённая родная вставка не даёт input, но paste всё равно показывает предупреждение.
  await page.keyboard.press('ControlOrMeta+v');
  await expect(input).toHaveValue('a'.repeat(10) + 'b'.repeat(200) + 'a'.repeat(1790));
  await expect(page.locator('#report-truncated')).toContainText('Вставка сокращена');
  await page.keyboard.press('x');
  await expect(page.locator('#report-truncated')).toHaveCount(0);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Backspace');
  await expect(page.getByText('1999 / 2000', { exact: true })).toBeVisible();
  await trainingBack(page);
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await expect(input).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Отправить', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Другое', exact: true }).click();
  await input.fill('Synthetic queued draft');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Спасибо — проверим и поправим' })).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await expect(input).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Отправить', exact: true })).toBeDisabled();
}

export async function continuousReportSwipes(page: Page) {
  // Запоминаем каждое восстановление, даже если следующий экран сразу снова выключит свайп.
  await page.evaluate(() => {
    const remove = Storage.prototype.removeItem;
    document.documentElement.dataset.swipeRestores = '0';
    Storage.prototype.removeItem = function (key) {
      if (this === sessionStorage && key === 'greprep.training.swipes') {
        document.documentElement.dataset.swipeRestores = String(Number(document.documentElement.dataset.swipeRestores) + 1);
      }
      return remove.call(this, key);
    };
  });
  const restores = () => page.evaluate(() => Number(document.documentElement.dataset.swipeRestores));
  await startSession(page);
  expect(await restores()).toBe(0);
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await page.getByRole('textbox', { name: 'Что не так' }).fill('Synthetic draft');
  expect(await restores()).toBe(0);
  await trainingBack(page);
  await expect(page.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  expect(await restores()).toBe(0);
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await expect(page.getByRole('textbox', { name: 'Что не так' })).toHaveValue('');
  await page.getByRole('button', { name: 'Другое', exact: true }).click();
  await page.getByRole('textbox', { name: 'Что не так' }).fill('Synthetic report');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Спасибо — проверим и поправим' })).toBeVisible();
  expect(await restores()).toBe(0);
  await closeSession(page);
  await expect(page.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
  await expect.poll(restores).toBe(1);
}


export async function reportBackStorageFailure(page: Page) {
  await startSession(page);
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await page.getByRole('textbox', { name: 'Что не так' }).fill('Synthetic private draft');
  await expect(page.getByRole('status').filter({ hasText: 'Черновик сохранён' })).toHaveCount(1);
  let reported: unknown;
  await page.route('**/api/client-errors', async (route) => { reported = route.request().postDataJSON(); await route.fulfill({ status: 204 }); });
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (this === localStorage && key.includes('/report-draft/')) throw new DOMException('Synthetic private draft', 'SecurityError');
      return original.call(this, key);
    };
  });
  await trainingBack(page);
  await expect(page.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  await expect.poll(() => reported).toMatchObject({ message: 'Error: training report draft storage unavailable' });
  expect(JSON.stringify(reported)).not.toContain('Synthetic private draft');
}


export async function reportDraftWritesAndQuota(page: Page) {
  await startSession(page);
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await page.getByRole('button', { name: 'Другое', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Что не так' });
  await page.evaluate(() => {
    const element = document.getElementById('report-text');
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('fixture textarea missing');
    const put = Storage.prototype.setItem; let writes = 0;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key.includes('/report-draft/')) element.dataset.draftWrites = String(++writes);
      return put.call(this, key, value);
    };
  });
  await input.pressSequentially('a'.repeat(200), { timeout: 30_000 });
  await expect(page.getByText('200 / 2000', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Черновик сохранён' })).toHaveCount(1);
  const writes = await input.evaluate((element) => element instanceof HTMLTextAreaElement ? Number(element.dataset.draftWrites) : NaN);
  expect(writes).toBe(200);
  const reported: unknown[] = [];
  await page.route('**/api/client-errors', async (route) => { reported.push(route.request().postDataJSON()); await route.fulfill({ status: 204 }); });
  await page.evaluate(() => {
    const put = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key.includes('/report-draft/')) throw new DOMException('Synthetic private draft', 'QuotaExceededError');
      return put.call(this, key, value);
    };
  });
  for (const text of ['Synthetic first', 'Synthetic last']) {
    await input.fill(text);
    await expect(input).toHaveValue(text);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Черновик не сохранён на устройстве' })).toHaveCount(1);
  }
  await page.getByRole('button', { name: 'В разборе', exact: true }).click();
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Спасибо — проверим и поправим' })).toBeVisible();
  await expect.poll(() => reported.length).toBe(1);
  expect(reported[0]).toMatchObject({ message: 'Error: training report draft storage unavailable' });
  expect(JSON.stringify(reported)).not.toContain('Synthetic private draft');
}

export async function chooseTrainingType(page: Page, type: string) {
  const labels: Record<string, string> = { text_completion: 'Text Completion', sentence_equivalence: 'Sentence Equivalence', quantitative_comparison: 'Quantitative Comparison', multiple_choice: 'Multiple Choice', multiple_choice_multi: 'Multiple Answer', numeric_entry: 'Numeric Entry', select_in_passage: 'Select in Passage' };
  await page.getByRole('button', { name: /^Тип/ }).click();
  await page.getByRole('radio', { name: labels[type], exact: true }).click();
}
export async function finishCheck(page: Page) {
  await page.getByRole('button', { name: 'Завершить проверку', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: /^Без ответа:/ });
  if (await confirmation.count()) await confirmation.getByRole('button', { name: 'Завершить проверку', exact: true }).click();
}

export async function stableCheckReviewScreens(page: Page) {
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch();
    const session = schemas.TrainingSession.parse(await response.json());
    await route.fulfill({ response, json: { ...session, timeLimitSeconds: 315, items: session.items.toSorted((a, b) => a.question.id.localeCompare(b.question.id)).slice(0, 3).map((item, position) => ({ ...item, position })) } });
  });
  await page.route('**/api/trainings/*/answers', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/trainings/*/finish', (route) => route.fulfill({ status: 200, json: { correct: 1, total: 3, unanswered: 1, durationSeconds: 115, review: [] } }));
  const now = new Date();
  await page.clock.setFixedTime(now);
  const session = await startSession(page, 'check', 50, 'Quant', 'quantitative_comparison');
  await page.clock.setFixedTime(new Date(now.getTime() + 100000));
  await pick(page, session.items[0]!.question, true);
  await page.getByRole('button', { name: 'Отметить, чтобы вернуться' }).click();
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await page.clock.setFixedTime(new Date(now.getTime() + 115000));
  await pick(page, session.items[1]!.question);
  await page.getByRole('button', { name: 'Отметить, чтобы вернуться' }).click();
  await page.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await finishCheck(page);
  await page.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await checkScreen(page, 'training-b-review-check');
  await page.getByRole('button', { name: 'Отмеченные · 2', exact: true }).click();
  await checkScreen(page, 'training-b-review-flagged');
  await page.getByRole('link', { name: /^Вопрос 1,/ }).click();
  await page.getByRole('button', { name: /^Почему не/ }).click();
  await checkScreen(page, 'training-b-review-qc');
  await page.getByRole('button', { name: 'Следующий', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Вопрос 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect(page.getByRole('heading', { name: '1 из 3 верно', exact: true })).toBeVisible();
}
