import { page } from 'vitest/browser';
import { expect, test } from 'vitest';
import { fakeServer, json, renderApp, user } from '../test/app';
import { trainingOptions } from '../test/training';

const signedIn = { 'GET /api/me': () => json(user({ activeExam: 'toefl' })),
  'GET /api/trainings/options': () => json(trainingOptions()) };

test('вкладка хранит адрес конструктора и его форму при переключении', async () => {
  fakeServer(signedIn);
  const { screen, router } = await renderApp({ path: '/training/new?section=quant' });
  await expect.element(screen.getByRole('textbox', { name: 'Вопросов' })).toBeVisible();
  await screen.getByRole('textbox', { name: 'Вопросов' }).fill('5');
  await screen.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Слова' }).click();
  await expect.element(screen.getByText('Здесь будут слова: учить, повторять и искать.')).toBeVisible();
  await screen.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Тренировка', exact: true }).click();
  await expect.poll(() => router.state.location.href).toBe('/training/new?section=quant');
  await expect.element(screen.getByRole('textbox', { name: 'Вопросов' })).toHaveValue('5');
});

test('широкий сайт: экзамен аккаунта сверху, профиль снизу', async () => {
  await page.viewport(1280, 800);
  try {
    fakeServer(signedIn);
    const { screen } = await renderApp({ path: '/' });
    const nav = screen.getByRole('navigation', { name: 'Разделы' });
    await expect.element(nav.getByRole('button', { name: 'Экзамен: TOEFL, сменить' })).toHaveAttribute('aria-haspopup', 'dialog');
    await nav.getByRole('link', { name: /Профиль/ }).click();
    await expect.element(screen.getByRole('heading', { name: 'Профиль' })).toBeInTheDocument();
  } finally { await page.viewport(390, 844); }
});
