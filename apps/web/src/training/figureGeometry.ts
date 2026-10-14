import type { DataFigure } from '@greprep/api-client';

// Координаты SVG, а не размеры интерфейса. Нормализация до вычитания сохраняет конечные
// координаты даже у ±Number.MAX_VALUE; единственный ноль получает ненулевой диапазон.
export function figureScale(series: DataFigure['series']) {
  const values = series.flatMap((s) => s.values);
  const magnitude = Math.max(...values.map(Math.abs)) || 1;
  const low = Math.min(0, ...values.map((v) => v / magnitude));
  const high = Math.max(0, ...values.map((v) => v / magnitude)) || (low === 0 ? 1 : 0);
  const ratio = (value: number) => (high - value / magnitude) / (high - low);
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const normalized = low + (high - low) * i / 4;
    return { ratio: (high - normalized) / (high - low), value: Number((normalized * magnitude).toPrecision(6)) };
  });
  return { ratio, ticks };
}

export function figureValue(value: number) { return String(value).replace(/^-/, '−'); }

/** Консервативная ширина в долях обычной буквы: широкие глифы не налезают на соседнюю категорию. */
export function figureLabelUnits(label: string): number {
  return Array.from(label).reduce((sum, character) => sum + (/[WM]|[^\u0000-\u024f]/u.test(character) ? 2 : /[A-Z]/.test(character) ? 1.5 : 1), 0);
}

/** Переносит и слова, и неразрывные длинные метки, сохраняя весь текст. */
export function figureLabel(label: string, limit = 18): string[] {
  const lines: string[] = [];
  let line = '';
  const append = (part: string) => {
    if (line && figureLabelUnits(line + ' ' + part) > limit) { lines.push(line); line = ''; }
    line += (line ? ' ' : '') + part;
  };
  for (const word of label.trim().split(/\s+/)) {
    let part = '';
    for (const character of Array.from(word)) {
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
  return figure.categories.length > 0 && figure.categories.length <= 100 && figure.categories.every((label) => label.trim().length > 0)
    && figure.series.length > 0 && figure.series.length <= 20 && figure.series.every((s) => s.values.length === figure.categories.length && s.values.every(Number.isFinite));
}
