import { expect, test } from 'vitest';
import { apiError, fakeServer, HOME, json, renderApp, user } from '../../test/app';
import { trainingOptions, trainingSession } from '../../test/training';

const history = { ...HOME, mistakes: 3, weakSpot: { section: 'quant' as const, questionType: 'multiple_choice' as const, accuracy: 52 }, week: { days: 4, answers: 86, minutes: 130 }, sections: [{ section: 'quant' as const, total: 50, correct: 37 }] };

test('T1: слабое место открывает свой тип; статистика и неделя принадлежат экзамену', async () => {
  fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/home': () => json(history), 'GET /api/trainings/options': () => json(trainingOptions()) });
  const { screen, router } = await renderApp({ path: '/' });
  await expect.element(screen.getByText('74 %')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: /Слабое место/ })).toBeVisible();
  await screen.getByRole('link', { name: /Слабое место/ }).click();
  await expect.poll(() => router.state.location.search).toEqual({ section: 'quant', type: 'multiple_choice' });
});

test('повтор своих ошибок отправляет source mistakes и ограниченный размер; только неделя тоже видна', async () => {
  const server = fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/home': () => json({ ...history, weakSpot: null }), 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(trainingSession()) });
  const { screen } = await renderApp({ path: '/' });
  await screen.getByRole('button', { name: /Повторить мои ошибки/ }).click();
  await expect.element(screen.getByRole('button', { name: 'Закрыть тренировку' })).toBeVisible();
  expect(await server.requests.find((request) => request.method === 'POST')!.json()).toMatchObject({ exam: 'gre', source: 'mistakes', count: 3, mode: 'practice' });
});

test.each([
  { mistakes: 0, weakSpot: null, week: history.week },
  { mistakes: 0, weakSpot: { section: 'verbal' as const, questionType: 'text_completion' as const, accuracy: 60 }, week: HOME.week },
])('блоки без данных не появляются, показан только доступный показатель', async (stats) => {
  fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/home': () => json({ ...HOME, ...stats }), 'GET /api/trainings/options': () => json(trainingOptions()) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('button', { name: 'Начать', exact: true })).toBeVisible();
  expect(screen.getByRole('button', { name: /Повторить мои ошибки/ }).elements()).toHaveLength(0);
});

test('TOEFL с поддержанным типом в Reading: активна только строка с заданиями', async () => {
  const options = trainingOptions();
  options.types = [{ ...options.types[0]!, section: 'reading' }];
  fakeServer({ 'GET /api/me': () => json(user({ activeExam: 'toefl' })), 'GET /api/home': () => json(HOME), 'GET /api/trainings/options': () => json(options) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('link', { name: /^Reading/ })).toBeVisible();
  expect(screen.getByRole('link', { name: /^Listening/ }).elements()).toHaveLength(0);
});

test('T5-offline: аккаунт известен, но загрузить главную не получилось из-за сети; повтор восстанавливает', async () => {
  let fail = true;
  fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/trainings/options': () => { if (fail) throw new TypeError('network'); return json(trainingOptions()); } });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByText('Тренировка загрузится, когда сеть вернётся.')).toBeVisible();
  fail = false;
  await screen.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect.element(screen.getByRole('button', { name: 'Начать', exact: true })).toBeVisible();
});

test('вкладка экзамена TOEFL показывает собственную строку', async () => {
  fakeServer({ 'GET /api/me': () => json(user({ activeExam: 'toefl' })) });
  const { screen } = await renderApp({ path: '/exam' });
  await expect.element(screen.getByText('Здесь будут пробные экзамены TOEFL с оценкой Writing и Speaking.')).toBeVisible();
});

test('свои ошибки только в Quant: пустой Verbal не мешает начать повторение', async () => {
  const { schemas } = await import('@greprep/api-client');
  const server = fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/home': () => json({ ...HOME, mistakes: 3 }), 'GET /api/trainings/options': () => json(trainingOptions()),
    'POST /api/trainings': async (req) => schemas.TrainingRequest.parse(await req.json()).section === 'quant' ? json(trainingSession()) : apiError(409, 'no_questions') });
  const { screen } = await renderApp({ path: '/' });
  await screen.getByRole('button', { name: /Повторить мои ошибки/ }).click();
  await expect.element(screen.getByRole('button', { name: 'Закрыть тренировку' })).toBeVisible();
  const posted = server.requests.filter((request) => request.method === 'POST');
  expect(await posted.at(-1)!.json()).toMatchObject({ source: 'mistakes', section: 'quant' });
});
