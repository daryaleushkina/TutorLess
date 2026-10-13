import { onlineManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup } from 'vitest-browser-react';
import { apiError, fakeServer, json, renderApp, user } from '../../test/app';

afterEach(async () => { await cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const id = 'd3f00000-0000-4000-8000-000000000001';
const word = { id, lemma: 'zorble', senses: [], synonyms: [], antonyms: [] };
const session = { 'GET /api/me': () => json(user()) };

it('список, поиск, карточка без пустых частей и возврат к поиску', async () => {
  fakeServer({ ...session, 'GET /api/words': (req) => json({ words: new URL(req.url).searchParams.get('q') === 'none' ? [] : [{ id, lemma: 'zorble' }] }), [`GET /api/words/${id}`]: () => json(word) });
  const { screen } = await renderApp({ path: '/words' });
  await expect.element(screen.getByRole('searchbox', { name: 'Найти слово' })).toBeVisible();
  await screen.getByRole('searchbox').fill('none');
  await expect.element(screen.getByText('Ничего не найдено')).toBeVisible();
  await screen.getByRole('searchbox').fill('zor');
  await screen.getByRole('link', { name: 'zorble', exact: true }).click();
  await expect.element(screen.getByRole('heading', { level: 1, name: 'zorble' })).toBeVisible();
  await expect.element(screen.getByText('Синонимы', { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: /Послушать/ })).not.toBeInTheDocument();
  await screen.getByRole('link', { name: 'Назад', exact: true }).click();
  await expect.element(screen.getByRole('searchbox')).toHaveValue('zor');
});

it('ошибка списка и повтор', async () => {
  let fail = true;
  fakeServer({ ...session, 'GET /api/words': () => fail ? apiError(500, 'internal') : json({ words: [{ id, lemma: 'zorble' }] }) });
  const { screen } = await renderApp({ path: '/words' });
  await expect.element(screen.getByText('Не получилось загрузить слова')).toBeVisible();
  fail = false;
  await screen.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect.element(screen.getByRole('link', { name: 'zorble', exact: true })).toBeVisible();
});

it('карточка с несколькими значениями, примерами, синонимами и антонимами', async () => {
  fakeServer({ ...session, [`GET /api/words/${id}`]: () => json({ ...word, partOfSpeech: 'noun', ipa: '/z/', audioKey: 'fixture/z',
    senses: [{ definition: 'A fixture.', translation: 'Выдуманный объект.', example: 'A zorble.', exampleTranslation: 'Зорбл.' }, { definition: 'A name.', translation: 'Имя.' }], synonyms: ['flimble'], antonyms: ['plindle'] }) });
  const { screen } = await renderApp({ path: `/words/${id}` });
  await expect.element(screen.getByText('A fixture.', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Зорбл.', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Имя.', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('noun', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('/z/', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('flimble', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('plindle', { exact: true })).toBeVisible();
});

it.each([
  { ipa: '/z/', senses: [{ definition: 'A fixture.', translation: 'Тест.', example: 'A zorble.' }] },
  { partOfSpeech: 'noun', senses: [{ definition: 'A fixture.', translation: 'Тест.', exampleTranslation: 'Зорбл.' }] },
])('независимые необязательные поля карточки %j', async (fields) => {
  fakeServer({ ...session, [`GET /api/words/${id}`]: () => json({ ...word, ...fields }) });
  const { screen } = await renderApp({ path: `/words/${id}` });
  await expect.element(screen.getByText('Тест.', { exact: true })).toBeVisible();
});

it('карточка: ошибка, повтор и не найденное слово', async () => {
  let status = 500;
  fakeServer({ ...session, [`GET /api/words/${id}`]: () => status ? apiError(status, status === 404 ? 'not_found' : 'internal') : json(word) });
  const { screen, router } = await renderApp({ path: `/words/${id}` });
  await expect.element(screen.getByText('Не получилось загрузить слово')).toBeVisible();
  status = 0;
  await screen.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect.element(screen.getByRole('heading', { name: 'zorble', exact: true })).toBeVisible();
  status = 404;
  await router.navigate({ to: '/words/$wordId', params: { wordId: id.replace(/1$/, '2') } });
  await expect.element(screen.getByText('Слово не найдено')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Попробовать снова' })).not.toBeInTheDocument();
});

it('загрузка карточки до ответа', async () => {
  let release = (_response: Response) => {};
  const held = new Promise<Response>((resolve) => { release = resolve; });
  fakeServer({ ...session, [`GET /api/words/${id}`]: () => held });
  const { screen } = await renderApp({ path: `/words/${id}` });
  await expect.element(screen.getByText('Загружаем слова…')).toBeVisible();
  release(json(word));
  await expect.element(screen.getByRole('heading', { name: 'zorble', exact: true })).toBeVisible();
});

it.each(['/words', `/words/${id}`])('нет сети %s и повтор после восстановления', async (path) => {
  onlineManager.setOnline(false);
  fakeServer({ ...session, 'GET /api/words': () => json({ words: [{ id, lemma: 'zorble' }] }), [`GET /api/words/${id}`]: () => json(word) });
  const { screen } = await renderApp({ path });
  await expect.element(screen.getByRole('heading', { name: 'Нет сети' })).toBeVisible();
  onlineManager.setOnline(true);
  await expect.element(path === '/words' ? screen.getByRole('link', { name: 'zorble', exact: true }) : screen.getByRole('heading', { name: 'zorble', exact: true })).toBeVisible();
});

it.each(['/words', `/words/${id}`])('сетевой отказ при доступном navigator.onLine %s', async (path) => {
  fakeServer({ ...session, 'GET /api/words': () => { throw new TypeError('offline'); }, [`GET /api/words/${id}`]: () => { throw new TypeError('offline'); } });
  const { screen } = await renderApp({ path });
  await expect.element(screen.getByRole('heading', { name: 'Нет сети' })).toBeVisible();
});

it('догрузка: первая страница остаётся при ошибке, повтор добавляет следующую', async () => {
  let fail = true;
  let release = (_response: Response) => {};
  const held = new Promise<Response>((resolve) => { release = resolve; });
  fakeServer({ ...session, 'GET /api/words': (req) => {
    if (!new URL(req.url).searchParams.has('after')) return json({ words: [{ id, lemma: 'zorble', partOfSpeech: 'noun' }], nextCursor: 'fixture-cursor' });
    if (fail) return apiError(500, 'internal');
    return held;
  } });
  const { screen } = await renderApp({ path: '/words' });
  await screen.getByRole('button', { name: 'Показать ещё' }).click();
  await expect.element(screen.getByText('Не получилось загрузить следующие слова.')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'zorble, noun', exact: true })).toBeVisible();
  fail = false;
  await screen.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect.element(screen.getByRole('button', { name: 'Загружаем слова…' })).toBeDisabled();
  release(json({ words: [{ id: id.replace(/1$/, '2'), lemma: 'flimble' }] }));
  await expect.element(screen.getByRole('link', { name: 'flimble', exact: true })).toBeVisible();
});

it('пустой словарь', async () => {
  fakeServer({ ...session, 'GET /api/words': () => json({ words: [] }) });
  const { screen } = await renderApp({ path: '/words' });
  await expect.element(screen.getByText('В словаре пока нет слов')).toBeVisible();
});

it('поздний ответ старого поиска не заменяет свежий', async () => {
  let release = (_response: Response) => {};
  const held = new Promise<Response>((resolve) => { release = resolve; });
  const server = fakeServer({ ...session, 'GET /api/words': (req) => new URL(req.url).searchParams.get('q') === 'zor' ? held : json({ words: [] }) });
  const { screen } = await renderApp({ path: '/words' });
  await screen.getByRole('searchbox').fill('zor');
  await expect.poll(() => server.requests.some((req) => new URL(req.url).searchParams.get('q') === 'zor')).toBe(true);
  await screen.getByRole('searchbox').fill('flim');
  await expect.poll(() => server.requests.some((req) => new URL(req.url).searchParams.get('q') === 'flim')).toBe(true);
  release(json({ words: [{ id, lemma: 'zorble' }] }));
  await expect.element(screen.getByText('Ничего не найдено')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'zorble', exact: true })).not.toBeInTheDocument();
});

it('английский интерфейс словаря', async () => {
  fakeServer({ 'GET /api/me': () => json(user({ locale: 'en' })), 'GET /api/words': () => json({ words: [] }) });
  const { screen } = await renderApp({ path: '/words' });
  await expect.element(screen.getByRole('searchbox', { name: 'Find a word' })).toBeVisible();
  await expect.element(screen.getByText('The dictionary has no words yet')).toBeVisible();
});
