import { describe, expect, it, vi } from 'vitest';
import { fakeServer, json, renderApp, OPTIONS, user } from '../test/app';

const state = vi.hoisted(() => ({ unavailable: true }));
vi.mock('../sections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sections')>();
  return { ...actual, loadSections: async () => {
    if (state.unavailable) throw new actual.SectionLoadError(new TypeError('Failed to fetch dynamically imported module'));
    return actual.loadSections();
  } };
});

describe('недоступный пакет разделов', () => {
  it('«Нет сети» оставляет вкладки и кэш; повтор догружает пакет', async () => {
    const { requests } = fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/trainings/options': () => json(OPTIONS) });
    const { screen, router, queryClient } = await renderApp({ path: '/' });
    await expect.element(screen.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
    await screen.getByRole('link', { name: 'Прогресс', exact: true }).click();
    await expect.element(screen.getByRole('heading', { name: 'Нет сети', exact: true })).toBeVisible();
    expect(router.state.location.pathname).toBe('/progress');
    expect(queryClient.getQueryData(['training-options', user().id, 'gre'])).toEqual(OPTIONS);
    expect(requests.some((request) => request.url.endsWith('/api/client-errors'))).toBe(false);
    // Повтор доступен даже до появления сети; не меняет документ и не теряет живое приложение.
    await screen.getByRole('button', { name: 'Попробовать снова' }).click();
    await expect.element(screen.getByRole('heading', { name: 'Нет сети', exact: true })).toBeVisible();
    state.unavailable = false;
    window.dispatchEvent(new Event('online'));
    await screen.getByRole('button', { name: 'Попробовать снова' }).click();
    await expect.element(screen.getByText('Здесь будет точность по разделам, история тренировок и примерный балл.')).toBeVisible();
    await screen.getByRole('link', { name: 'Тренировка', exact: true }).click();
    await expect.element(screen.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
  });
});
