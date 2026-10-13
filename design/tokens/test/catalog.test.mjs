// Каталог — независимый эталон: тест читает опубликованный CSS, а не вычисляет ожидания из src.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cssColor, render, resolveModes } from '../build.mjs';

import { css as appCss, frameVariables, textStyle, TYPE_SELECTORS } from './app-b-css.mjs';
const css = await readFile(new URL('../generated/web/tokens.css', import.meta.url), 'utf8');
const variables = (block) => new Map([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const camel = (name) => name.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
const COLOR_MAPPING = {
  bg: 'bg', surface: 'surface', 'surface-2': 'surface-2', 'surface-3': 'surface-3',
  text: 'ink', 'text-2': 'ink-2', 'text-3': 'ink-3', line: 'line', 'line-strong': 'line-2',
  accent: 'accent', 'on-accent': 'on-accent', 'nav-bg': 'bg',
  'right-soft': 'right-soft', 'wrong-soft': 'wrong-soft',
  highlight: 'hl', verbal: 'c-verbal', quant: 'c-quant', essay: 'c-essay', words: 'c-words', exam: 'c-exam',
  reading: 'sky', listening: 'mint', writing: 'mango', speaking: 'pink',
  'exam-gre': 'mango', 'exam-toefl': 'mint', 'exam-sat': 'lilac', 'exam-gmat': 'sky',
};
for (const mode of ['light', 'dark']) {
  test(`${mode}: цвета и радиусы точно совпадают с app-b/index.html`, (t) => {
    const expected = frameVariables(mode);
    const selector = mode === 'light' ? /^:root \{([^}]+)\}/m : /^:root\[data-theme="dark"\] \{([^}]+)\}/m;
    const actual = variables(css.match(selector)[1]);
    for (const [token, variable] of Object.entries(COLOR_MAPPING)) assert.equal(actual.get(`color-${token}`), expected.get(variable), token);
    if (mode === 'light') {
      assert.equal(actual.get('font-family-text').replaceAll("'", ''), expected.get('font').replaceAll("'", ''));
      for (const radius of ['s', 'm', 'l']) assert.equal(actual.get(`radius-${radius}`), expected.get(`r-${radius}`));
    }
    t.diagnostic(`${mode}: ${Object.keys(COLOR_MAPPING).length} цветов совпадают с макетом, расхождений 0.`);
  });
}

test('Роли текста совпадают с правилами Onest в app-b/index.html', async () => {
  const modes = await resolveModes();
  for (const [role, selectors] of Object.entries(TYPE_SELECTORS)) {
    const expected = textStyle(selectors, role.endsWith('-wide'));
    for (const mode of ['light', 'dark']) {
      const actual = modes[mode].find((t) => t.path.join('.') === `type.${role}`).$value;
      assert.equal(actual.fontSize.value, expected.size, role);
      assert.equal(actual.fontWeight, expected.weight, role);
      assert.equal(actual.lineHeight, expected.height, role);
      assert.deepEqual(actual.letterSpacing, { value: expected.tracking, unit: 'em' }, role);
    }
  }
});

test('Размеры элементов, поля и отклик на нажатие совпадают с B', async () => {
  const modes = await resolveModes();
  const numberIn = (selector, property, index = 0) => {
    const rule = [...appCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].split(',').some((s) => s.trim() === selector));
    assert.ok(rule, selector);
    const raw = rule[2].split(';').find((s) => s.trim().startsWith(property + ':')).split(':')[1];
    return Number(raw.match(/-?\d+(?:\.\d+)?/g)[index]);
  };
  const dimensions = [
    ['size.button', '.btn', 'min-height'], ['size.opt', '.opt', 'min-height'],
    ['size.icon-sm', '.ic-sm', 'width'], ['size.section-mark', '.dot', 'width'],
    ['size.session-bar', '.bar', 'height'], ['layout.gutter', '.main', 'padding', 1],
    ['layout.gutter-wide', '.device-desktop .main', 'padding', 1],
    ['layout.main-top', '.main', 'padding'], ['layout.main-bottom-nav', '.has-nav .main', 'padding-bottom'],
    ['layout.nav-bottom', '.nav', 'padding', 2], ['layout.sidebar-width', '.device-desktop .nav', 'width'],
  ];
  for (const [path, selector, property, index] of dimensions) {
    const expected = numberIn(selector, property, index);
    for (const mode of ['light', 'dark']) assert.equal(modes[mode].find((t) => t.path.join('.') === path).$value.value, expected, path);
  }
  const value = (path) => modes.light.find((t) => t.path.join('.') === path).$value;
  assert.equal(value('motion.press-scale'), numberIn('.btn:active', 'transform'));
  assert.equal(value('motion.duration.press').value, numberIn('.btn', 'transition'));
  assert.deepEqual(value('motion.easing.out'), frameVariables('light').get('ease-out').match(/[\d.]+/g).map(Number));
});

test('Весь договор и роли текста присутствуют на трёх выходах; удалённых токенов нет', async () => {
  const modes = await resolveModes();
  const { files } = await render();
  const swift = files['apple/GPTokens.swift'];
  const kotlin = files['android/GpTokens.kt'];
  const generatedCss = files['web/tokens.css'];
  const roles = ['bg', 'surface', 'surface-2', 'surface-3', 'highlight', 'text', 'text-2', 'text-3', 'line', 'line-strong', 'accent', 'on-accent', 'accent-soft', 'focus', 'right', 'right-soft', 'wrong', 'wrong-soft', 'nav-bg',
    ...['verbal', 'quant', 'essay', 'words', 'exam', 'reading', 'listening', 'writing', 'speaking', 'exam-gre', 'exam-toefl', 'exam-sat', 'exam-gmat'].flatMap((role) => [role, `${role}-soft`, `${role}-ink`])];
  for (const mode of ['light', 'dark']) {
    assert.deepEqual(modes[mode].filter((token) => token.path[0] === 'color').map((token) => token.path[1]).sort(), roles.toSorted());
    const kotlinSet = kotlin.match(new RegExp(`val Gp${mode === 'light' ? 'Light' : 'Dark'}Colors = GpColors\\(([\\s\\S]+?)\\n\\)`))[1];
    const cssSelector = mode === 'light' ? /^:root \{([^}]+)\}/m : /^:root\[data-theme="dark"\] \{([^}]+)\}/m;
    const actualCss = variables(generatedCss.match(cssSelector)[1]);
    for (const role of roles) {
      const expected = modes[mode].find((t) => t.path.join('.') === `color.${role}`).$value;
      assert.equal(actualCss.get(`color-${role}`), cssColor(expected), `${mode}: ${role} CSS`);
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

test('Семейство формул Quant сохранено на всех выходах', async () => {
  const family = 'Source Serif 4, Georgia, serif';
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

test('Имена токенов, уже используемые платформами, сохранены', async () => {
  const previous = JSON.parse(await readFile(new URL('./fixtures/compatible-paths.json', import.meta.url), 'utf8'));
  const modes = await resolveModes();
  for (const mode of ['light', 'dark']) {
    const names = new Set(modes[mode].map((t) => t.path.join('.')));
    for (const name of previous) assert.ok(names.has(name), `${mode}: удалён ${name}`);
  }
});
