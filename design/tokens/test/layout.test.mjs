import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { render, resolveModes, split } from '../build.mjs';

const WIDTHS = [['auth-column-max', 'authColumnMax', 400], ['text-max', 'textMax', 320], ['session-max', 'sessionMax', 1040]];

test('Ширины входа, поясняющего текста и сессии — отдельные общие роли', async () => {
  const modes = await resolveModes();
  const signin = await readFile(new URL('../../night-studio/screens/t.css', import.meta.url), 'utf8');
  const catalogWidth = Number(signin.match(/\.t-signin-buttons\s*\{[^}]*\bwidth:\s*(\d+)px/)[1]);
  assert.equal(catalogWidth, 400);
  for (const mode of ['light', 'dark']) {
    for (const [role, , width] of WIDTHS) {
      const token = modes[mode].find((t) => t.path.join('.') === `layout.${role}`);
      assert.equal(token?.$type, 'dimension', role);
      assert.deepEqual(token?.$value, { value: width, unit: 'px' }, role);
      if (role === 'auth-column-max') assert.equal(token.$value.value, catalogWidth);
    }
    assert.equal(modes[mode].find((t) => t.path.join('.') === 'layout.content-max').$value.value, 720);
  }
  const { common } = split(modes);
  for (const [role] of WIDTHS) assert.ok(common.some((t) => t.path.join('.') === `layout.${role}`), role);
});

test('Ширины по ролям выводятся в CSS, Swift, Compose и YAML', async () => {
  const { files, frontmatter } = await render();
  const root = files['web/tokens.css'].match(/^:root \{([^}]+)\}/m)[1];
  const swift = files['apple/GPTokens.swift'].match(/public enum GPLayout \{([^}]+)\}/)[1];
  const kotlin = files['android/GpTokens.kt'].match(/object GpLayout \{([^}]+)\}/)[1];
  const yaml = frontmatter.match(/\nlayout:\n([\s\S]+?)\nopacity:/)[1];
  for (const [role, nativeName, width] of WIDTHS) {
    assert.ok(root.includes(`--layout-${role}: ${width}px;`), role);
    assert.ok(swift.includes(`public static let ${nativeName}: CGFloat = ${width}`), role);
    assert.ok(kotlin.includes(`val ${nativeName} = ${width}.dp`), role);
    assert.ok(yaml.includes(`"${role}": "${width}px"`), role);
  }
});

test('Тема не может менять ширины по ролям', async () => {
  const modes = await resolveModes();
  for (const [role] of WIDTHS) {
    const changed = structuredClone(modes);
    const token = changed.dark.find((t) => t.path.join('.') === `layout.${role}`);
    assert.ok(token, role);
    token.$value.value += 1;
    assert.throws(() => split(changed), /нетематический токен .* разный в темах/, role);
  }
});
