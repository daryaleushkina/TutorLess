import test from 'node:test';
import assert from 'node:assert/strict';
import { render, resolveModes, split } from '../build.mjs';

const SYSTEM = ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'system-ui', 'sans-serif'];
const APPLE = [
  ['font-family', 'fontFamily', SYSTEM],
  ['font-size', 'dimension', { value: 17, unit: 'px' }],
  ['font-weight', 'fontWeight', 500],
  ['line-height', 'dimension', { value: 20, unit: 'px' }],
];
const GOOGLE = [
  ['font-family', 'fontFamily', ['Roboto', 'sans-serif']],
  ['font-size', 'dimension', { value: 14, unit: 'px' }],
  ['font-weight', 'fontWeight', 500],
  ['tracking', 'dimension', { value: 0.25, unit: 'px' }],
  ['line-height', 'dimension', { value: 20, unit: 'px' }],
];
const PROVIDERS = [['apple', APPLE], ['google', GOOGLE]];
const paths = ['font.family.system', ...PROVIDERS.flatMap(([provider, tokens]) => tokens.map(([name]) => `sign-in.${provider}.${name}`))];

test('Системное семейство и типографика Apple и Google — общие токены обеих тем', async () => {
  const modes = await resolveModes();
  for (const mode of ['light', 'dark']) {
    const token = (path) => modes[mode].find((t) => t.path.join('.') === path);
    assert.equal(token('font.family.system')?.$type, 'fontFamily');
    assert.deepEqual(token('font.family.system')?.$value, SYSTEM);
    for (const [provider, tokens] of PROVIDERS) {
      for (const [name, type, value] of tokens) {
        assert.equal(token(`sign-in.${provider}.${name}`)?.$type, type, `${mode}: ${provider}.${name}`);
        assert.deepEqual(token(`sign-in.${provider}.${name}`)?.$value, value, `${mode}: ${provider}.${name}`);
      }
    }
    assert.equal(token('sign-in.apple.font-family')?.original.$value, '{font.family.system}');
  }
  const { common, themed } = split(modes);
  for (const path of paths) {
    assert.ok(common.some((t) => t.path.join('.') === path), path);
    for (const mode of ['light', 'dark']) assert.ok(!themed[mode].some((t) => t.path.join('.') === path), path);
  }
});

test('Общие токены входа не могут различаться между темами', async () => {
  const modes = await resolveModes();
  for (const path of paths) {
    const changed = structuredClone(modes);
    const token = changed.dark.find((t) => t.path.join('.') === path);
    assert.ok(token, path);
    if (token.$type === 'fontFamily') token.$value = ['Other'];
    else if (token.$type === 'dimension') token.$value.value += 1;
    else token.$value += 100;
    assert.throws(() => split(changed), /нетематический токен .* разный в темах/, path);
  }
});

test('Шрифты входа выходят в CSS и нативные типы, не попадая в цвета', async () => {
  const { files, frontmatter } = await render();
  const css = files['web/tokens.css'];
  const root = css.match(/^:root \{([^}]+)\}/m)[1];
  assert.ok(root.includes("--font-family-system: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;"));
  assert.ok(root.includes('--sign-in-google-font-family: Roboto, sans-serif;'));
  assert.ok(root.includes('--sign-in-google-font-size: 14px;'));
  assert.ok(root.includes('--sign-in-google-font-weight: 500;'));
  assert.ok(root.includes('--sign-in-google-tracking: 0.25px;'));
  assert.ok(root.includes('--sign-in-google-line-height: 20px;'));
  assert.ok(root.includes("--sign-in-apple-font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;"));
  assert.ok(root.includes('--sign-in-apple-font-size: 17px;'));
  assert.ok(root.includes('--sign-in-apple-font-weight: 500;'));
  assert.ok(root.includes('--sign-in-apple-line-height: 20px;'));
  const dark = css.match(/^:root\[data-theme="dark"\] \{([^}]+)\}/m)[1];
  assert.doesNotMatch(dark, /--font-family-system|--sign-in-(?:apple|google)-(?:font-|tracking|line-height)/);
  const swift = files['apple/GPTokens.swift'];
  assert.match(swift, /static func systemFont\(size: CGFloat, weight: Font.Weight = \.regular\) -> Font \{\s*\.system\(size: size, weight: weight\)/);
  assert.match(swift, /enum GPSignInGoogle \{[\s\S]*?fontFamily = "Roboto"[\s\S]*?fontFallbacks = \["sans-serif"\][\s\S]*?fontSize: CGFloat = 14[\s\S]*?fontWeight: Font.Weight = \.medium[\s\S]*?tracking: CGFloat = 0.25[\s\S]*?lineHeight: CGFloat = 20/);
  assert.match(swift, /enum GPSignInApple \{[\s\S]*?fontSize: CGFloat = 17[\s\S]*?fontWeight: Font.Weight = \.medium[\s\S]*?lineHeight: CGFloat = 20[\s\S]*?var font: Font \{\s*GPType.systemFont\(size: fontSize, weight: fontWeight\)/);
  const kotlin = files['android/GpTokens.kt'];
  assert.match(kotlin, /val SYSTEM_FONT_FAMILY = FontFamily.Default/);
  assert.match(kotlin, /object GpSignInGoogle \{[\s\S]*?FONT_FAMILY = "Roboto"[\s\S]*?FONT_FALLBACKS = listOf\("sans-serif"\)[\s\S]*?fontSize = 14.sp[\s\S]*?fontWeight = FontWeight.W500[\s\S]*?tracking = 0.25.sp[\s\S]*?lineHeight = 20.sp/);
  assert.match(kotlin, /object GpSignInApple \{[\s\S]*?fontFamily = GpTypography.SYSTEM_FONT_FAMILY[\s\S]*?fontSize = 17.sp[\s\S]*?fontWeight = FontWeight.W500[\s\S]*?lineHeight = 20.sp/);
  assert.match(frontmatter, /system: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"/);
  assert.match(frontmatter, /  google:\n    fontFamily: "Roboto, sans-serif"\n    fontSize: "14px"\n    fontWeight: 500\n    tracking: "0.25px"\n    lineHeight: "20px"/);
  assert.match(frontmatter, /  apple:\n    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"\n    fontSize: "17px"\n    fontWeight: 500\n    lineHeight: "20px"/);
  for (const path of Object.keys(files)) assert.doesNotMatch(path, /signIn(?:Apple|Google)(?:Font|Tracking|LineHeight).*colorset/);
  for (const mode of ['values', 'values-night']) {
    assert.doesNotMatch(files[`android/res/${mode}/gp_colors.xml`], /gp_sign_in_(?:apple|google)_(?:font_|tracking|line_height)/);
  }
});
