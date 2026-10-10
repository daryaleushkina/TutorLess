// CSS экранов — независимый эталон; цепочки селекторов явно задают наследование.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, catalogStyle as readStyle } from './catalog-css.mjs';
import { render, resolveModes } from '../build.mjs';

const roles = [
  ["complete-words-text","l",".frame .l-ctw-text",[],false,"body"],
  ["sentence-assembly","l",".frame .l-frame",[],false,"body"],
];
const parsed = await loadCatalog(['core', ...roles.map((r) => r[1])]);
const catalogStyle = ([name, file, selector, parents], wide) => readStyle(parsed, file, selector, wide, parents, name === 'review-num');
const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const modes = await resolveModes();
const { files } = await render();
for (const fixture of roles) {
  const [name, file, selector, , thin] = fixture;
  const hasWide = parsed[file].some((r) => r.selector === selector && r.wide);
  for (const wide of hasWide ? [false, true] : [false]) {
    const role = name + (wide ? '-wide' : '');
    const expected = catalogStyle(fixture, wide);
    test(`${role}: шрифт экрана в обеих темах на трёх выходах`, () => {
      for (const [mode, thinWeight] of [['light', 300], ['dark', 200]]) {
        const token = modes[mode].find((t) => t.path.join('.') === `type.${role}`);
        assert.ok(token, `нет type.${role}`);
        assert.equal(token.$value.fontSize.value, expected.size);
        assert.equal(token.$value.lineHeight, expected.height);
        assert.deepEqual(token.$value.letterSpacing, expected.tracking);
        assert.equal(token.$value.fontWeight, thin ? thinWeight : expected.weight);
        assert.deepEqual(token.$value.fontFamily, ['Geologica', 'Onest', 'system-ui', 'sans-serif']);
        if (thin) assert.equal(token.original.$value.fontWeight, '{font.weight.thin}');
      }
      const height = Number((expected.size * expected.height).toFixed(4));
      const tracking = Number((expected.tracking.value / (expected.tracking.unit === 'em' ? 1 : expected.size)).toFixed(4));
      const cssBlock = files['web/tokens.css'].split('@media (min-width: 900px)')[wide ? 1 : 0];
      assert.ok(cssBlock.includes(`--tracking-${name}: ${tracking}em;`), role);
      assert.ok(cssBlock.includes(`--font-${name}: ${thin ? 'var(--font-weight-thin)' : expected.weight} ${Number((expected.size / 16).toFixed(4))}rem/${expected.height} var(--font-family-text);`), role);
      const swift = files['apple/GPTokens.swift'].split('\n').find((line) => line.trimStart().startsWith(`${camel(role)} = GPTextStyle(`));
      const kotlin = files['android/GpTokens.kt'].split('\n').find((line) => line.trimStart().startsWith(`val ${camel(role)} = TextStyle(`));
      assert.ok(swift?.includes(`size: ${expected.size}, lineHeight: ${height}, weight: ${thin ? 'theme.thin' : {400: '.regular', 500: '.medium', 600: '.semibold'}[expected.weight]}`), role);
      assert.ok(swift?.includes(`tracking: ${tracking}, relativeTo: .${fixture[5]}`), role);
      assert.ok(kotlin?.includes(`letterSpacing = (${tracking}).em`), role);
      assert.ok(kotlin?.includes(`fontSize = ${expected.size}.sp, lineHeight = ${height}.sp, fontWeight = ${thin ? 'theme.thin' : 'FontWeight.W' + expected.weight}`), role);
    });
  }
}
