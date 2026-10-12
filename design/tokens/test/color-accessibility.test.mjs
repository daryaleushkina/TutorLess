import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveModes } from '../build.mjs';
import { asColor, contrast, deriveColor, fromOklch, inGamut, minimumContrast, toOklch } from '../color-accessibility.mjs';
import { deriveSources, INK_ROLES, SURFACES } from '../derive-ink.mjs';
import { frameVariables } from './app-b-css.mjs';

const parseHex = (hex) => asColor([1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255));
const close = (actual, expected, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≠ ${expected}`);
const hueDifference = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

test('sRGB ↔ OKLCH: опорные значения красного, белого и обратное преобразование', () => {
  const red = toOklch([1, 0, 0]);
  // Опорное значение для матриц с уточнённым белым D65 из CSS Color 4.
  [0.62795536, 0.25768331, 29.2338803].forEach((n, i) => close(red[i], n));
  const white = toOklch([1, 1, 1]);
  close(white[0], 1);
  close(white[1], 0);
  assert.equal(white[2], 0);
  for (const rgb of [[0, 0, 0], [1, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1], [0.2, 0.6, 0.8]]) {
    fromOklch(toOklch(rgb)).forEach((n, i) => close(n, rgb[i]));
  }
});

test('Выход за sRGB исправляется уменьшением chroma с сохранением lightness и hue', () => {
  const expected = [0.5, 0.3, 150];
  const raw = fromOklch(expected);
  assert.ok(raw.some((n) => n < 0 || n > 1));
  const mapped = inGamut(expected);
  assert.ok(mapped.every((n) => n >= 0 && n <= 1));
  const actual = toOklch(mapped);
  close(actual[0], expected[0]);
  close(actual[2], expected[2]);
  assert.ok(actual[1] < expected[1]);
});

test('Подбор проходит AA после округления, меняет светлоту в нужную сторону и сохраняет уже подходящий цвет', () => {
  const white = parseHex('#FFFFFF');
  const black = parseHex('#000000');
  close(contrast(white.components, black.components), 21);
  for (const [mode, base] of [['light', white], ['dark', black]]) {
    const result = deriveColor(base, [[base]], 4.5, mode);
    assert.ok(minimumContrast(result, [[base]]) >= 4.5);
    assert.ok(minimumContrast(result, [[base]]) < 4.6, 'достаточно ближайшего 8-битного оттенка');
    assert.equal(deriveColor(result, [[base]], 4.5, mode), result);
    assert.equal(mode === 'light' ? toOklch(result.components)[0] < 1 : toOklch(result.components)[0] > 0, true);
  }
  assert.throws(() => deriveColor(white, [[white], [black]], 20, 'light'), /невозможно достичь/);
});

test('Источники производных цветов воспроизводятся явной командой без записи', async () => {
  await deriveSources(true);
});

test('Все ink сохраняют оттенок базы; focus/right/wrong — оттенок макета', async () => {
  const modes = await resolveModes();
  for (const mode of ['light', 'dark']) {
    const value = (role) => modes[mode].find((t) => t.path.join('.') === `color.${role}`).$value;
    const bases = frameVariables(mode);
    for (const [role, base] of [...INK_ROLES.map((r) => [r + '-ink', value(r)]),
      ['focus', parseHex(bases.get('accent'))], ['right', parseHex(bases.get('right'))], ['wrong', parseHex(bases.get('wrong'))]]) {
      const derived = toOklch(value(role).components);
      const original = toOklch(base.components);
      // Hue фиксирован в расчёте; 8-битное sRGB округление даёт отклонение до 0,5°.
      assert.ok(hueDifference(derived[2], original[2]) < 0.5, `${mode}: ${role} hue`);
      assert.ok(mode === 'light' ? derived[0] <= original[0] + 1e-6 : derived[0] >= original[0] - 1e-6, `${mode}: ${role} lightness`);
    }
    for (const role of INK_ROLES) {
      const backgrounds = [...SURFACES.map((r) => [value(r)]), [value('surface'), value(role + '-soft')]];
      assert.ok(minimumContrast(value(role + '-ink'), backgrounds) >= 4.5);
      if (mode === 'light') assert.ok(minimumContrast(value(role + '-ink'), backgrounds) < 4.56, `${role}: цвет затемнён сверх ближайшего шага`);
    }
  }
});

test('Светлый и тёмный ink — обычные цветовые токены; прежние имена остаются', async () => {
  for (const mode of ['light', 'dark']) {
    const source = JSON.parse(await readFile(new URL(`../src/semantic/color.${mode}.json`, import.meta.url), 'utf8'));
    for (const role of INK_ROLES) assert.ok(source.color[role] && source.color[role + '-soft'] && source.color[role + '-ink']);
  }
});
