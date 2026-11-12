import { expect, test, vi } from 'vitest';
import { figureLabel, figureLabelUnits, figureLabelPositions, figureScale, figureValue, validFigure } from './figureGeometry';

// Модуль грузят все экраны тренировки: движок без Intl.Segmenter (Firefox до 125) не должен их ронять.
test('без Intl.Segmenter модуль грузится и переносит метки по кодовым точкам', async () => {
  vi.resetModules();
  vi.stubGlobal('Intl', Object.create(Intl, { Segmenter: { value: undefined } }));
  try {
    const geometry = await import('./figureGeometry');
    expect(geometry.figureLabel('a'.repeat(40)).join('')).toBe('a'.repeat(40));
    expect(geometry.figureLabelUnits('WW')).toBe(4);
  } finally {
    vi.unstubAllGlobals();
    vi.resetModules();
  }
});

const figure = { id: 'test', kind: 'bar' as const, title: 'Synthetic', xLabel: '', yLabel: '', unit: '', description: 'Synthetic data.', categories: ['A', 'B', 'C'], series: [{ id: 's', label: 'Series', values: [-12, 0, 30] }] };

for (const values of [[0, 0], [-4, -4], [9, 9], [-20, 0, 30], [-Number.MAX_VALUE, Number.MAX_VALUE], [Number.MIN_VALUE, 0]]) test(`конечная шкала с нулём: ${values}`, () => {
  const { ratio, ticks } = figureScale([{ id: 's', label: 'Series', values }]);
  for (const value of [...values, 0]) { expect(ratio(value)).toBeGreaterThanOrEqual(0); expect(ratio(value)).toBeLessThanOrEqual(1); }
  expect(ticks.every((tick) => Number.isFinite(tick.value) && Number.isFinite(tick.ratio))).toBe(true);
  expect(ratio(Math.max(...values))).toBeLessThanOrEqual(ratio(Math.min(...values)));
});

test('шкала общая для всех рядов, отрицательный столбец по другую сторону нуля', () => {
  const scale = figureScale([...figure.series, { id: 'b', label: 'B', values: [60, 20, 0] }]);
  expect(scale.ratio(-12)).toBeGreaterThan(scale.ratio(0));
  expect(scale.ratio(60)).toBe(0);
  expect(scale.ratio(30)).toBeCloseTo(3 / 8);
});
test('числа не округляются и не теряют точность, минус читаем, −0 показан как 0', () => {
  expect(figureValue(-0)).toBe('0'); expect(figureValue(-12.34567)).toBe('−12.34567'); expect(figureValue(1e30)).toBe('1e+30');
});
test('переносы сохраняют длинные слова и пробелы между словами', () => {
  expect(figureLabel('one two three four', 7.5)).toEqual(['one two', 'three', 'four']);
  expect(figureLabel('a'.repeat(200)).join('')).toBe('a'.repeat(200));
  expect(figureLabel('😀'.repeat(20), 3).join('')).toBe('😀'.repeat(20));
  expect(figureLabel('')).toEqual([]);
});
test('совпадающие метки разнесены и привязаны к исходному ряду', () => {
  expect(figureLabelPositions([200, 10, 10], 10, 200, 18)).toEqual([200, 10, 28]);
  const many = figureLabelPositions(Array<number>(20).fill(440), 10, 440, 18);
  expect(many[19]).toBe(440); expect(many[0]).toBeGreaterThanOrEqual(10);
  expect(many.every((value, i) => i === 0 || value - many[i - 1]! >= 18)).toBe(true);
});
test('не рисуем несовпадающие длины, пустые, слишком большие и бесконечные данные', () => {
  expect(validFigure(figure)).toBe(true);
  for (const broken of [ { ...figure, categories: [] }, { ...figure, categories: [' '] }, { ...figure, categories: Array<string>(101).fill('x') },
    { ...figure, series: [] }, { ...figure, series: Array(21).fill(figure.series[0]) },
    { ...figure, series: [{ ...figure.series[0]!, values: [1] }] }, { ...figure, series: [{ ...figure.series[0]!, values: [NaN, 0, Infinity] }] }]) expect(validFigure(broken)).toBe(false);
});

test('перенос учитывает ширину заглавных букв и глифов других алфавитов', () => {
  expect(figureLabelUnits('WMAbя😀')).toBe(10.5);
  for (const label of ['W'.repeat(200), 'M'.repeat(200), 'C'.repeat(200), '界'.repeat(200)]) {
    const lines = figureLabel(label);
    expect(lines.join('')).toBe(label);
    expect(lines.every((line) => figureLabelUnits(line) <= 18)).toBe(true);
  }
});


for (const letter of ['m', 'w']) test(`широкая строчная ${letter} учитывается при переносе`, () => {
  expect(figureLabelUnits(letter.repeat(200))).toBeGreaterThanOrEqual(300);
  expect(figureLabel(letter.repeat(200)).every((line) => line.length <= 12)).toBe(true);
});

for (const space of ['\u00a0', '\u202f']) test(`неразрывная группа не делится: ${space.codePointAt(0)}`, () => {
  expect(figureLabel(`run 5${space}km`, 4)).toEqual(['run', `5${space}km`]);
});

test('перенос по графемам сохраняет составной символ целиком', () => {
  const symbol = '👩🏽‍🔬';
  expect(figureLabel(symbol.repeat(4), 2)).toEqual(Array(4).fill(symbol));
  expect(figureLabel('a\u0301'.repeat(4), 1)).toEqual(Array(4).fill('a\u0301'));
});

for (const [values, expected] of [ [[0, 30], [0, 10, 20, 30]], [[-12, 30], [-20, 0, 20, 40]], [[0, 0.3], [0, 0.1, 0.2, 0.3]], [[0, 12345678], [0, 5000000, 10000000, 15000000]], [[0, 0], [0, 0.5, 1]] ]) test(`красивые десятичные деления: ${values}`, () => {
  const scale = figureScale([{ id: 's', label: 'Series', values: values! }]);
  expect(scale.ticks.map((tick) => tick.value)).toEqual(expected);
  expect(scale.ticks.some((tick) => tick.value === 0)).toBe(true);
  for (const tick of scale.ticks) {
    expect(tick.ratio).toBe(scale.ratio(Number(figureValue(tick.value).replace('−', '-'))));
  }
});
