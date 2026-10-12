import { expect, test, vi } from 'vitest';
import { apiError, fakeServer, json, renderApp, user } from '../../test/app';
import { trainingOptions } from '../../test/training';
import { THEME_STORAGE_KEY } from '../../styles/theme';

const boot = { 'GET /api/me': () => json(user()) };
test('язык меняет интерфейс сразу, запрос сохраняет язык, повтор выбранного не отправляется', async () => {
  let release = (_response: Response) => {};
  const held = new Promise<Response>((resolve) => { release = resolve; });
  const server = fakeServer({ ...boot, 'PUT /api/me/locale': () => held });
  const { screen } = await renderApp({ path: '/settings' });
  await screen.getByRole('button', { name: 'English', exact: true }).click();
  await expect.element(screen.getByRole('group', { name: 'Language' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'English', exact: true })).toBeDisabled();
  expect(await server.requests.find((req) => req.method === 'PUT')!.json()).toEqual({ locale: 'en' });
  release(json(user({ locale: 'en', identities: [{ provider: 'google', linkedAt: '2026-10-06T10:00:00Z' }] })));
  await expect.element(screen.getByRole('button', { name: 'English', exact: true })).toBeEnabled();
  await expect.element(screen.getByText('Sign in with Google', { exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'English', exact: true }).click();
  expect(server.requests.filter((req) => req.method === 'PUT')).toHaveLength(1);
  await screen.getByRole('button', { name: 'Русский', exact: true }).click();
});

test('тема и размер текста сохраняются на устройстве, повтор выбора не меняет состояние', async () => {
  fakeServer({ ...boot, 'GET /api/trainings/options': () => json(trainingOptions()) });
  const { screen, router } = await renderApp({ path: '/settings' });
  await screen.getByRole('button', { name: 'Светлая', exact: true }).click();
  await expect.poll(() => localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  await screen.getByRole('button', { name: 'Светлая', exact: true }).click();
  await screen.getByRole('button', { name: 'Крупнее', exact: true }).click();
  expect(document.documentElement.dataset.textSize).toBe('large');
  await router.navigate({ to: '/' });
  await router.navigate({ to: '/settings' });
  await expect.element(screen.getByRole('button', { name: 'Крупнее', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await screen.getByRole('button', { name: 'Обычный', exact: true }).click();
  expect(localStorage.getItem('greprep.textSize')).toBe('normal');
  await screen.getByRole('button', { name: 'Тёмная', exact: true }).click();
  await expect.poll(() => document.documentElement.dataset.theme).toBe('dark');
});

test('не удалось сохранить тему или размер — выбор возвращается, причина видна', async () => {
  fakeServer(boot);
  const { screen } = await renderApp({ path: '/settings' });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage denied'); });
  await screen.getByRole('button', { name: 'Светлая', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Тёмная', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Не получилось сохранить настройку на устройстве. Попробуйте ещё раз.');
  await screen.getByRole('button', { name: 'Крупнее', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Обычный', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('мини-апп: связанный Apple не меняет подпись Telegram, тема и нативный назад во вкладку', async () => {
  fakeServer({ 'POST /api/auth/telegram-mini-app': () => json({ token: 't', expiresAt: '2026-11-05T10:00:00Z', user: user({ identities: [{ provider: 'apple', linkedAt: '2026-10-06T10:00:00Z' }] }) }) });
  const { screen } = await renderApp({ path: '/tg/settings', shell: 'telegram', launch: { initDataRaw: 'hash=x', languageCode: 'ru' } });
  await expect.element(screen.getByText('Вход через Telegram', { exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Светлая', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Светлая', exact: true })).toBeEnabled();
});

test.each([true, false])('позднее сохранение языка после выхода (%s) не возвращает старый аккаунт', async (success) => {
  let release = (_response: Response) => {};
  const held = new Promise<Response>((resolve) => { release = resolve; });
  fakeServer({ ...boot, 'PUT /api/me/locale': () => held, 'POST /api/auth/logout': () => new Response(null, { status: 204 }) });
  const { screen } = await renderApp({ path: '/settings' });
  await screen.getByRole('button', { name: 'English', exact: true }).click();
  await screen.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Sign in with Apple' })).toBeVisible();
  release(success ? json(user({ locale: 'en' })) : apiError(500, 'internal'));
  await expect.element(screen.getByRole('button', { name: 'Sign in with Apple' })).toBeVisible();
});

test('сайт: связанные Telegram и Apple показывают способ входа на сайте', async () => {
  fakeServer({ 'GET /api/me': () => json(user({ identities: [{ provider: 'telegram', linkedAt: '2026-10-06T10:00:00Z' }, { provider: 'apple', linkedAt: '2026-10-07T10:00:00Z' }] })) });
  const { screen } = await renderApp({ path: '/settings' });
  await expect.element(screen.getByText('Вход с Apple', { exact: true })).toBeVisible();
});
