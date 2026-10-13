import { expect, test, vi } from 'vitest';
import { fakeServer, json, renderApp, OPTIONS, user } from '../test/app';
import { trainingOptions, trainingSession } from '../test/training';
import { trainingRepository } from './repository';
import { TrainingStorageBlockedError } from './store';

const sdk = vi.hoisted(() => {
  let visible = false;
  const handlers = new Set<() => void>();
  return { visible: () => visible, clickBack: () => { for (const handler of handlers) handler(); },
  backButton: { show: { ifAvailable: vi.fn(() => { visible = true; }) }, hide: { ifAvailable: vi.fn(() => { visible = false; }) }, onClick: { ifAvailable: vi.fn((handler: () => void) => { handlers.add(handler); return { ok: true, data: () => { handlers.delete(handler); } }; }) } },
  mainButton: { setParams: { isAvailable: vi.fn(() => false), ifAvailable: vi.fn() }, onClick: { ifAvailable: vi.fn((_handler: () => void) => ({ ok: true, data: () => {} })) } },
  secondaryButton: { setParams: { isAvailable: vi.fn(() => false), ifAvailable: vi.fn() }, onClick: { ifAvailable: vi.fn(() => ({ ok: true, data: () => {} })) } },
  closingBehavior: { mount: { ifAvailable: vi.fn() }, isConfirmationEnabled: vi.fn(() => false), enableConfirmation: { isAvailable: vi.fn(() => false), ifAvailable: vi.fn() }, disableConfirmation: { ifAvailable: vi.fn() } },
  swipeBehavior: { disableVertical: { isAvailable: vi.fn(() => true), ifAvailable: vi.fn() }, enableVertical: { ifAvailable: vi.fn() }, isVerticalEnabled: vi.fn(() => true) },
  miniApp: { ready: { ifAvailable: vi.fn() } },
  hapticFeedback: { impactOccurred: { ifAvailable: vi.fn() } },
}; });
vi.mock('@tma.js/sdk-react', () => sdk);
const signedIn = { 'POST /api/auth/telegram-mini-app': () => json({ token: 'fixture', expiresAt: '2026-11-06T00:00:00Z', user: user() }), 'GET /api/trainings/options': () => json(OPTIONS) };
const launch = { initDataRaw: 'fixture', languageCode: 'ru' };
const back = () => sdk.clickBack();

test('Telegram «назад» выходит после отказа записи ответа', async () => {
  fakeServer({ ...signedIn, 'POST /api/trainings': () => json(trainingSession()) });
  vi.spyOn(trainingRepository, 'requestSync').mockImplementation(() => {});
  const { screen, router } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await screen.getByRole('button', { name: /Начать ·/ }).click();
  vi.spyOn(trainingRepository, 'answer').mockRejectedValue(new Error('fixture write failed'));
  await screen.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await expect.element(screen.getByRole('alert')).toBeVisible();
  back();
  await expect.poll(() => router.state.location.pathname).toBe('/');
});

for (const state of ['missing', 'loading', 'unavailable', 'blocked'] as const) test(`жалоба: Telegram «назад» доступна при состоянии ${state}`, async () => {
  fakeServer(signedIn);
  let release = () => {};
  if (state === 'loading') {
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(trainingRepository, 'get').mockImplementation(async () => { await held; return undefined; });
  }
  if (state === 'unavailable' || state === 'blocked') vi.spyOn(trainingRepository.store, 'signIn').mockRejectedValueOnce(state === 'blocked' ? new TrainingStorageBlockedError() : new Error('fixture storage unavailable'));
  const id = trainingSession().id;
  const { screen, router } = await renderApp({ path: `/training/${id}/report/0`, shell: 'telegram', launch });
  try {
    const label = state === 'loading' ? 'Загружаем тренировку' : state === 'unavailable' ? 'Нет места на устройстве' : state === 'blocked' ? 'Обновляем тренировки' : 'Тренировки нет на устройстве';
    await expect.element(screen.getByText(label, { exact: true })).toBeVisible();
    await expect.poll(() => sdk.visible()).toBe(true);
    back(); release();
    await expect.poll(() => router.state.location.pathname).toBe(`/training/${id}`);
  } finally { release(); }
});

test('переход вопрос → жалоба → вопрос не включает свайп ни на мгновение', async () => {
  sdk.swipeBehavior.isVerticalEnabled.mockReturnValue(true); vi.clearAllMocks();
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(trainingSession()) });
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await screen.getByRole('button', { name: /Начать ·/ }).click();
  await expect.element(screen.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  await screen.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await expect.element(screen.getByRole('textbox', { name: 'Что не так' })).toBeVisible();
  expect(sdk.swipeBehavior.enableVertical.ifAvailable).not.toHaveBeenCalled();
  back(); await expect.element(screen.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  expect(sdk.swipeBehavior.enableVertical.ifAvailable).not.toHaveBeenCalled();
});

test('Telegram «назад» закрывает темы, затем конструктор, затем сессию', async () => {
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(trainingSession()) });
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await expect.element(screen.getByRole('group', { name: 'Вопросов', exact: true })).toBeVisible();
  await expect.poll(() => sdk.visible()).toBe(true);
  await screen.getByRole('button', { name: /Темы и сложность все/ }).click(); back();
  await expect.element(screen.getByRole('heading', { name: 'Новая тренировка' })).toBeVisible();
  await screen.getByRole('button', { name: /Начать ·/ }).click(); await expect.element(screen.getByRole('heading', { name: 'Text Completion' })).toBeVisible(); back();
  await expect.element(screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
  await screen.getByRole('link', { name: 'Настроить тренировку' }).click(); await expect.element(screen.getByRole('heading', { name: 'Новая тренировка' })).toBeVisible(); back();
  await expect.element(screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
});
test('Telegram «назад» во время загрузки возвращает на «Тренировка»', async () => {
  let release: () => void = () => {}; const held = new Promise<void>((r) => { release = r; });
  fakeServer({ ...signedIn, 'GET /api/trainings/options': async () => { await held; return json(trainingOptions()); } });
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await expect.element(screen.getByText('Загружаем темы')).toBeVisible(); back(); release();
  await expect.element(screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
});


test('два нажатия нашей кнопки в одном кадре создают одну тренировку', async () => {
  let release: () => void = () => {}; const held = new Promise<void>((r) => { release = r; });
  const server = fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()),
    'POST /api/trainings': async () => { await held; return json(trainingSession()); } });
  sdk.mainButton.setParams.isAvailable.mockReturnValue(true); vi.clearAllMocks();
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  try {
    await expect.element(screen.getByRole('group', { name: 'Вопросов', exact: true })).toBeVisible();
    const button = screen.getByRole('button', { name: /^Начать ·/ }).element();
    if (!(button instanceof HTMLButtonElement)) throw new Error('fixture button missing');
    button.click(); button.click();
    expect(sdk.mainButton.setParams.ifAvailable).not.toHaveBeenCalled();
    expect(sdk.secondaryButton.setParams.ifAvailable).not.toHaveBeenCalled();
    await expect.poll(() => server.requests.filter((r) => r.method === 'POST' && new URL(r.url).pathname === '/api/trainings').length).toBe(1);
    release(); await expect.element(screen.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  } finally { release(); sdk.mainButton.setParams.isAvailable.mockReturnValue(false); }
});

for (const enabled of [true, false]) test(`сессия сохраняет прогресс на «назад», свайпы восстановлены: ${enabled}`, async () => {
  sdk.swipeBehavior.isVerticalEnabled.mockReturnValue(enabled);
  vi.clearAllMocks();
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(trainingSession()) });
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await screen.getByRole('button', { name: /Начать ·/ }).click();
  await expect.element(screen.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  expect(sdk.swipeBehavior.disableVertical.ifAvailable).toHaveBeenCalled();
  back(); await expect.element(screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
  expect(sdk.swipeBehavior.enableVertical.ifAvailable.mock.calls.length > 0).toBe(enabled);
  await expect.element(screen.getByRole('link', { name: /Продолжить тренировку/ })).toBeVisible();
});

test('после перезагрузки отключённые сессией свайпы возвращаются к исходному состоянию', async () => {
  // При выгрузке страницы React не вызывает cleanup; SDK восстанавливает выключенные свайпы.
  sessionStorage.setItem('greprep.training.swipes', 'enabled');
  sdk.swipeBehavior.isVerticalEnabled.mockReturnValue(false);
  vi.clearAllMocks();
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(trainingSession()) });
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await screen.getByRole('button', { name: /Начать ·/ }).click();
  await expect.element(screen.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  back(); await expect.element(screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
  expect(sdk.swipeBehavior.enableVertical.ifAvailable).toHaveBeenCalled();
  expect(sessionStorage.getItem('greprep.training.swipes')).toBeNull();
});

for (const stored of ['disabled', 'broken', 'storage-failed', 'cleanup-failed', 'unsupported']) test(`свайпы: исходное состояние и отказы оболочки ${stored}`, async () => {
  sdk.swipeBehavior.isVerticalEnabled.mockReturnValue(true);
  sdk.swipeBehavior.disableVertical.isAvailable.mockReturnValue(stored !== 'unsupported');
  sessionStorage.setItem('greprep.training.swipes', stored === 'disabled' ? 'disabled' : 'broken');
  if (stored === 'storage-failed') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('fixture denied'); });
  vi.clearAllMocks();
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(trainingSession()) });
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await screen.getByRole('button', { name: /Начать ·/ }).click();
  await expect.element(screen.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  if (stored === 'cleanup-failed') vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('fixture denied'); });
  back(); await expect.element(screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
  expect(sdk.swipeBehavior.enableVertical.ifAvailable.mock.calls.length > 0).toBe(stored !== 'disabled' && stored !== 'unsupported');
  sdk.swipeBehavior.disableVertical.isAvailable.mockReturnValue(true);
});


test('свайпы выключены только на вопросе и жалобе', async () => {
  sdk.swipeBehavior.isVerticalEnabled.mockReturnValue(true); vi.clearAllMocks();
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(trainingSession()) });
  const { trainingRepository } = await import('./repository');
  vi.spyOn(trainingRepository, 'requestSync').mockImplementation(() => {});
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await expect.element(screen.getByRole('heading', { name: 'Новая тренировка' })).toBeVisible();
  expect(sdk.swipeBehavior.disableVertical.ifAvailable).not.toHaveBeenCalled();
  await screen.getByRole('button', { name: /Начать ·/ }).click();
  for (let index = 0; index < 3; index++) {
    await screen.getByRole('button', { name: 'Не знаю', exact: true }).click();
    await screen.getByRole('button', { name: index < 2 ? /^Дальше$/ : 'К итогу', exact: true }).click();
  }
  await screen.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await screen.getByRole('link', { name: /Вопрос 1, без ответа/ }).click();
  await screen.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await expect.element(screen.getByRole('textbox', { name: 'Что не так' })).toBeVisible();
  expect(sdk.swipeBehavior.enableVertical.ifAvailable).toHaveBeenCalledTimes(1);
  for (const heading of ['Вопрос 1', 'Разбор тренировки', '0 из 3 верно']) { back(); await expect.element(screen.getByRole('heading', { name: heading, exact: true })).toBeVisible(); }
  await screen.getByRole('button', { name: 'Готово', exact: true }).click();
  await expect.element(screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
  expect(sdk.swipeBehavior.enableVertical.ifAvailable).toHaveBeenCalledTimes(2);
});


for (const originallyEnabled of [true, false]) test(`черновик Telegram не переключает подтверждение закрытия: ${originallyEnabled}`, async () => {
  sdk.closingBehavior.enableConfirmation.isAvailable.mockReturnValue(true);
  sdk.closingBehavior.isConfirmationEnabled.mockReturnValue(originallyEnabled);
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(trainingSession()) });
  const { trainingRepository } = await import('./repository'); vi.spyOn(trainingRepository, 'requestSync').mockImplementation(() => {});
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await screen.getByRole('button', { name: /Начать ·/ }).click();
  await screen.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  sdk.closingBehavior.disableConfirmation.ifAvailable.mockClear(); sdk.closingBehavior.enableConfirmation.ifAvailable.mockClear();
  await screen.getByRole('button', { name: 'Другое', exact: true }).click();
  expect(sdk.closingBehavior.enableConfirmation.ifAvailable).not.toHaveBeenCalled();
  await expect.element(screen.getByText('Черновик сохранён', { exact: true })).toBeInTheDocument();
  expect(sdk.closingBehavior.disableConfirmation.ifAvailable).not.toHaveBeenCalled();
  sdk.closingBehavior.enableConfirmation.isAvailable.mockReturnValue(false);
});


test('на маршруте жалобы свайпы выключены и после сохранения, возврат на незаконченный вопрос их не включает', async () => {
  sdk.swipeBehavior.isVerticalEnabled.mockReturnValue(true); vi.clearAllMocks();
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(trainingSession()) });
  const { trainingRepository } = await import('./repository'); vi.spyOn(trainingRepository, 'requestSync').mockImplementation(() => {});
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await screen.getByRole('button', { name: /Начать ·/ }).click();
  await screen.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await screen.getByRole('button', { name: 'В задании', exact: true }).click();
  await screen.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect.element(screen.getByRole('status').filter({ hasText: 'Спасибо — проверим и поправим' })).toBeVisible();
  expect(sdk.swipeBehavior.enableVertical.ifAvailable).not.toHaveBeenCalled();
  await expect.element(screen.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  expect(sdk.swipeBehavior.enableVertical.ifAvailable).not.toHaveBeenCalled();
});

test('оболочка: нативный назад закрывает выбор экзамена и возвращает из профиля во вкладку', async () => {
  fakeServer(signedIn);
  const { screen } = await renderApp({ path: '/tg/', shell: 'telegram', launch });
  await screen.getByRole('button', { name: 'Экзамен: GRE, сменить' }).click();
  await expect.element(screen.getByRole('dialog')).toBeVisible();
  back();
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  await screen.getByRole('link', { name: 'Слова', exact: true }).click();
  await screen.getByRole('link', { name: 'Профиль', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Подписка' })).toBeDisabled();
  back();
  await expect.element(screen.getByRole('heading', { name: 'Слова', exact: true })).toBeVisible();
});

for (const overlay of ['overview', 'exit'] as const) test(`таймаут с открытой шторкой ${overlay} сохраняет Telegram «назад»`, async () => {
  fakeServer({ ...signedIn, 'GET /api/trainings/options': () => json(trainingOptions()), 'POST /api/trainings': () => json(trainingSession({ mode: 'check', timeLimitSeconds: 60 })) });
  vi.spyOn(trainingRepository, 'requestSync').mockImplementation(() => {});
  const { screen } = await renderApp({ path: '/training/new', shell: 'telegram', launch });
  await screen.getByRole('button', { name: 'Проверка', exact: true }).click();
  await screen.getByRole('button', { name: /Начать ·/ }).click();
  await expect.element(screen.getByRole('timer')).toBeVisible();
  if (overlay === 'overview') await screen.getByRole('button', { name: 'Вопросы', exact: true }).click();
  else back();
  await expect.element(screen.getByRole('dialog')).toBeVisible();
  const subscriptions = sdk.backButton.onClick.ifAvailable.mock.calls.length;
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
  window.dispatchEvent(new Event('pageshow'));
  await expect.element(screen.getByRole('heading', { name: 'Время вышло', exact: true })).toBeVisible();
  // Подписка обновляется в effect после рендера экрана таймаута.
  await expect.poll(() => sdk.backButton.onClick.ifAvailable.mock.calls.length).toBeGreaterThan(subscriptions);
  await expect.poll(() => sdk.visible()).toBe(true);
  back(); await expect.element(screen.getByRole('heading', { name: 'Тренировка', exact: true })).toBeVisible();
});
