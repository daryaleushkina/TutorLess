import { onlineManager } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';
import { apiError, fakeServer, json, renderApp, HOME, user } from '../../test/app';
import { trainingRepository } from '../../training/repository';
import { trainingOptions, trainingSession } from '../../test/training';

const signedIn = { 'GET /api/me': () => json(user({ activeExam: 'gre' })) };

test('главная: первая тренировка и только разделы из options', async () => {
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Тренировка', exact: true })).toBeVisible();
  await expect.element(screen.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.', { exact: true })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: /^Verbal/ })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: /^Quant/ })).toBeVisible();
  expect(screen.getByRole('link', { name: /^Эссе/ }).elements()).toHaveLength(0);
  expect(screen.getByText('Повторить мои ошибки').elements()).toHaveLength(0);
});

test('«Начать» отправляет доступный набор, сессия — без вкладок', async () => {
  const server = fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()),
    'POST /api/trainings': () => json(trainingSession()) });
  const { screen } = await renderApp({ path: '/' });
  await screen.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect.element(screen.getByRole('link', { name: 'Закрыть тренировку' })).toBeVisible();
  expect(screen.getByRole('navigation', { name: 'Разделы' }).elements()).toHaveLength(0);
  expect(await server.requests.find((r) => r.method === 'POST' && new URL(r.url).pathname === '/api/trainings')?.json())
    .toEqual({ exam: 'gre', section: 'verbal', questionTypes: ['text_completion'], count: 10, mode: 'practice' });
});

test('ошибка загрузки, повтор и устаревшие данные', async () => {
  let fail = true;
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => fail ? apiError(500, 'internal') : json(trainingOptions()) });
  const { screen, queryClient } = await renderApp({ path: '/' });
  await expect.element(screen.getByText('Не получилось загрузить тренировку')).toBeVisible();
  fail = false;
  await screen.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect.element(screen.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.', { exact: true })).toBeVisible();
  fail = true;
  await queryClient.refetchQueries({ queryKey: ['training-options'] });
  await expect.element(screen.getByText('Не получилось обновить — покажем свежее, как только сервер ответит.')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Начать', exact: true })).toBeVisible();
});

test('нет сети при загрузке, восстановление и запрет нового старта без сети', async () => {
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()) });
  onlineManager.setOnline(false);
  const { screen, router } = await renderApp({ path: '/' });
  await expect.element(screen.getByText('Тренировка загрузится, когда сеть вернётся.')).toBeVisible();
  onlineManager.setOnline(true);
  await expect.element(screen.getByRole('button', { name: 'Начать', exact: true })).toBeVisible();
  onlineManager.setOnline(false);
  await screen.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect.element(screen.getByText('Чтобы начать, нужна сеть: задания скачаются целиком, и дальше можно без неё.')).toBeVisible();
  expect(router.state.location.pathname).toBe('/');
});

test('недоступные вопросы: нет кнопки старта и выдуманных разделов', async () => {
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions({ types: [], presets: [] })) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByText('Пока нет доступных заданий')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Начать', exact: true }).elements()).toHaveLength(0);
});


test.each(['practice', 'check'] as const)('прошлый набор: режим %s и настройка этого набора', async (mode) => {
  const options = trainingOptions();
  options.presets.unshift({ kind: 'last', request: { exam: 'gre', section: 'quant', questionTypes: ['multiple_choice'], count: 3, mode } });
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(options), 'GET /api/home': () => json({ ...HOME, lastTraining: { request: options.presets[0]!.request, size: 3 } }) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('heading', { name: 'Multiple Choice', exact: true })).toBeVisible();
  await expect.element(screen.getByText('Как в прошлый раз', { exact: true })).toBeVisible();
  await screen.getByRole('link', { name: 'Настроить тренировку' }).click();
  await expect.element(screen.getByRole('radio', { name: 'Как в прошлый раз' })).toBeChecked();
  await expect.element(screen.getByRole('textbox', { name: 'Вопросов' })).toHaveValue('3');
});

test('первый доступный раздел Quant открывает соответствующий конструктор', async () => {
  const options = trainingOptions(); options.types = options.types.filter((type) => type.section === 'quant');
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(options) });
  const { screen, router } = await renderApp({ path: '/' });
  await screen.getByRole('link', { name: 'Настроить тренировку' }).click();
  await expect.poll(() => router.state.location.search).toEqual({ section: 'quant', type: 'quantitative_comparison' });
});

test.each([
  ['server', 'Не получилось начать тренировку. Попробуйте ещё раз.'],
  ['empty', 'Под этот выбор заданий пока нет — попробуйте другие темы или сложность.'],
  ['network', 'Чтобы начать, нужна сеть: задания скачаются целиком, и дальше можно без неё.'],
] as const)('отказ старта %s: экран остаётся, повтор доступен', async (failure, message) => {
  let fail = true;
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()),
    'POST /api/trainings': () => {
      if (!fail) return json(trainingSession());
      if (failure === 'network') throw new TypeError('Failed to fetch');
      return apiError(failure === 'empty' ? 409 : 500, failure === 'empty' ? 'no_questions' : 'internal');
    } });
  const { screen, router } = await renderApp({ path: '/' });
  await screen.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect.element(screen.getByRole('alert')).toHaveTextContent(message);
  expect(router.state.location.pathname).toBe('/');
  fail = false;
  await screen.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect.element(screen.getByRole('link', { name: 'Закрыть тренировку' })).toBeVisible();
});

test('запрос старта в пути не отправляется дважды', async () => {
  let release = (_response: Response) => {};
  const pending = new Promise<Response>((resolve) => { release = resolve; });
  const server = fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => pending });
  const { screen } = await renderApp({ path: '/' });
  const start = screen.getByRole('button', { name: 'Начать', exact: true });
  await expect.element(start).toBeEnabled();
  start.element().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  start.element().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await expect.element(screen.getByRole('button', { name: 'Начинаем…' })).toBeDisabled();
  expect(server.requests.filter((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/trainings')).toHaveLength(1);
  release(json(trainingSession()));
  await expect.element(screen.getByRole('link', { name: 'Закрыть тренировку' })).toBeVisible();
});

test('ошибка хранилища объясняет недоступность старта', async () => {
  vi.spyOn(trainingRepository, 'storageStatus').mockReturnValue('unavailable');
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('button', { name: 'Начать', exact: true })).toBeDisabled();
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Не получилось сохранить тренировку на устройстве. Освободите место и попробуйте снова.');
});

test('объяснение «нужна сеть» исчезает при возвращении сети', async () => {
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('button', { name: 'Начать', exact: true })).toBeVisible();
  onlineManager.setOnline(false);
  await screen.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect.element(screen.getByRole('alert')).toBeVisible();
  onlineManager.setOnline(true);
  await expect.poll(() => screen.getByRole('alert').elements().length).toBe(0);
});

test('TOEFL: до ответа каталога скелет содержит четыре строки, после ответа пустые разделы', async () => {
  let release = (_response: Response) => {};
  const pending = new Promise<Response>((resolve) => { release = resolve; });
  fakeServer({ 'GET /api/me': () => json(user({ activeExam: 'toefl' })), 'GET /api/exams': () => pending, 'GET /api/trainings/options': () => json(trainingOptions({ types: [] })) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('heading', { name: 'Разделы', level: 2 })).toBeVisible();
  await expect.element(screen.getByRole('status').filter({ hasText: 'Загружаем тренировку' })).toBeInTheDocument();
  expect(screen.getByRole('status').filter({ hasText: 'Загружаем тренировку' }).element().parentElement?.querySelector('ul[aria-hidden="true"]')?.children).toHaveLength(4);
  release(json({ exams: [{ id: 'toefl', sections: ['reading', 'listening', 'writing', 'speaking'] }] }));
  await expect.element(screen.getByText('Здесь будут тренировки по четырём частям TOEFL.')).toBeVisible();
});
