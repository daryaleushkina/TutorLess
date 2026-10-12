import { onlineManager } from '@tanstack/react-query';
import { page } from 'vitest/browser';
import { expect, test, vi } from 'vitest';
import { apiError, EXAMS, fakeServer, json, renderApp, user } from '../../test/app';
import { trainingOptions } from '../../test/training';

const boot = { 'GET /api/me': () => json(user()), 'GET /api/trainings/options': () => json(trainingOptions()) };
const fresh = { 'GET /api/me': () => json(user({ activeExam: null })) };

test('T3: сохраняем один выбор, второй не нажимается, серверный отказ можно повторить', async () => {
  let resolve = (_response: Response) => {};
  const held = new Promise<Response>((done) => { resolve = done; });
  let fail = true;
  const server = fakeServer({ ...fresh, 'PUT /api/me/exam': () => fail ? held : json(user({ activeExam: 'toefl' })), 'GET /api/trainings/options': () => json(trainingOptions({ types: [] })) });
  const { screen } = await renderApp({ path: '/' });
  const gre = screen.getByRole('button', { name: /^GRE/ });
  await gre.click();
  await expect.element(gre).toHaveAttribute('aria-busy', 'true');
  await expect.element(screen.getByRole('button', { name: /^TOEFL/ })).toBeDisabled();
  gre.element().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(server.requests.filter((req) => req.method === 'PUT')).toHaveLength(1);
  resolve(apiError(500, 'internal'));
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Не получилось сохранить выбор. Попробуйте ещё раз.');
  fail = false;
  await screen.getByRole('button', { name: /^TOEFL/ }).click();
  await expect.element(screen.getByText('Здесь будут тренировки по четырём частям TOEFL.')).toBeVisible();
});

test('T3: нет сети после загрузки каталога, сетевой отказ, затем повтор', async () => {
  fakeServer({ ...fresh, 'PUT /api/me/exam': () => { throw new TypeError('offline'); } });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('button', { name: /^GRE/ })).toBeVisible();
  onlineManager.setOnline(false);
  await screen.getByRole('button', { name: /^GRE/ }).click();
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Нет сети — выбрать экзамен получится, когда она вернётся.');
  onlineManager.setOnline(true);
  await screen.getByRole('button', { name: /^GRE/ }).click();
  await expect.element(screen.getByRole('button', { name: /^GRE/ })).toBeEnabled();
});

test('T3: каталог не загрузился, повтор получает экзамены сервера', async () => {
  let fail = true;
  fakeServer({ ...fresh, 'GET /api/exams': () => fail ? apiError(500, 'internal') : json(EXAMS) });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('alert')).toBeVisible();
  fail = false;
  await screen.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect.element(screen.getByRole('button', { name: /^GRE/ })).toBeVisible();
});

test('T7: ошибка смены оставляет окно открытым, выбранный экзамен закрывает его', async () => {
  fakeServer({ ...boot, 'PUT /api/me/exam': () => apiError(500, 'internal') });
  const { screen } = await renderApp({ path: '/' });
  await screen.getByRole('button', { name: 'Экзамен: GRE, сменить' }).click();
  const dialog = screen.getByRole('dialog', { name: 'Экзамен' });
  await dialog.getByRole('button', { name: /TOEFL/ }).click();
  await expect.element(dialog.getByRole('alert')).toHaveTextContent('Не получилось сменить экзамен. Попробуйте ещё раз.');
  await dialog.getByRole('button', { name: /GRE/ }).click();
  await expect.element(dialog).not.toBeInTheDocument();
});

test('T7: сохраняет экзамен, закрывается по Escape и клику мимо на компьютере', async () => {
  await page.viewport(1280, 800);
  try {
    const server = fakeServer({ ...boot, 'PUT /api/me/exam': () => json(user({ activeExam: 'toefl' })) });
    const { screen } = await renderApp({ path: '/' });
    await screen.getByRole('button', { name: 'Экзамен: GRE, сменить' }).click();
    await screen.getByRole('dialog').getByRole('button', { name: /TOEFL/ }).click();
    await expect.element(screen.getByRole('button', { name: 'Экзамен: TOEFL, сменить' })).toBeVisible();
    expect(await server.requests.find((req) => req.method === 'PUT')!.json()).toEqual({ exam: 'toefl' });
    await screen.getByRole('button', { name: 'Экзамен: TOEFL, сменить' }).click();
    await screen.getByRole('heading', { level: 1, name: 'Тренировка' }).click();
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await screen.getByRole('button', { name: 'Экзамен: TOEFL, сменить' }).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  } finally { await page.viewport(390, 844); }
});

test('T7: телефон закрывает шторку свайпом за ручку и нативной отменой', async () => {
  fakeServer(boot);
  const { screen } = await renderApp({ path: '/' });
  const open = () => screen.getByRole('button', { name: 'Экзамен: GRE, сменить' }).click();
  await open();
  const dialog = screen.getByRole('dialog').element();
  dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  await open();
  const handle = screen.getByRole('dialog').element().querySelector<HTMLElement>('[data-grabber]')!;
  vi.spyOn(handle, 'setPointerCapture').mockImplementation(() => {});
  handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientY: 0, bubbles: true }));
  handle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 100, bubbles: true }));
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

test('метка экзамена Telegram выбирает только известный серверу экзамен', async () => {
  fakeServer({ 'POST /api/auth/telegram-mini-app': () => json({ token: 't', expiresAt: '2026-11-05T10:00:00Z', user: user({ activeExam: null }) }), 'PUT /api/me/exam': () => json(user({ activeExam: 'toefl' })), 'GET /api/trainings/options': () => json(trainingOptions({ types: [] })) });
  const { screen } = await renderApp({ path: '/tg/', shell: 'telegram', launch: { initDataRaw: 'hash=x', languageCode: 'ru', startParam: 'toefl' } });
  await expect.element(screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
});

test('T3: сетевой отказ каталога отличается от серверного', async () => {
  fakeServer({ ...fresh, 'GET /api/exams': () => { throw new TypeError('offline'); } });
  const { screen } = await renderApp({ path: '/' });
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Нет сети — выбрать экзамен получится, когда она вернётся.Попробовать снова');
});

test('T7: затемнение закрывает шторку', async () => {
  fakeServer(boot);
  const { screen } = await renderApp({ path: '/' });
  await screen.getByRole('button', { name: 'Экзамен: GRE, сменить' }).click();
  screen.getByRole('dialog').element().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});
