import { describe, expect, it } from 'vitest';
import { wordPrefix, wordSearch } from './search';

describe('поиск слов', () => {
  it.each([[' ZOR ', 'zor'], ['   ', ''], ['ZOR%_', 'zor%_'], ['glim-let', 'glim-let']])('нормализует %s', (input, want) => {
    expect(wordPrefix(input)).toBe(want);
  });
  it('сохраняет введённый текст для возврата, отбрасывает неверный параметр адреса', () => {
    expect(wordSearch.parse({ q: ' ZOR ' })).toEqual({ q: ' ZOR ' });
    for (const q of [null, 1, [], 'z'.repeat(129)]) expect(wordSearch.parse({ q }).q).toBeUndefined();
    expect(wordSearch.parse({}).q).toBeUndefined();
  });
});
