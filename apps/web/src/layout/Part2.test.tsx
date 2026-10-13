import { expect, test } from 'vitest';
import { apiError, fakeServer, json, renderApp, user } from '../test/app';
import { trainingOptions } from '../test/training';

const exams = { exams: [{ id: 'gre', sections: ['verbal', 'quant', 'essay'] }, { id: 'toefl', sections: ['reading', 'listening', 'writing', 'speaking'] }] };
const home = { lastTraining: null, sections: [{ section: 'verbal', total: 10, correct: 7 }], mistakes: 3,
  weakSpot: { section: 'verbal', questionType: 'text_completion', accuracy: 52 }, week: { days: 2, answers: 12, minutes: 18 } };

test('T1: главная получает статистику своего экзамена, «Сегодня» больше не запрашивается', async () => {
  const server = fakeServer({ 'GET /api/me': () => json(user({ activeExam: 'gre' })), 'GET /api/exams': () => json(exams),
    'GET /api/home': () => json(home), 'GET /api/trainings/options': () => json(trainingOptions()) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Тренировка' })).toBeVisible();
  await expect.element(screen.getByText('70 %')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: /Повторить мои ошибки/ })).toBeVisible();
  const request = server.requests.find((r) => new URL(r.url).pathname === '/api/home');
  expect(new URL(request!.url).searchParams.get('exam')).toBe('gre');
  expect(server.requests.some((r) => new URL(r.url).pathname === '/api/today')).toBe(false);
});

test('T3: новый аккаунт выбирает только экзамены сервера, выбор сохраняется', async () => {
  const server = fakeServer({ 'GET /api/me': () => json(user({ activeExam: null })), 'GET /api/exams': () => json(exams),
    'PUT /api/me/exam': () => json(user({ activeExam: 'toefl' })), 'GET /api/home': () => json({ ...home, sections: [], mistakes: 0, weakSpot: null, week: { days: 0, answers: 0, minutes: 0 } }),
    'GET /api/trainings/options': () => json({ ...trainingOptions(), types: [], presets: [] }) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('heading', { name: 'К какому экзамену готовитесь?' })).toBeVisible();
  await screen.getByRole('button', { name: /TOEFL/ }).click();
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Тренировка' })).toBeVisible();
  expect(await server.requests.find((r) => r.method === 'PUT')!.json()).toEqual({ exam: 'toefl' });
});

test('G2: неактивные строки и язык с откатом после отказа сервера', async () => {
  fakeServer({ 'GET /api/me': () => json(user({ activeExam: 'gre' })), 'GET /api/exams': () => json(exams),
    'PUT /api/me/locale': () => apiError(500, 'internal') });
  const { screen } = await renderApp({ path: '/settings' });
  for (const name of ['Подписка', 'Способы входа', 'Написать нам']) await expect.element(screen.getByRole('button', { name })).toBeDisabled();
  await screen.getByRole('button', { name: 'English', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Русский', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.element(screen.getByRole('alert')).toBeVisible();
});
