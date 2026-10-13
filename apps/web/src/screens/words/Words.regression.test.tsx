import { onlineManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup } from 'vitest-browser-react';
import { fakeServer, json, renderApp, user } from '../../test/app';

const id = 'd3f00000-0000-4000-8000-000000000001';
const secondId = 'd3f00000-0000-4000-8000-000000000002';
const thirdId = 'd3f00000-0000-4000-8000-000000000003';
const item = { id, lemma: 'zorble' };
const boot = { 'GET /api/me': () => json(user()) };
afterEach(async () => { vi.useRealTimers(); await cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('R1: задержанная своя навигация сохраняет дописанные символы', async () => {
  const server = fakeServer({ ...boot, 'GET /api/words': () => json({ words: [item] }) });
  const { screen, router } = await renderApp({ path: '/words' });
  await expect.element(screen.getByRole('link', { name: 'zorble', exact: true })).toBeVisible();
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const original = router.navigate;
  let first = true;
  const navigation = vi.spyOn(router, 'navigate').mockImplementation(async (options) => {
    if (first) { first = false; await held; }
    await original(options);
  });
  await screen.getByRole('searchbox').fill('ab');
  await expect.poll(() => navigation.mock.calls.length).toBe(1);
  await screen.getByRole('searchbox').fill('abc');
  release();
  await expect.poll(() => server.requests.some((req) => new URL(req.url).searchParams.get('q') === 'ab')).toBe(true);
  await expect.element(screen.getByRole('searchbox')).toHaveValue('abc');
  await expect.poll(() => router.state.location.search.q).toBe('abc');
});

it('R1: браузерный Назад восстанавливает поиск из адреса', async () => {
  fakeServer({ ...boot, 'GET /api/words': () => json({ words: [item] }) });
  const { screen, router } = await renderApp({ path: '/words?q=zor' });
  await expect.element(screen.getByRole('searchbox')).toHaveValue('zor');
  await router.navigate({ to: '/words', search: { q: 'flim' } });
  await expect.element(screen.getByRole('searchbox')).toHaveValue('flim');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await screen.getByRole('searchbox').fill('flimble');
  router.history.back();
  await expect.element(screen.getByRole('searchbox')).toHaveValue('zor');
});

it('R2: сетевой отказ догрузки сохраняет все страницы и позволяет повторить её', async () => {
  let fail = true;
  fakeServer({ ...boot, 'GET /api/words': (req) => {
    const after = new URL(req.url).searchParams.get('after');
    if (!after) return json({ words: [item], nextCursor: 'page-two' });
    if (after === 'page-two') return json({ words: [{ id: secondId, lemma: 'flimble' }], nextCursor: 'page-three' });
    if (fail) throw new TypeError('network failure');
    return json({ words: [{ id: thirdId, lemma: 'plindle' }] });
  } });
  const { screen } = await renderApp({ path: '/words' });
  await screen.getByRole('button', { name: 'Показать ещё' }).click();
  await expect.element(screen.getByRole('link', { name: 'flimble', exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Показать ещё' }).click();
  await expect.element(screen.getByText('Не получилось загрузить следующие слова.')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'zorble', exact: true })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'flimble', exact: true })).toBeVisible();
  await expect.element(screen.getByRole('heading', { name: 'Нет сети' })).not.toBeInTheDocument();
  fail = false;
  await screen.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect.element(screen.getByRole('link', { name: 'plindle', exact: true })).toBeVisible();
});

it('R2: фоновый сетевой отказ сохраняет загруженный список', async () => {
  let fail = false;
  fakeServer({ ...boot, 'GET /api/words': () => {
    if (fail) throw new TypeError('network failure');
    return json({ words: [item] });
  } });
  const { screen, queryClient } = await renderApp({ path: '/words' });
  await expect.element(screen.getByRole('link', { name: 'zorble', exact: true })).toBeVisible();
  fail = true;
  await queryClient.invalidateQueries({ queryKey: ['words'] });
  await expect.element(screen.getByRole('link', { name: 'zorble', exact: true })).toBeVisible();
  onlineManager.setOnline(false);
  await expect.element(screen.getByRole('link', { name: 'zorble', exact: true })).toBeVisible();
});

it('R4: ссылка и возврат используют применённый запрос во время задержки ввода', async () => {
  fakeServer({ ...boot, 'GET /api/words': () => json({ words: [item] }),
    [`GET /api/words/${id}`]: () => json({ ...item, senses: [], synonyms: [], antonyms: [] }) });
  const { screen, router } = await renderApp({ path: '/words?q=zor' });
  const link = screen.getByRole('link', { name: 'zorble', exact: true });
  await expect.element(link).toBeVisible();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await screen.getByRole('searchbox').fill('flim');
  await expect.element(link).toHaveAttribute('href', `/words/${id}?q=zor`);
  vi.useRealTimers();
  await link.click();
  await expect.element(screen.getByRole('heading', { name: 'zorble', exact: true })).toBeVisible();
  expect(router.state.location.search.q).toBe('zor');
  await screen.getByRole('link', { name: 'Назад', exact: true }).click();
  await expect.element(screen.getByRole('searchbox')).toHaveValue('zor');
});

it('R4: пустой поиск не пишет q в карточку и возврат', async () => {
  fakeServer({ ...boot, 'GET /api/words': () => json({ words: [item] }),
    [`GET /api/words/${id}`]: () => json({ ...item, senses: [], synonyms: [], antonyms: [] }) });
  const { screen, router } = await renderApp({ path: '/words' });
  const link = screen.getByRole('link', { name: 'zorble', exact: true });
  await expect.element(link).toHaveAttribute('href', `/words/${id}`);
  await link.click();
  await expect.element(screen.getByRole('link', { name: 'Назад', exact: true })).toHaveAttribute('href', '/words');
  await screen.getByRole('link', { name: 'Назад', exact: true }).click();
  await expect.poll(() => router.state.location.href).toBe('/words');
});

it('R4: очистка поиска удаляет пустой q из адреса', async () => {
  fakeServer({ ...boot, 'GET /api/words': () => json({ words: [item] }) });
  const { screen, router } = await renderApp({ path: '/words?q=zor' });
  await screen.getByRole('searchbox').fill('');
  await expect.poll(() => router.state.location.href).toBe('/words');
});

it('R5: новый поиск сохраняет прежний список под aria-busy и блокирует догрузку', async () => {
  let release = (_response: Response) => {};
  const held = new Promise<Response>((resolve) => { release = resolve; });
  const server = fakeServer({ ...boot, 'GET /api/words': (req) => new URL(req.url).searchParams.get('q') === 'flim'
    ? held : json({ words: [item], nextCursor: 'page-two' }) });
  const { screen } = await renderApp({ path: '/words' });
  const list = screen.getByRole('list', { name: 'Слова', exact: true });
  await expect.element(list).toBeVisible();
  const height = list.element().getBoundingClientRect().height;
  await screen.getByRole('searchbox').fill('flim');
  await expect.poll(() => server.requests.some((req) => new URL(req.url).searchParams.get('q') === 'flim')).toBe(true);
  await expect.element(screen.getByRole('link', { name: 'zorble', exact: true })).toBeVisible();
  expect(list.element().parentElement?.getAttribute('aria-busy')).toBe('true');
  expect(list.element().getBoundingClientRect().height).toBe(height);
  await expect.element(screen.getByRole('button', { name: 'Показать ещё' })).toBeDisabled();
  release(json({ words: [{ id: secondId, lemma: 'flimble' }] }));
  await expect.element(screen.getByRole('link', { name: 'flimble', exact: true })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'zorble', exact: true })).not.toBeInTheDocument();
});
