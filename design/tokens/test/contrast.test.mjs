// Контраст WCAG AA: поверхности, навигация и мягкие подложки стиля B.
// Полупрозрачные цвета накладываются снизу вверх, как при отрисовке экрана.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, resolveModes } from '../build.mjs';

const modes = await resolveModes();
const { files } = await render();
const cssVariables = Object.fromEntries(['light', 'dark'].map((mode) => {
  const selector = mode === 'light' ? /^:root \{([^}]+)\}/m : /^:root\[data-theme="dark"\] \{([^}]+)\}/m;
  return [mode, new Map([...files['web/tokens.css'].match(selector)[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]))];
}));
function parseColor(raw) {
  assert.ok(raw, 'цвет должен присутствовать на выходе');
  if (raw.startsWith('#')) {
    const bytes = raw.slice(1).match(/../g).map((x) => Number.parseInt(x, 16) / 255);
    return { components: bytes.slice(-3), alpha: bytes.length === 4 ? bytes[0] : 1 };
  }
  const match = raw.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/);
  assert.ok(match, raw);
  return { components: match.slice(1, 4).map((x) => Number(x) / 255), alpha: Number(match[4]) };
}
function color(mode, path, platform) {
  const token = modes[mode].find((t) => t.path.join('.') === path);
  if (!token) throw new Error(`нет токена ${path}`);
  if (platform === 'web') return parseColor(cssVariables[mode].get(path.replaceAll('.', '-')));
  const parts = token.path.slice(token.path[0] === 'color' ? 1 : 0);
  if (platform === 'android') {
    const xml = files[`android/res/${mode === 'light' ? 'values' : 'values-night'}/gp_colors.xml`];
    const name = 'gp_' + parts.join('_').replaceAll('-', '_');
    return parseColor(xml.match(new RegExp(`<color name="${name}">([^<]+)</color>`))?.[1]);
  }
  if (platform === 'apple') {
    const name = parts.join('-').replace(/-([a-z0-9])/g, (_, x) => x.toUpperCase());
    const asset = JSON.parse(files[`apple/GPColors.xcassets/${name}.colorset/Contents.json`]);
    const components = asset.colors[mode === 'light' ? 0 : 1].color.components;
    return { components: ['red', 'green', 'blue'].map((c) => Number(components[c])), alpha: Number(components.alpha) };
  }
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

const SECTIONS = ['verbal', 'quant', 'essay', 'words', 'exam', 'reading', 'listening', 'writing', 'speaking', 'exam-gre', 'exam-toefl', 'exam-sat', 'exam-gmat'];
const BACKGROUNDS = ['bg', 'surface', 'surface-2', 'surface-3'];
const TEXT_BACKGROUNDS = ['bg', 'surface', 'surface-2'];
// Цвета палитры — заливки и подписанная графика. Для текста разделов обязательны ink
// (решение Даши 12.10.2026); томат проверяется как фон кнопки, а не как цвет текста.
// [передний план, слои фона снизу вверх, минимальное отношение контраста]
const PAIRS = [
  ...['text', 'text-2', 'text-3'].flatMap((fg) => TEXT_BACKGROUNDS.map((bg) => [`color.${fg}`, [`color.${bg}`], 4.5])),
  ...SECTIONS.flatMap((fg) => [
    ...BACKGROUNDS.map((bg) => [`color.${fg}-ink`, [`color.${bg}`], 4.5]),
    [`color.${fg}-ink`, ['color.surface', `color.${fg}-soft`], 4.5],
  ]),
  ...['right', 'wrong'].flatMap((fg) => [
    ...BACKGROUNDS.map((bg) => [`color.${fg}`, [`color.${bg}`], 4.5]),
    ...TEXT_BACKGROUNDS.map((bg) => [`color.${fg}`, [`color.${bg}`, `color.${fg}-soft`], 4.5]),
  ]),
  // Маркер выделяет основной текст разбора, а не приглушённые подписи.
  ...TEXT_BACKGROUNDS.map((bg) => ['color.text', [`color.${bg}`, 'color.highlight'], 4.5]),
  ...['exam-gre', 'exam-toefl', 'exam-sat', 'exam-gmat'].map((bg) => ['color.on-accent', [`color.${bg}`], 4.5]),
  ...['text', 'text-3'].map((fg) => [`color.${fg}`, ['color.nav-bg'], 4.5]),
  ['color.on-accent', ['color.accent'], 4.5],
  // Фокус — графический индикатор, его порог 3:1.
  ...BACKGROUNDS.map((bg) => ['color.focus', [`color.${bg}`], 3]),
  ['sign-in.apple.text', ['sign-in.apple.bg'], 4.5],
  ['sign-in.google.text', ['sign-in.google.bg'], 4.5],
];

for (const mode of ['light', 'dark']) {
  for (const platform of ['source', 'web', 'apple', 'android']) {
    for (const [fg, bg, aaMinimum] of PAIRS) {
      const minimum = aaMinimum;
      test(`${mode}/${platform}: ${fg} на ${bg.join(' + ')} ≥ ${minimum}:1`, () => {
        const backgrounds = bg.map((path) => color(mode, path, platform));
        assert.equal(backgrounds[0].alpha ?? 1, 1, 'нижний фон должен быть непрозрачным');
        const value = ratio(flatten([...backgrounds, color(mode, fg, platform)]), flatten(backgrounds));
        assert.ok(value >= minimum, `${value.toFixed(4)}:1 < ${minimum}:1`);
      });
    }
  }
}
