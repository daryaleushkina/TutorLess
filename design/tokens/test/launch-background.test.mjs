import test from 'node:test';
import assert from 'node:assert/strict';
import { render, resolveModes } from '../build.mjs';

const darkBackground = async () => {
  const modes = await resolveModes();
  return modes.dark.find((token) => token.path.join('.') === 'color.bg').$value;
};

test('Android: gp_bg_dark равен тёмному фону и существует только без квалификатора', async () => {
  const bg = await darkBackground();
  const { files } = await render();
  const defaultXml = files['android/res/values/gp_colors.xml'];
  const nightXml = files['android/res/values-night/gp_colors.xml'];
  const matches = [...defaultXml.matchAll(/<color name="gp_bg_dark">([^<]+)<\/color>/g)];
  assert.equal(matches.length, 1, 'нужен один gp_bg_dark в values');
  const argb = [bg.alpha ?? 1, ...bg.components].map((component) => Math.round(component * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  assert.equal(matches[0][1], '#' + argb);
  assert.doesNotMatch(nightXml, /name="gp_bg_dark"/);
  assert.ok(nightXml.includes(`<color name="gp_bg">${matches[0][1]}</color>`));
});

test('Apple: bgDark равен тёмному фону и не имеет вариантов внешнего вида', async () => {
  const bg = await darkBackground();
  const { files } = await render();
  const path = 'apple/GPColors.xcassets/bgDark.colorset/Contents.json';
  assert.ok(files[path], 'нужен набор bgDark');
  const asset = JSON.parse(files[path]);
  assert.equal(asset.colors.length, 1);
  assert.equal(asset.appearances, undefined);
  assert.equal(asset.colors[0].appearances, undefined);
  assert.equal(asset.colors[0].idiom, 'universal');
  assert.equal(asset.colors[0].color['color-space'], 'srgb');
  assert.deepEqual(asset.colors[0].color.components, {
    red: bg.components[0].toFixed(4),
    green: bg.components[1].toFixed(4),
    blue: bg.components[2].toFixed(4),
    alpha: (bg.alpha ?? 1).toFixed(4),
  });
  const themed = JSON.parse(files['apple/GPColors.xcassets/bg.colorset/Contents.json']);
  assert.deepEqual(asset.colors[0].color, themed.colors.find((entry) => entry.appearances?.some((appearance) => appearance.value === 'dark')).color);
});
