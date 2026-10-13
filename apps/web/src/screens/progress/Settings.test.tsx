import { describe, expect, it } from 'vitest';
import { apiError, fakeServer, json, renderApp, OPTIONS, user } from '../../test/app';

const signedIn = { 'GET /api/me': () => json(user()), 'GET /api/trainings/options': () => json(OPTIONS) };
const launch = { initDataRaw: 'query_id=1&hash=x', languageCode: 'ru' };

describe('настройки', () => {
  it('сайт: «Выйти» — сессия удалена на сервере, дальше вход; версия сборки видна', async () => {
    const { requests } = fakeServer({ ...signedIn, 'POST /api/auth/logout': () => new Response(null, { status: 204 }) });
    const { screen, router } = await renderApp({ path: '/settings' });
    await expect.element(screen.getByText(/^Версия /)).toBeVisible();
    await screen.getByRole('button', { name: 'Выйти' }).click();
    await expect.element(screen.getByRole('button', { name: 'Вход с Apple' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/signin');
    expect(router.state.location.search).toEqual({});
    expect(requests.some((r) => r.method === 'POST' && r.url.endsWith('/api/auth/logout'))).toBe(true);
  });

  it('после намеренного выхода следующий человек попадает на «Тренировка»', async () => {
    fakeServer({ ...signedIn, 'POST /api/auth/logout': () => new Response(null, { status: 204 }),
      'POST /api/auth/dev': () => json({ expiresAt: '2026-11-05T10:00:00Z', user: user({ name: 'Новый' }) }) });
    const { screen, router } = await renderApp({ path: '/settings' });
    await screen.getByRole('button', { name: 'Выйти' }).click();
    await expect.element(screen.getByPlaceholder('Имя тестового пользователя')).toBeVisible();
    expect(router.state.location.search).toEqual({});
    await screen.getByPlaceholder('Имя тестового пользователя').fill('Новый');
    await screen.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect.element(screen.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
  });

  it('сессия уже кончилась (вышли в другой вкладке) — «Выйти» всё равно выходит и стирает данные', async () => {
    const { requests } = fakeServer({ ...signedIn, 'POST /api/auth/logout': () => apiError(401, 'unauthorized') });
    // Сначала «Тренировка»: план человека оказывается в кэше, потом — настройки.
    const { screen, router, queryClient } = await renderApp({ path: '/' });
    await expect.element(screen.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
    expect(queryClient.getQueryData(['training-options', user().id, 'gre'])).toBeDefined();
    await router.navigate({ to: '/settings' });
    await screen.getByRole('button', { name: 'Выйти' }).click();
    await expect.element(screen.getByRole('button', { name: 'Вход с Apple' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/signin');
    expect(queryClient.getQueryData(['training-options', user().id, 'gre'])).toBeUndefined();
    expect(requests.some((r) => r.url.endsWith('/api/auth/logout'))).toBe(true);
  });

  it.each([
    [() => apiError(500, 'internal'), 'Не получилось выйти. Попробуйте ещё раз.'],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Нет сети — выйти получится, когда она появится.',
    ],
  ])('выйти не вышло — экран как был и причина', async (logout, text) => {
    fakeServer({ ...signedIn, 'POST /api/auth/logout': logout });
    const { screen, router } = await renderApp({ path: '/settings' });
    await screen.getByRole('button', { name: 'Выйти' }).click();
    await expect.element(screen.getByRole('alert')).toHaveTextContent(text);
    expect(router.state.location.pathname).toBe('/settings');
    await expect.element(screen.getByRole('button', { name: 'Выйти' })).toBeEnabled();
  });

  it('мини-апп: выхода нет — вход здесь сам Telegram', async () => {
    fakeServer({ 'POST /api/auth/telegram-mini-app': () => json({ token: 't', expiresAt: '2026-11-05T10:00:00Z', user: user() }) });
    const { screen } = await renderApp({ path: '/tg/settings', shell: 'telegram', launch });
    await expect.element(screen.getByRole('heading', { name: 'Профиль' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выйти' }).elements()).toHaveLength(0);
  });
});

describe('мини-апп: вход по initData', () => {
  it('initData уходит на сервер, токен — в заголовке следующих запросов', async () => {
    const { requests } = fakeServer({
      'POST /api/auth/telegram-mini-app': () => json({ token: 'tok-1', expiresAt: '2026-11-05T10:00:00Z', user: user() }),
      'GET /api/trainings/options': () => json(OPTIONS),
    });
    const { screen } = await renderApp({ path: '/tg/', shell: 'telegram', launch });
    await expect.element(screen.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
    const signIn: unknown = await requests.find((r) => r.url.endsWith('/api/auth/telegram-mini-app'))?.json();
    expect(signIn).toEqual({ initData: 'query_id=1&hash=x' });
    expect(requests.find((r) => new URL(r.url).pathname === '/api/trainings/options')?.headers.get('Authorization')).toBe('Bearer tok-1');
  });

  it('сервер отклонил initData — «Не получилось войти» и «Повторить»', async () => {
    let reject = true;
    fakeServer({
      'POST /api/auth/telegram-mini-app': () => (reject ? apiError(401, 'invalid_init_data') : json({ token: 't', expiresAt: '2026-11-05T10:00:00Z', user: user() })),
      'GET /api/trainings/options': () => json(OPTIONS),
    });
    const { screen } = await renderApp({ path: '/tg/', shell: 'telegram', launch });
    await expect.element(screen.getByRole('heading', { name: 'Не получилось войти' })).toBeVisible();
    reject = false;
    await screen.getByRole('button', { name: 'Попробовать снова' }).click();
    await expect.element(screen.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
  });

  it('сессия кончилась посреди работы — мини-апп входит заново сам', async () => {
    let optionsCalls = 0;
    let signIns = 0;
    fakeServer({
      'POST /api/auth/telegram-mini-app': () => {
        signIns++;
        return json({ token: `tok-${signIns}`, expiresAt: '2026-11-05T10:00:00Z', user: user() });
      },
      'GET /api/trainings/options': () => (++optionsCalls === 1 ? apiError(401, 'unauthorized') : json(OPTIONS)),
    });
    const { screen } = await renderApp({ path: '/tg/', shell: 'telegram', launch });
    await expect.element(screen.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
    expect(signIns).toBe(2);
  });

  it('вход заново не удался — упавшие запросы не перечитываются без токена, экран говорит, что не вошли', async () => {
    let signIns = 0;
    let optionsCalls = 0;
    fakeServer({
      'POST /api/auth/telegram-mini-app': () =>
        ++signIns === 1 ? json({ token: 'tok-1', expiresAt: '2026-11-05T10:00:00Z', user: user() }) : apiError(401, 'invalid_init_data'),
      'GET /api/trainings/options': () => {
        optionsCalls++;
        return apiError(401, 'unauthorized');
      },
    });
    const { screen } = await renderApp({ path: '/tg/', shell: 'telegram', launch });
    await expect.element(screen.getByRole('heading', { name: 'Не получилось войти' })).toBeVisible();
    expect(signIns).toBe(2);
    expect(optionsCalls).toBe(1);
  });

  it('язык Telegram — английский: пока идёт вход, экран загрузки по-английски; дальше — язык аккаунта', async () => {
    let finishSignIn: () => void = () => {};
    const signedInLater = new Promise<void>((r) => (finishSignIn = r));
    fakeServer({
      'POST /api/auth/telegram-mini-app': async () => {
        await signedInLater;
        return json({ token: 't', expiresAt: '2026-11-05T10:00:00Z', user: user({ locale: 'ru' }) });
      },
      'GET /api/trainings/options': () => json(OPTIONS),
    });
    const { screen } = await renderApp({ path: '/tg/', shell: 'telegram', launch: { ...launch, languageCode: 'en' } });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Practice' })).toBeVisible();
    await expect.element(screen.getByText('Loading practice')).toBeInTheDocument();
    finishSignIn();
    // Аккаунт — русский: после входа интерфейс на языке аккаунта.
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Тренировка' })).toBeVisible();
  });

  it.each([
    [() => apiError(429, 'too_many_requests'), 'Слишком много попыток подряд — подождите минуту.'],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Нет сети — войти получится, когда она появится.',
    ],
  ])('вход мини-аппа не прошёл — причина на экране', async (reply, text) => {
    fakeServer({ 'POST /api/auth/telegram-mini-app': reply });
    const { screen } = await renderApp({ path: '/tg/', shell: 'telegram', launch });
    await expect.element(screen.getByText(text)).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Попробовать снова' })).toBeVisible();
  });

  it('ответ входа без токена — ошибка договора: «Не получилось войти» и отчёт', async () => {
    const { requests } = fakeServer({
      'POST /api/auth/telegram-mini-app': () => json({ expiresAt: '2026-11-05T10:00:00Z', user: user() }),
      'POST /api/client-errors': () => new Response(null, { status: 204 }),
    });
    const { screen } = await renderApp({ path: '/tg/', shell: 'telegram', launch });
    await expect.element(screen.getByRole('heading', { name: 'Не получилось войти' })).toBeVisible();
    await expect.poll(() => requests.some((r) => r.url.endsWith('/api/client-errors'))).toBe(true);
  });
});
