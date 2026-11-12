import { schemas, type DataFigure } from '@greprep/api-client';

// Десятичные целые дают шаги 1/2/5 без накопления ошибки float. Пределы оси
// нормализуются до вычитания: даже диапазон ±Number.MAX_VALUE остаётся конечным.
const SCALE_INTERVALS = 4;
const NICE_STEPS = [1n, 2n, 5n, 10n];
function decimal(value: number) {
  const [mantissa, power = '0'] = String(value).split('e');
  const [whole, fraction = ''] = mantissa!.split('.');
  return { coefficient: BigInt(whole! + fraction), exponent: Number(power) - fraction.length };
}
export function figureScale(series: DataFigure['series']) {
  const values = series.flatMap((s) => s.values);
  const decimals = values.map(decimal);
  const exponent = Math.min(...decimals.map((v) => v.exponent), 0) - 1;
  const integer = (v: ReturnType<typeof decimal>) => v.coefficient * 10n ** BigInt(v.exponent - exponent);
  const integers = decimals.map(integer);
  const low = integers.reduce((a, b) => a < b ? a : b, 0n);
  const high = integers.reduce((a, b) => a > b ? a : b, 0n) || (low === 0n ? 10n ** BigInt(-exponent) : 0n);
  const range = high - low;
  const decade = 10n ** BigInt(Math.max(0, (range / BigInt(SCALE_INTERVALS)).toString().length - 1));
  let step = NICE_STEPS.find((candidate) => candidate * decade * BigInt(SCALE_INTERVALS) >= range)! * decade;
  // Деления меньше минимального представимого числа слиплись бы в одинаковые нули.
  if (exponent < -324) step = step > 5n * 10n ** BigInt(-324 - exponent) ? step : 5n * 10n ** BigInt(-324 - exponent);
  const bottom = low < 0n ? -((-low + step - 1n) / step) * step : 0n;
  const top = (high + step - 1n) / step * step;
  const normalExponent = Math.max(bottom.toString().replace('-', '').length, top.toString().length) - 1 + exponent;
  const normalized = (v: bigint) => Number(`${v}e${exponent - normalExponent}`);
  const lower = normalized(bottom), upper = normalized(top);
  const ratio = (value: number) => (upper - normalized(integer(decimal(value)))) / (upper - lower);
  const ticks: { value: number; ratio: number }[] = [];
  for (let tick = bottom; tick <= top; tick += step) {
    const value = Number(`${tick}e${exponent}`);
    // Край оси может лежать за пределом Number, но не превращается в подпись Infinity.
    if (Number.isFinite(value)) ticks.push({ value, ratio: ratio(value) });
  }
  return { ratio, ticks };
}

export function figureValue(value: number) { return String(value).replace(/^-/, '−'); }

// Модуль грузят все экраны тренировки, а Intl.Segmenter есть не везде (Firefox до 125): без него — кодовые точки.
let segmenter: Intl.Segmenter | null | undefined;
const graphemes = (text: string) => {
  if (segmenter === undefined) segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
  return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);
};

/** Консервативная ширина в долях обычной буквы: широкие глифы не налезают на соседнюю категорию. */
export function figureLabelUnits(label: string): number {
  return graphemes(label).reduce((sum, character) => sum + (/[WM]|[^\u0000-\u024f]/u.test(character) ? 2 : /[A-Zmw]/.test(character) ? 1.5 : 1), 0);
}

/** Переносит и слова, и неразрывные длинные метки, сохраняя весь текст. */
export function figureLabel(label: string, limit = 18): string[] {
  const lines: string[] = [];
  let line = '';
  const append = (part: string) => {
    if (line && figureLabelUnits(line + ' ' + part) > limit) { lines.push(line); line = ''; }
    line += (line ? ' ' : '') + part;
  };
  for (const word of label.trim().split(/[ \t\r\n\f\v]+/)) {
    if (/[\u00a0\u202f]/u.test(word)) { append(word); continue; }
    let part = '';
    for (const character of graphemes(word)) {
      if (part && figureLabelUnits(part + character) > limit) { append(part); part = ''; }
      part += character;
    }
    if (part) append(part);
  }
  if (line) lines.push(line);
  return lines;
}

/** Подписи совпадающих точек расходятся по вертикали, порядок рядов сохраняет привязку. */
export function figureLabelPositions(positions: number[], top: number, bottom: number, gap: number): number[] {
  const sorted = positions.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
  const placed = sorted.map((point, i) => Math.max(top + i * gap, point.y));
  for (let i = placed.length - 1; i >= 0; i--) placed[i] = Math.min(placed[i]!, bottom - (placed.length - 1 - i) * gap, placed[i + 1] === undefined ? bottom : placed[i + 1]! - gap);
  const result = Array<number>(positions.length);
  sorted.forEach((point, i) => { result[point.index] = placed[i]!; });
  return result;
}

export function validFigure(figure: DataFigure) {
  return figure.categories.length > 0 && figure.categories.length <= schemas.dataFigureCategoriesMax && figure.categories.every((label) => label.trim().length > 0)
    && figure.series.length > 0 && figure.series.length <= schemas.dataFigureSeriesMax && figure.series.every((s) => s.values.length === figure.categories.length && s.values.every(Number.isFinite));
}
