// Проверяем размеры и трекинг всех профилей на трёх выходах, включая оставшиеся общие роли.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveModes, render } from '../build.mjs';

const modes = await resolveModes();
const { files } = await render();
const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const fmt = (n) => Number(n.toFixed(4));
const nativeWeight = {400: '.regular', 500: '.medium', 600: '.semibold', 650: '.semibold', 700: '.bold', 800: '.heavy'};
for (const token of modes.light.filter((t) => t.$type === 'typography')) {
  const role = token.path.at(-1);
  test(`${role}: одинаковый профиль в темах и на трёх выходах`, () => {
    const value = token.$value;
    assert.deepEqual(modes.dark.find((t) => t.path.join('.') === token.path.join('.')).$value, value);
    const base = role.replace(/-wide$/, '');
    const cssRole = role.endsWith('-wide') || !modes.light.some((t) => t.path.join('.') === `type.${role}-wide`) ? role : role + '-base';
    const family = value.fontFamily[0] === 'IBM Plex Mono' ? 'mono' : 'text';
    assert.ok(files['web/tokens.css'].includes(`--font-${cssRole}: ${value.fontWeight} ${fmt(value.fontSize.value / 16)}rem/${value.lineHeight} var(--font-family-${family});`));
    const tracking = fmt(value.letterSpacing.value / (value.letterSpacing.unit === 'em' ? 1 : value.fontSize.value));
    const height = fmt(value.fontSize.value * value.lineHeight);
    assert.ok(files['web/tokens.css'].includes(`--tracking-${cssRole}: ${tracking}em;`));
    const swift = files['apple/GPTokens.swift'].split('\n').find((s) => s.trimStart().startsWith(`${camel(role)} = GPTextStyle(`));
    const kotlin = files['android/GpTokens.kt'].split('\n').find((s) => s.trimStart().startsWith(`val ${camel(role)} = TextStyle(`));
    assert.ok(swift?.includes(`size: ${value.fontSize.value}, lineHeight: ${height}, weight: ${nativeWeight[value.fontWeight]}, tracking: ${tracking}`));
    assert.ok(swift?.includes(`fontFamily: "${value.fontFamily[0]}"`));
    const kotlinWeight = value.fontWeight % 100 === 0 ? `FontWeight.W${value.fontWeight}` : `FontWeight(${value.fontWeight})`;
    assert.ok(kotlin?.includes(`fontSize = ${value.fontSize.value}.sp, lineHeight = ${height}.sp, fontWeight = ${kotlinWeight}, letterSpacing = (${tracking}).em`));
    assert.ok(files['web/tokens.css'].includes(`--font-${base}:`));
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
