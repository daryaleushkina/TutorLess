// Сайт: вход через Apple и Google с подменным провайдером (server/cmd/e2estack) — весь путь OIDC с PKCE, обмен
// кода на сервере, кука сессии; выход; отказы.
import type { Page } from '@playwright/test';
import { pickInitialExam } from '../shellFlows';
import { e2eSlot } from '../../tools/dev/e2e-slot';
import { expect, test } from '../fixtures';

const PROVIDERS = [
  ['Вход с Apple', 'apple'],
  ['Войти с аккаунтом Google', 'google'],
] as const;

/** Подменный провайдер пускает «человека» из login_hint: так тест задаёт, кто входит, или отказ (deny). */
async function loginAs(page: Page, hint: string) {
  await page.route(`http://127.0.0.1:${e2eSlot().oidcPort}/auth?**`, (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('login_hint', hint);
    return route.continue({ url: url.toString() });
  });
}

test.beforeEach(async ({ page, watch }) => {
  watch(page);
});

test('без входа — экран входа: две официальные кнопки, условия, дисклеймер ETS', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL((url) => url.pathname === '/signin');
  expect(new URL(page.url()).searchParams.has('returnTo')).toBe(false);
  for (const [name] of PROVIDERS) await expect(page.getByRole('button', { name })).toBeVisible();
  await expect(page.locator('[data-official-button="telegram"]')).toHaveCount(0);
  await expect(page.getByText('Продолжая, вы принимаете условия и политику конфиденциальности.')).toBeVisible();
  await expect(page.getByText(/are registered trademarks of Educational Testing Service/)).toBeVisible();
});

for (const [button, provider] of PROVIDERS) {
  test(`вход «${button}» → «Тренировка»; после перезагрузки — всё ещё вошли; «Выйти» — снова вход`, async ({ page }, testInfo) => {
    await loginAs(page, `${provider}-${testInfo.testId}`);
    await page.goto('/signin');
    // Нажатие только запускает уход. Всю цепочку перенаправлений ждём как навигацию до конечного адреса.
    await page.getByRole('button', { name: button }).click({ noWaitAfter: true });
    await page.waitForURL((url) => url.pathname === '/');
    const home = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/home');
    await pickInitialExam(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Тренировка' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await home;
    await page.reload();
    await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();

    const narrow = (page.viewportSize()?.width ?? 0) < 900;
    if (narrow) {
      await page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Прогресс' }).click();
      await page.getByRole('link', { name: 'Профиль' }).click();
    } else {
      await page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Профиль' }).click();
    }
    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('button', { name: button })).toBeVisible();
    await page.goto('/');
    await page.waitForURL((url) => url.pathname === '/signin');
  });
}


test('отмена на странице провайдера — «Вход отменён», можно снова', async ({ page }) => {
  await loginAs(page, 'deny');
  await page.goto('/signin');
  await page.getByRole('button', { name: 'Войти с аккаунтом Google' }).click({ noWaitAfter: true });
  await page.waitForURL((url) => url.pathname === '/signin' && url.searchParams.get('reason') === 'cancelled');
  await expect(page.getByRole('alert')).toHaveText('Вход отменён — можно попробовать снова.');
  await expect(page.getByRole('button', { name: 'Войти с аккаунтом Google' })).toBeEnabled();
});

test('чужой или подделанный возврат — «Не получилось войти», сессии нет', async ({ page }) => {
  await page.goto('/auth/callback?code=stolen&state=forged');
  await page.waitForURL((url) => url.pathname === '/signin' && url.searchParams.get('reason') === 'failed');
  await expect(page.getByRole('alert')).toHaveText('Не получилось войти. Попробуйте ещё раз.');
  const me = await page.evaluate(async () => (await fetch('/api/me')).status);
  expect(me).toBe(401);
});

test('вход подменой — для разработки и стенда', async ({ page }, testInfo) => {
  await page.goto('/signin');
  await page.getByPlaceholder('Имя тестового пользователя').fill(`dev-${testInfo.testId}`);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await pickInitialExam(page);
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
});

test('глубокая ссылка → вход подменой → тот же экран с параметрами и якорем', async ({ page }, info) => {
  await page.goto('/words?source=link#details');
  await page.waitForURL((url) => url.pathname === '/signin');
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/words?source=link#details');
  await page.getByPlaceholder('Имя тестового пользователя').fill(`deep-${info.testId}`);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/words');
  await pickInitialExam(page);
  await expect(page.getByRole('heading', { name: 'Слова', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/words\?source=link#details$/);
});

test('глубокая ссылка → отмена у провайдера → повторный вход → настройки', async ({ page }, info) => {
  await loginAs(page, 'deny');
  await page.goto('/settings');
  await page.waitForURL((url) => url.pathname === '/signin');
  await page.getByRole('button', { name: 'Войти с аккаунтом Google' }).click({ noWaitAfter: true });
  await page.waitForURL((url) => url.pathname === '/signin' && url.searchParams.get('reason') === 'cancelled');
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/settings');
  await page.unroute(`http://127.0.0.1:${e2eSlot().oidcPort}/auth?**`);
  await loginAs(page, `google-deep-${info.testId}`);
  await page.getByRole('button', { name: 'Войти с аккаунтом Google' }).click({ noWaitAfter: true });
  await page.waitForURL((url) => url.pathname === '/settings');
  await pickInitialExam(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Профиль' })).toBeAttached();
});

test('чужой адрес возврата → вход → «Тренировка»', async ({ page }, info) => {
  await page.goto(`/signin?returnTo=${encodeURIComponent('//evil.example/path')}`);
  await page.getByPlaceholder('Имя тестового пользователя').fill(`unsafe-${info.testId}`);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/');
    await pickInitialExam(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Тренировка' })).toBeVisible();
});

test('401 на конструкторе → повторный вход → тот же экран', async ({ page, site }, info) => {
  await page.route('**/api/trainings/options?**', (route) => route.fulfill({ status: 401, json: { code: 'unauthorized', message: 'e2e', requestId: 'expired' } }));
  await site.goto('/training/new?source=expired#details');
  await page.waitForURL((url) => url.pathname === '/signin' && url.searchParams.get('reason') === 'expired');
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/training/new?source=expired#details');
  await expect(page.getByRole('alert')).toHaveText('Вход закончился — войдите снова.');
  await page.unroute('**/api/trainings/options?**');
  await page.getByPlaceholder('Имя тестового пользователя').fill(`expired-${info.testId}`);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/training/new');
  await pickInitialExam(page);
  await expect(page.getByRole('heading', { name: 'Новая тренировка', exact: true })).toBeVisible();
});

test('намеренный выход из настроек → новый человек → «Тренировка»', async ({ page, site }, info) => {
  await site.goto('/settings');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/signin');
  expect(new URL(page.url()).searchParams.has('returnTo')).toBe(false);
  await page.getByPlaceholder('Имя тестового пользователя').fill(`next-${info.testId}`);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/');
    await pickInitialExam(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Тренировка' })).toBeVisible();
});

for (const failure of ['expired', 'missing-code'] as const) {
  test(`возврат ${failure} → адрес сохранён → повторный вход в настройки`, async ({ page }, info) => {
    await page.goto('/signin');
    await expect(page.getByRole('button', { name: 'Войти с аккаунтом Google' })).toBeVisible();
    await page.evaluate((kind) => sessionStorage.setItem('greprep.signIn', JSON.stringify({
      provider: 'google', state: 'attempt-state', nonce: 'n', codeVerifier: 'v'.repeat(43),
      redirectUri: `${location.origin}/auth/callback`,
      startedAt: Date.now() - (kind === 'expired' ? 11 * 60 * 1000 : 0), returnTo: '/settings',
    })), failure);
    await page.goto(`/auth/callback?state=attempt-state${failure === 'expired' ? '&code=c' : ''}`);
    await page.waitForURL((url) => url.pathname === '/signin' && url.searchParams.get('reason') === 'failed');
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/settings');
    await loginAs(page, `retry-${failure}-${info.testId}`);
    await page.getByRole('button', { name: 'Войти с аккаунтом Google' }).click({ noWaitAfter: true });
    await page.waitForURL((url) => url.pathname === '/settings');
  await pickInitialExam(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Профиль' })).toBeAttached();
  });
}

test.describe('английский браузер', () => {
  test.use({ locale: 'en-US' });

  test('вход и новый аккаунт — по-английски', async ({ page }, testInfo) => {
    await loginAs(page, `google-en-${testInfo.testId}`);
    await page.goto('/signin');
    await expect(page.getByText('Exam-style questions with explanations for every mistake in your language.')).toBeVisible();
    await page.getByRole('button', { name: 'Sign in with Google' }).click({ noWaitAfter: true });
    await page.waitForURL((url) => url.pathname === '/');
    await pickInitialExam(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Practice' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  });
});
