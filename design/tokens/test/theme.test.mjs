import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { render, resolveModes, split } from '../build.mjs';

test('Стиль B: thin — общая ссылка на 800, glow — нулевой; старый API сохранён', async () => {
  const modes = await resolveModes();
  const source = JSON.parse(await readFile(new URL('../src/semantic/typography.json', import.meta.url), 'utf8'));
  assert.equal(source.font.weight.thin.$value, '{font.weight.extrabold}');
  for (const mode of ['light', 'dark']) {
    const value = (path) => modes[mode].find((t) => t.path.join('.') === path)?.$value;
    assert.equal(value('font.weight.thin'), 800);
    for (const role of ['headword', 'headword-wide', 'score-num', 'session-count', 'exam-name', 'num-compact', 'week-count']) assert.equal(value(`type.${role}`).fontWeight, 800, role);
    for (const field of ['offsetX', 'offsetY', 'blur', 'spread']) assert.equal(value('shadow.glow')[field].value, 0);
    assert.equal(value('shadow.glow').color.alpha, 0);
    assert.equal(value('type.h1').fontWeight, 800);
  }
  const parts = split(modes);
  assert.ok(parts.common.some((t) => t.path.join('.') === 'font.weight.thin'));
  assert.ok(!parts.themed.dark.some((t) => t.path.join('.') === 'font.weight.thin'));
  const { files, frontmatter } = await render();
  const css = files['web/tokens.css'];
  assert.match(css, /--font-weight-thin: 800;/);
  assert.match(css, /--shadow-glow: none;/);
  assert.doesNotMatch(css, /--font-[\w-]+: var\(--font-weight-thin\)/);
  const swift = files['apple/GPTokens.swift'];
  const kotlin = files['android/GpTokens.kt'];
  for (const mode of ['light', 'dark']) assert.match(swift, new RegExp(`static let ${mode} = GPThemeTokens\\([\\s\\S]*?thin: \\.heavy,`));
  assert.match(swift, /headword = GPTextStyle\([^\n]*weight: \.heavy/);
  assert.match(swift, /opacity: 0\), offsetX: 0, offsetY: 0, blur: 0, spread: 0/);
  assert.match(kotlin, /val GpLightTheme = GpThemeTokens\([\s\S]*?thin = FontWeight.W800,/);
  assert.match(kotlin, /val GpDarkTheme = GpThemeTokens\([\s\S]*?thin = FontWeight.W800,/);
  assert.match(kotlin, /alpha = 0f\), offsetX = 0.dp, offsetY = 0.dp, blur = 0.dp, spread = 0.dp/);
  assert.match(swift, /static let light = GPType\(theme: \.light\)/);
  assert.match(swift, /static let dark = GPType\(theme: \.dark\)/);
  assert.match(kotlin, /fun light\([^\n]*GpTypography\(family, monoFamily, GpLightTheme\)/);
  assert.match(kotlin, /fun dark\([^\n]*GpTypography\(family, monoFamily, GpDarkTheme\)/);
  assert.doesNotMatch(frontmatter, /fontWeightDark:|thin-dark:/);
});

test('Все веса, включая устаревший thin, и поля ролей не зависят от темы', async () => {
  const modes = await resolveModes();
  assert.doesNotThrow(() => split(modes));
  for (const [path, change] of [
    ['font.weight.thin', (t) => { t.$value = 700; }],
    ['font.weight.regular', (t) => { t.$value = 500; }],
    ['opacity.disabled', (t) => { t.$value = 0.6; }],
    ['radius.m', (t) => { t.$value.value = 16; }],
    ['type.h1', (t) => { t.$value.fontWeight = 500; }],
    ['type.headword', (t) => { t.$value.fontSize.value = 60; }],
    ['type.headword', (t) => { t.$value.letterSpacing.value = -0.03; }],
    ['type.headword', (t) => { t.$value.fontFamily = ['Onest']; }],
  ]) {
    const changed = structuredClone(modes);
    change(changed.dark.find((t) => t.path.join('.') === path));
    assert.throws(() => split(changed), /нетематический токен .* разный в темах/, path);
  }
  const missing = structuredClone(modes);
  missing.dark = missing.dark.filter((t) => t.path.join('.') !== 'font.weight.thin');
  assert.throws(() => split(missing), /есть в светлой теме, но нет в тёмной/);
  const extra = structuredClone(modes);
  extra.dark.push({ path: ['extra'], $type: 'number', $value: 1 });
  assert.throws(() => split(extra), /в тёмной теме есть токены, которых нет в светлой/);
  const type = structuredClone(modes);
  type.dark.find((t) => t.path.join('.') === 'font.weight.thin').$type = 'number';
  assert.throws(() => split(type), /тип токена .* разный в темах/);
});
