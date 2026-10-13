import { expect, test, vi } from 'vitest';
import { LeavingDraftStore, draftStamp } from './leavingDraftStore';

function fixture() {
  const values = new Map<string, string>();
  const storage: Storage = { get length() { return values.size; }, key: (i) => [...values.keys()][i] ?? null,
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); }, clear: () => values.clear() };
  return { values, store: new LeavingDraftStore('fixture', () => storage) };
}
const owner = { userId: 'fixture-user', revision: 1 };
const id = '00000000-0000-4000-8000-000000000001';
const draft = { position: 0, ids: ['22,5'], savedAt: 1 };

test('журнал восстанавливает только свою ревизию и не удаляет более позднюю запись', () => {
  const { store } = fixture();
  store.put(owner, id, draft);
  store.remove(owner, id, { ...draft, ids: ['22'], savedAt: 0 });
  expect(store.take(owner)).toEqual([{ id, draft }]);
  store.remove(owner, id, draft);
  expect(store.take(owner)).toEqual([]);
  store.put(owner, id, draft);
  expect(store.take({ ...owner, revision: 2 })).toEqual([]);
  expect(store.take(owner)).toEqual([]);
  store.put(owner, id, draft);
  expect(store.take({ userId: 'different-user', revision: 1 })).toEqual([]);
});

test('журнал отбрасывает повреждённое, неверную позицию и чужой ключ; clear сохраняет соседние настройки', () => {
  const { store, values } = fixture();
  values.set('theme', 'light');
  values.set('fixture/leaving-draft/broken-json', '{');
  values.set('fixture/leaving-draft/null', 'null');
  store.put(owner, id, draft);
  const key = [...values.keys()].find((key) => key.endsWith(id))!;
  values.set(key + 'wrong', values.get(key)!);
  expect(store.take(owner)).toEqual([{ id, draft }]);
  expect([...values.keys()]).toEqual(['theme', key]);
  expect(() => store.put(owner, id, { ...draft, position: -1 })).toThrow();
  store.clear();
  expect([...values.entries()]).toEqual([['theme', 'light']]);
});

test('отказ хранилища не маскируется', () => {
  const store = new LeavingDraftStore('fixture', () => { throw new Error('storage blocked'); });
  expect(() => store.put(owner, id, draft)).toThrow('storage blocked');
  expect(() => store.take(owner)).toThrow('storage blocked');
  expect(() => store.remove(owner, id, draft)).toThrow('storage blocked');
  expect(() => store.clear()).toThrow('storage blocked');
});

test('подтверждение более свежего выбора убирает старое, но оставляет более новый журнал', () => {
  const { store } = fixture();
  store.put(owner, id, draft);
  store.remove(owner, id, { ...draft, ids: ['different'], savedAt: 2 });
  expect(store.take(owner)).toEqual([]);
  store.remove(owner, id, draft);
  store.put(owner, id, { ...draft, savedAt: 3 });
  store.put(owner, id, { ...draft, ids: ['older'], savedAt: 2 });
  store.remove(owner, id, { ...draft, ids: ['different'], savedAt: 2 });
  expect(store.take(owner)).toEqual([{ id, draft: { ...draft, savedAt: 3 } }]);
});

test('очистка испорченного журнала и чтение старого без отметки', () => {
  const { store, values } = fixture();
  store.put(owner, id, draft);
  const key = [...values.keys()][0]!;
  values.set(key, '{'); store.remove(owner, id, draft); expect(values.size).toBe(0);
  values.set(key, '{}'); store.remove(owner, id, draft); expect(values.size).toBe(0);
  values.set(key, '{'); store.put(owner, id, draft); expect(store.take(owner)).toEqual([{ id, draft }]);
  const { savedAt: _savedAt, ...legacy } = draft;
  values.set(key, JSON.stringify({ owner, id, draft: legacy }));
  expect(store.take(owner)).toEqual([{ id, draft: { ...legacy, savedAt: 0 } }]);
});

test('отметка растёт даже при равных и более ранних показаниях часов', () => {
  const first = draftStamp();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
  try { const next = draftStamp(); expect(next).toBeGreaterThan(first); expect(draftStamp()).toBeGreaterThan(next); }
  finally { clock.mockRestore(); }
});

test('отметка идёт по стенным часам: после сна компьютера performance.now отстаёт, а другие вкладки — нет', () => {
  const awake = Date.now() + 3_600_000;
  const wall = vi.spyOn(Date, 'now').mockReturnValue(awake);
  const monotonic = vi.spyOn(performance, 'now').mockReturnValue(0);
  try { expect(draftStamp()).toBeGreaterThanOrEqual(awake); }
  finally { wall.mockRestore(); monotonic.mockRestore(); }
});
