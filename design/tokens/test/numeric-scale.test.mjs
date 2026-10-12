import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { render, resolveModes, split, resolveTypographySources } from '../build.mjs';

const source = JSON.parse(await readFile(new URL('../src/semantic/typography.json', import.meta.url), 'utf8'));
const modes = await resolveModes();
const { files } = await render();
const steps = ['s', 'm', 'l', 'xl', 'xxl'];
const token = (mode, role) => modes[mode].find((t) => t.path.join('.') === `type.${role}`);
const camel = (role) => role.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

test('Пять ступеней чисел сохранены: Onest 800, плотный трекинг, обе темы совпадают', () => {
  assert.deepEqual(Object.keys(source.type).filter((r) => /^num-(?:s|m|l|xl|xxl)$/.test(r)).sort(), steps.map((s) => 'num-' + s).sort());
  const roles = [...steps.flatMap((s) => ['num-' + s, 'num-' + s + '-wide']), 'num-compact', 'num-compact-wide', 'score-num', 'score-num-wide', 'session-count', 'session-count-wide', 'week-count', 'word-title', 'word-title-wide'];
  for (const role of roles) {
    const light = token('light', role).$value;
    assert.deepEqual(token('dark', role).$value, light, role);
    assert.equal(light.fontFamily[0], 'Onest', role);
    assert.equal(light.fontWeight, 800, role);
    assert.ok(light.letterSpacing.value <= -0.02, role);
    assert.notEqual(token('light', role).typographySource.fontWeight, '{font.weight.thin}', role);
    assert.match(files['apple/GPTokens.swift'], new RegExp(`${camel(role)} = GPTextStyle\\([^\\n]*weight: \\.heavy`));
    assert.match(files['android/GpTokens.kt'], new RegExp(`val ${camel(role)} = TextStyle\\([^\\n]*fontWeight = FontWeight.W800`));
  }
});

test('Псевдонимы наследуют профиль B; тема не может менять их параметры', () => {
  for (const [alias, target] of [['headword','num-m'], ['headword-wide','num-m-wide'], ['h1-compact','h1'], ['prompt-title-wide','start-title']]) {
    assert.equal(source.type[alias].$value, `{type.${target}}`);
    assert.deepEqual(token('light', alias).$value, token('light', target).$value);
    assert.deepEqual(token('dark', alias).$value, token('dark', target).$value);
    const changed = structuredClone(modes);
    changed.dark.find((t) => t.path.join('.') === `type.${alias}`).$value.fontSize.value++;
    assert.throws(() => split(changed), /нетематический токен .* разный в темах/);
  }
});

test('Цепочки ссылок сохраняют происхождение веса и mono, исходная ссылка не переписывается', () => {
  const primary = { path: ['type', 'primary'], $type: 'typography', original: { $value: { fontFamily: '{font.family.mono}', fontWeight: '{font.weight.extrabold}' } } };
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
