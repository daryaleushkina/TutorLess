import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { fakeServer, json, renderApp, OPTIONS, user } from '../test/app';

const signedIn = { 'GET /api/words': () => json({ words: [] }), 'GET /api/me': () => json(user()), 'GET /api/trainings/options': () => json(OPTIONS) };

describe('разделы', () => {
  it.each([
    { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 },
  ])('«Назад» оставляет браузеру клик %j', async (options) => {
    fakeServer(signedIn);
    const { screen, router } = await renderApp({ path: '/progress' });
    await router.navigate({ to: '/settings' });
    const back = screen.getByRole('link', { name: 'Назад' });
    await expect.element(back).toBeVisible();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...options });
    let intercepted = false;
    // После обработчиков React гасим родную навигацию только в тестовом iframe Vitest.
    document.addEventListener('click', (click) => {
      intercepted = click.defaultPrevented;
      click.preventDefault();
    }, { once: true });
    back.element().dispatchEvent(event);
    expect(intercepted).toBe(false);
    expect(router.state.location.pathname).toBe('/settings');
  });

  it('телефон: панель вкладок ведёт по разделам; профиль — из шапки, с «Назад» и без капсулы', async () => {
    fakeServer(signedIn);
    const { screen, router } = await renderApp({ path: '/' });
    const tabs = screen.getByRole('navigation', { name: 'Разделы' }).last();
    await tabs.getByRole('link', { name: 'Слова' }).click();
    await expect.element(screen.getByRole('searchbox', { name: 'Найти слово' })).toBeVisible();
    await expect.element(tabs.getByRole('link', { name: 'Слова' })).toHaveAttribute('aria-current', 'page');
    await tabs.getByRole('link', { name: 'Экзамен' }).click();
    await expect.element(screen.getByText('Здесь будут пробные экзамены GRE и эссе с оценкой.')).toBeVisible();
    await tabs.getByRole('link', { name: 'Прогресс' }).click();
    await expect.element(screen.getByText('Здесь будет точность по разделам, история тренировок и примерный балл.')).toBeVisible();
    await screen.getByRole('link', { name: 'Профиль' }).last().click();
    await expect.poll(() => router.state.location.pathname).toBe('/settings');
    // Скрытая панель выпадает из дерева доступности — её больше не найти по роли.
    await expect.poll(() => screen.getByRole('navigation', { name: 'Разделы' }).elements().length).toBe(0);
    await screen.getByRole('link', { name: 'Назад' }).click();
    await expect.poll(() => router.state.location.pathname).toBe('/progress');
  });

  it('компьютер: боковая панель с настройками внизу, капсулы нет', async () => {
    await page.viewport(1280, 800);
    fakeServer(signedIn);
    const { screen } = await renderApp({ path: '/' });
    const side = screen.getByRole('navigation', { name: 'Разделы' }).first();
    await expect.element(side.getByRole('link', { name: /Профиль/ })).toBeVisible();
    // Капсулы нет (скрытое не в дереве доступности): навигация одна — панель.
    expect(screen.getByRole('navigation', { name: 'Разделы' }).elements()).toHaveLength(1);
    await side.getByRole('link', { name: /Профиль/ }).click();
    await expect.element(screen.getByRole('heading', { name: 'Профиль' })).toBeInTheDocument();
    expect(side.element().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    // Шире 600 px «Назад» у настроек не нужен — есть панель.
    expect(screen.getByRole('link', { name: 'Назад' }).elements()).toHaveLength(0);
    await page.viewport(390, 844);
  });


});

describe('вкладка горит по пути', () => {
  it('мини-апп: «Тренировка» текущая и с параметрами запуска Telegram в адресе', async () => {
    fakeServer({ 'POST /api/auth/telegram-mini-app': () => json({ token: 't', expiresAt: '2026-11-05T10:00:00Z', user: user() }), 'GET /api/trainings/options': () => json(OPTIONS) });
    const { screen } = await renderApp({
      path: '/tg/?tgTheme=dark&tgPlatform=ios',
      shell: 'telegram',
      launch: { initDataRaw: 'hash=x', languageCode: 'ru' },
    });
    await expect.element(screen.getByRole('link', { name: 'Тренировка' })).toHaveAttribute('aria-current', 'page');
  });
});
