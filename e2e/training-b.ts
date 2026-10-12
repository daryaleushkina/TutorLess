import { schemas, type QuestionReport } from '../packages/api-client/src';
import type { Page } from '@playwright/test';
import { expect, type Me } from './fixtures';
import { startSession, pick, trainingBack, reportCount } from './training';
import { checkScreen } from './fixtures';

export async function practiceBackB(page: Page) {
  const session = await startSession(page);
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
  await pick(page, session.items[1]!.question);
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await page.getByRole('button', { name: 'Предыдущий вопрос' }).click();
  await page.getByRole('button', { name: 'Все варианты', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Свернуть варианты', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Предыдущий вопрос' }).click();
  await expect(page.getByRole('button', { name: 'Все варианты', exact: true })).toBeVisible();
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
  const catalogResponse = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/trainings/options' && r.request().method() === 'GET');
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  const catalog = schemas.TrainingOptions.parse(await (await catalogResponse).json());
  const type = catalog.types.find((t) => t.questionType === 'quantitative_comparison')!;
  const availableCount = type.topics.reduce((sum, t) => sum + t.available.easy + t.available.medium + t.available.hard, 0);
  const count = Math.min(12, availableCount);
  const minutes = Math.ceil(count * type.paceSeconds / 60);
  await page.getByRole('button', { name: 'Quant', exact: true }).click();
  await page.getByRole('group', { name: 'Вопросов', exact: true }).getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: 'Проверка', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Вопросов', exact: true })).toHaveCount(0);
  await expect(page.getByText(new RegExp(`На время, как на экзамене: ${minutes} мин на ${count}\\s+вопрос`))).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^Начать · ${count}\\s+вопрос.*~${minutes}\\s+мин$`) })).toBeVisible();
  const answer = page.waitForResponse((response) => response.url().endsWith('/api/trainings') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /^Начать ·/ }).click();
  const response = await answer;
  expect(response.request().postDataJSON()).toMatchObject({ section: 'quant', count: 12, mode: 'check' });
  const actual = schemas.TrainingSession.parse(await response.json());
  expect(actual.items).toHaveLength(count);
  expect(actual.timeLimitSeconds).toBeLessThanOrEqual(minutes * 60);
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

export async function exitCheckB(page: Page) {
  await page.clock.install();
  const session = await startSession(page, 'check');
  await pick(page, session.items[0]!.question);
  const remaining = async () => {
    const [minutes, seconds] = (await page.getByRole('timer').innerText()).split(':').map(Number);
    return minutes! * 60 + seconds!;
  };
  await closeCheckB(page);
  const exit = page.getByRole('dialog', { name: 'Выйти из проверки?', exact: true });
  await expect(exit.getByText('Ответы сохранятся, время продолжит идти', { exact: true })).toBeVisible();
  await page.clock.fastForward(15000);
  await exit.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect.poll(remaining).toBeLessThanOrEqual(session.timeLimitSeconds! - 15);
  expect(await remaining()).toBeGreaterThan(session.timeLimitSeconds! - 30);
  await closeCheckB(page); await exit.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Тренировка', exact: true })).toBeVisible();
  await page.clock.fastForward(20000);
  await page.getByRole('link', { name: /Продолжить тренировку/ }).click();
  await expect.poll(remaining).toBeLessThanOrEqual(session.timeLimitSeconds! - 35);
  expect(await remaining()).toBeGreaterThan(session.timeLimitSeconds! - 50);
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(session.items[0]!.question.groups.length);
}

export async function timeoutOverlayB(page: Page, overlay: 'overview' | 'exit') {
  await page.clock.install();
  const session = await startSession(page, 'check');
  if (overlay === 'overview') await page.getByRole('button', { name: 'Вопросы', exact: true }).click();
  else await closeCheckB(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.fastForward((session.timeLimitSeconds! + 1) * 1000);
  await expect(page.getByRole('heading', { name: 'Время вышло', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (new URL(page.url()).pathname.startsWith('/tg/')) {
    await expect(page.locator('#tg-mock-back')).toBeVisible();
    await page.locator('#tg-mock-back').click();
    await expect(page.getByRole('heading', { name: 'Тренировка', exact: true })).toBeVisible();
  } else await page.getByRole('button', { name: 'К итогу', exact: true }).click();
}

export async function missingReportB(page: Page) {
  const url = new URL(page.url());
  const prefix = url.pathname.startsWith('/tg/') ? '/tg' : '';
  url.pathname = `${prefix}/training/00000000-0000-4000-8000-000000009999/report/0`;
  url.searchParams.set('language', 'invalid'); url.searchParams.set('filter', 'invalid');
  await page.goto(url.toString());
  await expect(page.getByRole('heading', { name: 'Тренировки нет на устройстве', exact: true })).toBeVisible();
  if (prefix === '/tg') await trainingBack(page);
  else await page.getByRole('link', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/training\/00000000-0000-4000-8000-000000009999(?:\?|$)/);
}

async function closeCheckB(page: Page) {
  if (new URL(page.url()).pathname.startsWith('/tg/')) await trainingBack(page);
  else await page.getByRole('button', { name: 'Закрыть тренировку', exact: true }).click();
}

export async function reportRetryB(page: Page, me: Me, horizontalInsets = false) {
  const session = await startSession(page, 'practice');
  if (horizontalInsets) await page.evaluate(() => {
    document.documentElement.style.setProperty('--tg-viewport-safe-area-inset-left', '24px');
    document.documentElement.style.setProperty('--tg-viewport-content-safe-area-inset-left', '16px');
    document.documentElement.style.setProperty('--tg-viewport-safe-area-inset-right', '12px');
    document.documentElement.style.setProperty('--tg-viewport-content-safe-area-inset-right', '16px');
  });
  const insideInsets = async (locator: ReturnType<Page['locator']>) => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(40);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 28);
  };
  const bodies: QuestionReport[] = [];
  const statuses: number[] = [];
  await page.route('**/api/questions/*/reports', async (route) => {
    bodies.push(schemas.QuestionReport.parse(route.request().postDataJSON()));
    const response = await route.fetch(); statuses.push(response.status());
    if (bodies.length === 1) await route.abort('failed');
    else await route.fulfill({ response });
  });
  await page.getByRole('link', { name: 'Сообщить об ошибке', exact: true }).click();
  await page.getByRole('button', { name: 'Другое', exact: true }).click();
  await page.getByRole('textbox', { name: 'Что не так' }).fill('Synthetic retry report');
  if (horizontalInsets) {
    await insideInsets(page.getByRole('textbox', { name: 'Что не так' }));
    await insideInsets(page.getByRole('button', { name: 'Отправить', exact: true }));
  }
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(page.getByText('Спасибо — проверим и поправим', { exact: true })).toBeVisible();
  if (horizontalInsets) await insideInsets(page.getByText('Спасибо — проверим и поправим', { exact: true }));
  await expect.poll(() => statuses).toEqual([204]);
  await expect.poll(() => reportCount(me, session.id)).toBe(1);
  await page.context().setOffline(true); await page.context().setOffline(false);
  await expect.poll(() => statuses).toEqual([204, 204]);
  expect(bodies).toHaveLength(2);
  expect(bodies[0]!.reportId).toMatch(/^[0-9a-f-]{36}$/);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[1]!.trainingId).toBe(session.id);
  await expect.poll(() => reportCount(me, session.id)).toBe(1);
}
