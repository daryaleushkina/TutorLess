import { expect, test } from 'vitest';
import { TAB_ROOTS, TabHistory, tabForPath } from './tabHistory';

test('начальные адреса и принадлежность маршрутов', () => {
  const history = new TabHistory();
  for (const tab of Object.keys(TAB_ROOTS) as (keyof typeof TAB_ROOTS)[]) expect(history.destination(tab)).toBe(TAB_ROOTS[tab]);
  for (const path of ['/', '/training/new', '/training/id/review/2']) expect(tabForPath(path)).toBe('train');
  expect(tabForPath('/words/word')).toBe('words');
  expect(tabForPath('/exam/session')).toBe('exam');
  expect(tabForPath('/progress/history')).toBe('progress');
  for (const path of ['/settings', '/signin', '/words-extra']) expect(tabForPath(path)).toBeUndefined();
});

test('каждая вкладка сохраняет полный адрес, профиль не переписывает её', () => {
  const history = new TabHistory();
  history.visit('/training/new?section=quant#form');
  history.visit('/words?q=word');
  history.visit('/settings');
  expect(history.active).toBe('words');
  expect(history.profileBack).toBe('/words?q=word');
  expect(history.destination('train')).toBe('/training/new?section=quant#form');
  expect(history.destination('words')).toBe('/words?q=word');
  history.visit('/');
  expect(history.destination('train')).toBe('/');
  expect(new TabHistory().destination('words')).toBe('/words');
});
