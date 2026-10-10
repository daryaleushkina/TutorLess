import test from 'node:test';
import assert from 'node:assert/strict';
import { render, resolveModes, split } from '../build.mjs';

test('Тонкие роли и свечение меняются вместе с темой на всех платформах', async () => {
  const modes = await resolveModes();
  for (const [mode, weight, blur, spread, alpha] of [
    ['light', 300, 28, -8, 0.4], ['dark', 200, 32, -6, 0.5],
  ]) {
    const value = (path) => modes[mode].find((t) => t.path.join('.') === path)?.$value;
    assert.equal(value('font.weight.thin'), weight);
    for (const role of ['headword', 'headword-wide', 'score-num', 'section-stat', 'session-count', 'exam-name']) {
      assert.equal(value(`type.${role}`)?.fontWeight, weight, `${mode}: ${role}`);
    }
    assert.equal(value('shadow.glow')?.blur.value, blur);
    assert.equal(value('shadow.glow')?.spread.value, spread);
    assert.equal(value('shadow.glow')?.color.alpha, alpha);
    assert.equal(value('type.h1')?.fontSize.value, 34);
    assert.equal(value('type.h1')?.fontWeight, 600);
  }
  const { files } = await render();
  const css = files['web/tokens.css'];
  assert.match(css, /:root \{[^}]*--font-weight-thin: 300;/s);
  assert.match(css, /:root\[data-theme="dark"\] \{[^}]*--font-weight-thin: 200;/s);
  assert.match(css, /:root:not\(\[data-theme="light"\]\) \{[^}]*--font-weight-thin: 200;/s);
  assert.match(css, /--font-headword: var\(--font-weight-thin\)/);
  assert.match(css, /--shadow-glow: 0px 10px 28px -8px rgb\(59 63 176 \/ 0.4\)/);
  assert.match(css, /--shadow-glow: 0px 10px 32px -6px rgb\(92 207 255 \/ 0.5\)/);
  const swift = files['apple/GPTokens.swift'];
  assert.match(swift, /static let light = GPThemeTokens\([\s\S]*?thin: \.light,/);
  assert.match(swift, /static let dark = GPThemeTokens\([\s\S]*?thin: \.ultraLight,/);
  assert.match(swift, /static let light = GPType\(theme: \.light\)/);
  assert.match(swift, /static let dark = GPType\(theme: \.dark\)/);
  assert.match(swift, /headword = GPTextStyle\([^\n]*weight: theme.thin/);
  assert.match(swift, /blur: 28, spread: -8/);
  assert.match(swift, /blur: 32, spread: -6/);
  const kotlin = files['android/GpTokens.kt'];
  assert.match(kotlin, /val GpLightTheme = GpThemeTokens\([\s\S]*?thin = FontWeight.W300,/);
  assert.match(kotlin, /val GpDarkTheme = GpThemeTokens\([\s\S]*?thin = FontWeight.W200,/);
  assert.match(kotlin, /fun light\([^\n]*GpTypography\(family, monoFamily, GpLightTheme\)/);
  assert.match(kotlin, /fun dark\([^\n]*GpTypography\(family, monoFamily, GpDarkTheme\)/);
  assert.match(kotlin, /val headword = TextStyle\([^\n]*fontWeight = theme.thin/);
  assert.match(kotlin, /blur = 28.dp, spread = -8.dp/);
  assert.match(kotlin, /blur = 32.dp, spread = -6.dp/);
});

test('Различаться может только thin, а не остальные веса и поля роли', async () => {
  const modes = await resolveModes();
  assert.doesNotThrow(() => split(modes));
  for (const [path, change] of [
    ['font.weight.regular', (t) => { t.$value = 500; }],
    ['opacity.disabled', (t) => { t.$value = 0.6; }],
    ['radius.m', (t) => { t.$value.value = 18; }],
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
