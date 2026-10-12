import { expect, test } from 'vitest';
import { sectionLang } from './sectionLang';
test('названия Words и Essay переводятся; термины экзаменов остаются английскими', () => {
  expect(sectionLang('words')).toBeUndefined();
  expect(sectionLang('essay')).toBeUndefined();
  for (const section of ['verbal', 'quant', 'reading', 'listening', 'writing', 'speaking'] as const) expect(sectionLang(section)).toBe('en');
});
