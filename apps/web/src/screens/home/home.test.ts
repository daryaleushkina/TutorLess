import { expect, test } from 'vitest';
import { trainingOptions, trainingSession } from '../../test/training';
import { storedTraining } from '../../training/model';
import { availableFor, homeActive, homeSections, homeStart } from './home';

test('пустые типы не считаются доступными; первый набор ограничен каталогом', () => {
  const options = trainingOptions();
  expect(homeSections(options).length).toBeGreaterThan(0);
  expect(homeStart({ ...options, types: [] }, 'toefl', null)).toBeUndefined();
  expect(homeStart(options, 'gre', null)?.request).toMatchObject({ exam: 'gre', count: 10, mode: 'practice' });
  expect(homeStart({ ...options, maxQuestions: 2 }, 'toefl', null)?.request).toMatchObject({ exam: 'toefl', count: 2 });
});
test('последний запрос: фактический размер, фильтры, неподдерживаемый или пустой набор', () => {
  const options = trainingOptions();
  const request = { exam: 'gre' as const, section: 'verbal' as const, questionTypes: ['text_completion' as const], mode: 'check' as const, count: 50 };
  expect(homeStart(options, 'gre', { request, size: 3 })).toEqual({ previous: true, request: { ...request, count: 3 } });
  expect(homeStart(options, 'toefl', { request, size: 3 })?.previous).toBe(false);
  expect(homeStart(options, 'gre', { request: { ...request, topicIds: ['gone'] }, size: 3 })?.previous).toBe(false);
  expect(availableFor(options, { ...request, topicIds: ['cause'], difficulty: 'easy' })).toBeGreaterThanOrEqual(0);
  expect(homeStart({ ...options, maxQuestions: 0 }, 'gre', null)).toBeUndefined();
});
test('продолжение только своего экзамена, незаконченная и не истёкшая сессия', () => {
  const current = storedTraining(trainingSession(), Date.now());
  expect(homeActive([current], Date.now(), 'gre')).toBe(current);
  expect(homeActive([current], Date.now(), 'toefl')).toBeUndefined();
  const legacy = { ...current, session: { ...current.session, exam: undefined } };
  expect(homeActive([legacy], Date.now(), 'gre')).toBe(legacy);
  expect(homeActive([legacy], Date.now(), 'toefl')).toBeUndefined();
  expect(homeActive([{ ...current, finish: { finishedAt: new Date().toISOString(), timedOut: false } }], Date.now(), 'gre')).toBeUndefined();
});
