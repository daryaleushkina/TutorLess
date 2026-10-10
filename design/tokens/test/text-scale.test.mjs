import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveModes, render } from '../build.mjs';
import { loadCatalog, catalogStyle } from './catalog-css.mjs';

const fixtures = JSON.parse(await readFile(new URL('./fixtures/text-normalization.json', import.meta.url), 'utf8'));
const catalog = await loadCatalog(fixtures.map((r) => r.file));
const modes = await resolveModes();
const { files } = await render();
const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const fmt = (n) => Number(n.toFixed(4));

for (const { file, selector, wide, role, before } of fixtures) {
  test(`${file}: ${selector} / ${wide ? 'wide' : 'phone'} → type.${role}`, () => {
    const style = catalogStyle(catalog, file, selector, wide);
    const token = modes.light.find((t) => t.path.join('.') === `type.${role}`);
    assert.ok(token, `нет type.${role}`);
    const value = token.$value;
    assert.equal(style.size, value.fontSize.value);
    assert.equal(style.height, value.lineHeight);
    assert.equal(style.weight, value.fontWeight);
    assert.deepEqual(style.tracking, value.letterSpacing);
    assert.ok(Math.abs(style.size - before.size) <= 2 + 1e-9, 'размер сдвинут больше 2 px');
    assert.ok(Math.abs(style.height - before.height) <= 0.1 + 1e-9, 'интерлиньяж сдвинут больше 0,1');
    assert.equal(style.weight, before.weight);
    const dark = modes.dark.find((t) => t.path.join('.') === `type.${role}`);
    assert.deepEqual(dark.$value, value, 'обычный текст не зависит от темы');
    const cssRole = role.replace(/-wide$/, '');
    const css = files['web/tokens.css'].split('@media (min-width: 900px)')[role.endsWith('-wide') ? 1 : 0];
    assert.ok(css.includes(`--font-${cssRole}: ${value.fontWeight} ${fmt(value.fontSize.value / 16)}rem/${value.lineHeight} var(--font-family-text);`));
    const tracking = fmt(value.letterSpacing.value / (value.letterSpacing.unit === 'em' ? 1 : value.fontSize.value));
    assert.ok(css.includes(`--tracking-${cssRole}: ${tracking}em;`));
    const swift = files['apple/GPTokens.swift'].split('\n').find((s) => s.trimStart().startsWith(`${camel(role)} = GPTextStyle(`));
    const kotlin = files['android/GpTokens.kt'].split('\n').find((s) => s.trimStart().startsWith(`val ${camel(role)} = TextStyle(`));
    assert.ok(swift?.includes(`size: ${style.size}, lineHeight: ${fmt(style.size * style.height)}`));
    assert.ok(kotlin?.includes(`fontSize = ${style.size}.sp, lineHeight = ${fmt(style.size * style.height)}.sp`));
  });
}

test('Обычные роли отдельных экранов удалены, общие исключения остаются', async () => {
  const src = JSON.parse(await readFile(new URL('../src/semantic/typography.json', import.meta.url), 'utf8'));
  for (const role of ['passage', 'sentence', 'condition', 'label', 'intro', 'q-text-sm', 'word-phrase', 'word-letter', 'word-input', 'math-value', 'meta-strong', 'question-label', 'stat-caption', 'count-caption', 'text-entry', 'opt-sm', 'word-translation', 'complete-words-cell', 'progress-title', 'score-hero-label', 'score-hero-sm-label']) {
    assert.ok(!src.type[role], `осталась роль на селектор: ${role}`);
    assert.ok(!src.type[role + '-wide'], `осталась роль на селектор: ${role}-wide`);
  }
  for (const role of ['complete-words-text', 'sentence-assembly']) assert.ok(src.type[role]);
  assert.equal(src.type['prompt-title-wide'].$value, '{type.start-title}');
  assert.equal(src.type['h1-compact'].$value, '{type.h1}');
});
