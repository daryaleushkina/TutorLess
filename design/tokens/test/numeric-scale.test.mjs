import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCatalog, catalogStyle } from './catalog-css.mjs';
import { render, resolveModes, split, resolveTypographySources } from '../build.mjs';

const fixtures = JSON.parse(await readFile(new URL('./fixtures/numeric-scale.json', import.meta.url), 'utf8'));
const src = JSON.parse(await readFile(new URL('../src/semantic/typography.json', import.meta.url), 'utf8'));
const modes = await resolveModes();
const { files } = await render();
const catalog = await loadCatalog(fixtures.map((r) => r.file));
const steps = {
  'num-s': [48, 60, 1],
  'num-m': [56, 72, 1],
  'num-l': [70, 88, 1],
  'num-xl': [88, 120, 0.95],
  'num-xxl': [104, 144, 0.9],
};
const token = (mode, role) => modes[mode].find((t) => t.path.join('.') === `type.${role}`);
const camel = (role) => role.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const fmt = (value) => Number(value.toFixed(4));

test('Пять ступеней крупных чисел, один дополнительный малый профиль и одно слово-заголовок', () => {
  assert.deepEqual(Object.keys(src.type).filter((r) => /^num-(?:s|m|l|xl|xxl)$/.test(r)).sort(), Object.keys(steps).sort());
  for (const [name, [size, wideSize, height]] of Object.entries(steps)) {
    for (const [role, expected] of [[name, size], [name + '-wide', wideSize]]) {
      assert.equal(token('light', role)?.$value.fontSize.value, expected);
      assert.equal(token('light', role)?.$value.lineHeight, height);
      assert.deepEqual(token('light', role)?.$value.letterSpacing, { value: -0.04, unit: 'em' });
    }
  }
  assert.equal(token('light', 'num-compact')?.$value.fontSize.value, 36);
  assert.equal(token('light', 'num-compact-wide')?.$value.fontSize.value, 52);
  assert.equal(token('light', 'word-title')?.$value.fontSize.value, 40);
  assert.equal(token('light', 'word-title-wide')?.$value.fontSize.value, 56);
  for (const name of ['score-hero', 'score-hero-sm', 'speaking-score', 'countdown', 'stat-hero', 'word-score', 'word-learning-score', 'essay-score', 'score-range', 'section-score', 'word-prompt', 'word-prompt-sm', 'word-card', 'word-learning-title', 'quantity', 'timer', 'count-sm', 'count-inline', 'count-lg', 'review-num']) {
    assert.ok(!src.type[name] && !src.type[name + '-wide'], `осталась роль экрана ${name}`);
  }
});

for (const f of fixtures) {
  for (const wide of [false, true]) {
    const role = wide ? f.wideRole : f.role;
    const before = wide ? f.wideBefore : f.before;
    if (!role) continue;
    test(`${f.file}: ${f.selector} / ${wide ? 'wide' : 'phone'} → ${role}, сдвиг ≤10%`, () => {
      const value = token('light', role)?.$value;
      assert.ok(value, `нет type.${role}`);
      const style = catalogStyle(catalog, f.file, f.selector, wide);
      assert.equal(style.size, value.fontSize.value);
      assert.equal(style.height, value.lineHeight);
      assert.deepEqual(style.tracking, value.letterSpacing);
      assert.equal(style.weight, 'thin');
      assert.ok(Math.abs(style.size / before - 1) <= 0.1 + 1e-9, `${before} → ${style.size}`);
      if (f.category === 'large') {
        const candidates = Object.values(steps).map((s) => s[wide ? 1 : 0]);
        assert.equal(Math.abs(style.size - before), Math.min(...candidates.map((size) => Math.abs(size - before))), 'выбрана не ближайшая ступень');
      }
      for (const [mode, weight] of [['light', 300], ['dark', 200]]) {
        const resolved = token(mode, role);
        assert.equal(resolved.$value.fontWeight, weight);
        assert.equal(resolved.typographySource.fontWeight, '{font.weight.thin}');
        assert.deepEqual({ ...resolved.$value, fontWeight: 300 }, value);
      }
      const cssRole = role.endsWith('-wide') || !src.type[role + '-wide'] ? role : role + '-base';
      const height = fmt(style.size * style.height);
      const tracking = fmt(style.tracking.value / (style.tracking.unit === 'em' ? 1 : style.size));
      assert.ok(files['web/tokens.css'].includes(`--font-${cssRole}: var(--font-weight-thin) ${fmt(style.size / 16)}rem/${style.height} var(--font-family-text);`));
      assert.ok(files['web/tokens.css'].includes(`--tracking-${cssRole}: ${tracking}em;`));
      assert.match(files['apple/GPTokens.swift'], new RegExp(`${camel(role)} = GPTextStyle\\(size: ${style.size}, lineHeight: ${height}, weight: theme.thin,`));
      assert.ok(files['android/GpTokens.kt'].includes(`val ${camel(role)} = TextStyle(fontFamily = family, fontSize = ${style.size}.sp, lineHeight = ${height}.sp, fontWeight = theme.thin,`));
    });
  }
}

test('Псевдонимы ядра — ссылки на ступени; thin тематичен и остальные поля строго совпадают', () => {
  for (const [alias, target] of [['headword','num-m'], ['headword-wide','num-l-wide'], ['exam-name','num-s'], ['exam-name-wide','num-s-wide']]) {
    assert.equal(src.type[alias].$value, `{type.${target}}`);
    assert.deepEqual(token('light', alias).$value, token('light', target).$value);
    assert.deepEqual(token('dark', alias).$value, token('dark', target).$value);
    assert.match(files['web/tokens.css'], new RegExp(`--font-${alias.replace(/-wide$/, '')}: var\\(--font-weight-thin\\)`));
    assert.match(files['apple/GPTokens.swift'], new RegExp(`${camel(alias)} = GPTextStyle\\([^\\n]*weight: theme.thin`));
    assert.match(files['android/GpTokens.kt'], new RegExp(`val ${camel(alias)} = TextStyle\\([^\\n]*fontWeight = theme.thin`));
    const changed = structuredClone(modes);
    changed.dark.find((t) => t.path.join('.') === `type.${alias}`).$value.fontSize.value++;
    assert.throws(() => split(changed), /нетематический токен .* разный в темах/);
  }
});

test('Цепочки ссылок сохраняют происхождение thin и mono, исходная ссылка не переписывается', () => {
  const primary = { path: ['type', 'primary'], $type: 'typography', original: { $value: { fontFamily: '{font.family.mono}', fontWeight: '{font.weight.thin}' } } };
  const alias = (name, target) => ({ path: ['type', name], $type: 'typography', original: { $value: `{type.${target}}` } });
  const plain = { path: ['space', 's1'], $type: 'dimension' };
  const result = resolveTypographySources([primary, alias('first', 'primary'), alias('second', 'first'), plain]);
  assert.deepEqual(result[2].typographySource, primary.original.$value);
  assert.equal(result[2].original.$value, '{type.first}');
  assert.equal(result[3], plain);
  assert.throws(() => resolveTypographySources([alias('first','second'),alias('second','first')]), /цикл ссылок/);
  assert.throws(() => resolveTypographySources([alias('first','missing')]), /нет роли типографики/);
  assert.throws(() => resolveTypographySources([alias('first','number'), { path: ['type','number'], $type: 'number' }]), /нет роли типографики/);
});

test('Обычный текст прошлой попытки не наследует профиль тонкого числа', () => {
  const style = catalogStyle(catalog, 'x', '.x-row-past .x-row-stat b', false, ['.x-row-stat b']);
  assert.equal(style.size, 16);
  assert.equal(style.weight, 500);
  assert.equal(style.height, 1.1);
  assert.deepEqual(style.tracking, { value: -0.08, unit: 'px' });
});
