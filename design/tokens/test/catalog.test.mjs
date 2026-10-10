// Каталог — независимый эталон: тест читает опубликованный CSS, а не вычисляет ожидания из src.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { render, resolveModes } from '../build.mjs';

const core = await readFile(new URL('../../night-studio/core.css', import.meta.url), 'utf8');
const css = await readFile(new URL('../generated/web/tokens.css', import.meta.url), 'utf8');
const variables = (block) => new Map([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const camel = (name) => name.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());

for (const mode of ['light', 'dark']) {
  test(`${mode}: цвета tokens.css точно совпадают с core.css`, (t) => {
    const section = core.split(`/* ---------- Токены: ${mode === 'light' ? 'светлая' : 'тёмная'} ---------- */`)[1];
    assert.ok(section, 'нет раздела темы в каталоге');
    const expected = variables(section.match(/\.frame[^\{]*\{([^}]+)\}/)[1]);
    const toefl = core.split('/* ---------- Разделы TOEFL (решение Даши 09.10.2026) ---------- */')[1];
    assert.ok(toefl, 'нет раздела TOEFL в каталоге');
    const toeflBlocks = [...toefl.matchAll(/\.frame[^\{]*\{([^}]+)\}/g)];
    const toeflColors = variables(toeflBlocks[mode === 'light' ? 0 : 1][1]);
    assert.equal(toeflColors.size, 8, 'четыре раздела TOEFL и их мягкие подложки');
    for (const [name, value] of toeflColors) expected.set(name, value);
    const selector = mode === 'light' ? /^:root \{([^}]+)\}/m : /^:root\[data-theme="dark"\] \{([^}]+)\}/m;
    const actual = variables(css.match(selector)[1]);
    let colors = 0;
    for (const [name, value] of expected) {
      if (!value.startsWith('#') && !value.startsWith('rgb(')) continue;
      assert.equal(actual.get(`color-${name.replace(/^c-/, '')}`), value, name);
      colors++;
    }
    assert.equal(colors, 35);
    assert.equal(actual.get('font-weight-thin'), expected.get('thin'));
    assert.equal(actual.get('shadow-glow').replace(/^0px /, '0 '), expected.get('glow'));
    if (mode === 'light') {
      for (const [source, token] of [['font-body', 'font-family-text'], ['font-display', 'font-family-text'], ['font-mono', 'font-family-mono']]) {
        assert.equal(actual.get(token).replaceAll("'", ''), expected.get(source).replaceAll("'", ''));
      }
      for (const radius of ['s', 'm', 'l']) assert.equal(actual.get(`radius-${radius}`), expected.get(`r-${radius}`));
    }
    t.diagnostic(`${mode}: ${colors}/${colors} цветов совпадают; thin и glow совпадают; расхождений 0.`);
  });
}

test('Весь договор и роли текста присутствуют на трёх выходах; старых токенов нет', async () => {
  const modes = await resolveModes();
  const { files } = await render();
  const swift = files['apple/GPTokens.swift'];
  const kotlin = files['android/GpTokens.kt'];
  const generatedCss = files['web/tokens.css'];
  const roles = ['bg', 'surface', 'surface-2', 'text', 'text-2', 'text-3', 'line', 'line-strong', 'accent', 'on-accent', 'accent-soft', 'focus', 'right', 'right-soft', 'wrong', 'wrong-soft', 'nav-bg',
    ...['verbal', 'quant', 'essay', 'words', 'exam', 'reading', 'listening', 'writing', 'speaking'].flatMap((role) => [role, `${role}-soft`])];
  for (const mode of ['light', 'dark']) {
    assert.deepEqual(modes[mode].filter((token) => token.path[0] === 'color').map((token) => token.path[1]).sort(), roles.toSorted());
    const kotlinSet = kotlin.match(new RegExp(`val Gp${mode === 'light' ? 'Light' : 'Dark'}Colors = GpColors\\(([\\s\\S]+?)\\n\\)`))[1];
    for (const role of roles) {
      const expected = modes[mode].find((t) => t.path.join('.') === `color.${role}`).$value;
      const channels = expected.components.map((n) => Math.round(n * 255));
      const argb = [Math.round((expected.alpha ?? 1) * 255), ...channels].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
      const asset = JSON.parse(files[`apple/GPColors.xcassets/${camel(role)}.colorset/Contents.json`]);
      assert.equal(asset.colors.length, 2, `${role}: нужны обе темы`);
      const components = asset.colors[mode === 'light' ? 0 : 1].color.components;
      assert.deepEqual(['red', 'green', 'blue'].map((c) => Math.round(Number(components[c]) * 255)), channels, `${mode}: ${role}`);
      assert.ok(Math.abs(Number(components.alpha) - (expected.alpha ?? 1)) <= 0.0001, `${mode}: ${role} alpha`);
      assert.ok(kotlinSet.includes(`    ${camel(role)} = Color(0x${argb}),`), `${mode}: ${role}`);
      assert.ok(files[`android/res/${mode === 'light' ? 'values' : 'values-night'}/gp_colors.xml`].includes(`<color name="gp_${role.replaceAll('-', '_')}">#${argb}</color>`), `${mode}: ${role}`);
    }
  }
  for (const token of modes.light.filter((t) => t.$type === 'typography')) {
    const name = token.path.at(-1);
    const cssRole = name.replace(/-wide$/, '');
    assert.ok(generatedCss.includes(`--font-${cssRole}:`), name);
    assert.ok(swift.includes(`public let ${camel(name)}: GPTextStyle`), name);
    assert.ok(kotlin.includes(`val ${camel(name)} = TextStyle(`), name);
  }
  assert.match(generatedCss, /--font-ipa: [^;]+var\(--font-family-mono\)/);
  assert.match(swift, /ipa = GPTextStyle\([^\n]+fontFamily: "IBM Plex Mono"/);
  assert.match(kotlin, /val ipa = TextStyle\(fontFamily = monoFamily/);
  for (const [path, content] of Object.entries(files)) {
    assert.doesNotMatch(path + '\n' + content, /glass|glow(?:Verbal|Quant|Essay|Words|Exam)|glow-(?:verbal|quant|essay|words|exam)|tabSelected|tab-selected|textSecondary|text-secondary|Tint|\b[\w-]+-tint\b|signInTelegram|sign-in-telegram|stepNode|step-node/, path);
  }
});

test('Семейство формул Quant совпадает с .math и присутствует на всех выходах', async () => {
  const mathRule = core.match(/\.math\s*\{([^}]+)\}/);
  assert.ok(mathRule, 'нет .math в каталоге');
  const family = mathRule[1].match(/font-family:\s*([^;]+);/)[1].replaceAll("'", '');
  const modes = await resolveModes();
  for (const mode of ['light', 'dark']) {
    assert.deepEqual(modes[mode].find((t) => t.path.join('.') === 'font.family.math')?.$value, family.split(', '));
  }
  const { files, frontmatter } = await render();
  assert.ok(files['web/tokens.css'].includes(`--font-family-math: 'Source Serif 4', Georgia, serif;`));
  assert.match(files['apple/GPTokens.swift'], /static let mathFontFamily = "Source Serif 4"/);
  assert.match(files['apple/GPTokens.swift'], /static let mathFontFallbacks = \["Georgia", "serif"\]/);
  assert.match(files['android/GpTokens.kt'], /const val MATH_FONT_FAMILY = "Source Serif 4"/);
  assert.match(files['android/GpTokens.kt'], /val MATH_FONT_FALLBACKS = listOf\("Georgia", "serif"\)/);
  assert.match(frontmatter, /math: "'Source Serif 4', Georgia, serif"/);
});
