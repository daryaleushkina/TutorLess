import { expect, test } from 'vitest';
import { figureLabel, figureLabelUnits, figureLabelPositions, figureScale, figureValue, validFigure } from './figureGeometry';

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
  expect(scale.ratio(30)).toBeCloseTo(5 / 12);
});
test('числа не округляются и не теряют точность, минус читаем, −0 показан как 0', () => {
  expect(figureValue(-0)).toBe('0'); expect(figureValue(-12.34567)).toBe('−12.34567'); expect(figureValue(1e30)).toBe('1e+30');
});
test('переносы сохраняют длинные слова и пробелы между словами', () => {
  expect(figureLabel('one two three four', 7)).toEqual(['one two', 'three', 'four']);
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
