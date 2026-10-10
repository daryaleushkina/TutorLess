// Контраст WCAG AA: поверхности, навигация и мягкие подложки «Ночной студии».
// Полупрозрачные цвета накладываются снизу вверх, как при отрисовке экрана.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveModes } from '../build.mjs';

const modes = await resolveModes();
function color(mode, path) {
  const token = modes[mode].find((t) => t.path.join('.') === path);
  if (!token) throw new Error(`нет токена ${path}`);
  return token.$value;
}
const lin = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function flatten(layers) {
  let result = layers[0].components;
  for (const layer of layers.slice(1)) {
    const alpha = layer.alpha ?? 1;
    result = layer.components.map((x, i) => x * alpha + result[i] * (1 - alpha));
  }
  return result;
}
function ratio(fg, bg) {
  const [high, low] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

const TOEFL_SECTIONS = ['reading', 'listening', 'writing', 'speaking'];
const SECTIONS = ['verbal', 'quant', 'essay', 'words', 'exam', ...TOEFL_SECTIONS];
const FOREGROUNDS = ['text', 'text-2', 'text-3', ...SECTIONS, 'right', 'wrong'];
const BACKGROUNDS = ['bg', 'surface', 'surface-2'];
// [передний план, слои фона снизу вверх, минимальное отношение контраста]
const PAIRS = [
  ...FOREGROUNDS.flatMap((fg) => BACKGROUNDS.map((bg) => [`color.${fg}`, [`color.${bg}`], 4.5])),
  ...[...SECTIONS, 'right', 'wrong'].map((fg) => [`color.${fg}`, ['color.surface', `color.${fg}-soft`], 4.5]),
  ...[...BACKGROUNDS, 'nav-bg'].map((bg) => ['color.accent', [`color.${bg}`], 4.5]),
  ...['text', 'text-3'].map((fg) => [`color.${fg}`, ['color.nav-bg'], 4.5]),
  ['color.on-accent', ['color.accent'], 4.5],
  // Фокус — графический индикатор, его порог 3:1.
  ...BACKGROUNDS.map((bg) => ['color.focus', [`color.${bg}`], 3]),
  ['sign-in.apple.text', ['sign-in.apple.bg'], 4.5],
  ['sign-in.google.text', ['sign-in.google.bg'], 4.5],
];

for (const mode of ['light', 'dark']) {
  for (const [fg, bg, aaMinimum] of PAIRS) {
    // Светлые цвета TOEFL подобраны под «Лаванду» с запасом 0,1 к AA (решение Даши 10.10.2026).
    const minimum = mode === 'light' && TOEFL_SECTIONS.some((section) => fg === `color.${section}`) ? 4.6 : aaMinimum;
    test(`${mode}: ${fg} на ${bg.join(' + ')} ≥ ${minimum}:1`, () => {
      const backgrounds = bg.map((path) => color(mode, path));
      assert.equal(backgrounds[0].alpha ?? 1, 1, 'нижний фон должен быть непрозрачным');
      const value = ratio(flatten([...backgrounds, color(mode, fg)]), flatten(backgrounds));
      assert.ok(value >= minimum, `${value.toFixed(4)}:1 < ${minimum}:1`);
    });
  }
}
