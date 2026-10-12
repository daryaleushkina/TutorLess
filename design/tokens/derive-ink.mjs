// Явная пересборка производных цветов; обычный build не меняет утверждённые источники.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolveModes } from './build.mjs';
import { deriveColor, minimumContrast } from './color-accessibility.mjs';

export const INK_ROLES = ['verbal', 'quant', 'essay', 'words', 'exam', 'reading', 'listening', 'writing', 'speaking', 'exam-gre', 'exam-toefl', 'exam-sat', 'exam-gmat'];
export const SURFACES = ['bg', 'surface', 'surface-2', 'surface-3'];

export async function deriveSources(check = false) {
  const paletteUrl = new URL('./src/primitives/color.json', import.meta.url);
  const palette = JSON.parse(await readFile(paletteUrl, 'utf8'));
  const modes = await resolveModes();
  const rows = [];
  const outputs = [];
  for (const mode of ['light', 'dark']) {
    const url = new URL(`./src/semantic/color.${mode}.json`, import.meta.url);
    const semantic = JSON.parse(await readFile(url, 'utf8'));
    const value = (role) => modes[mode].find((t) => t.path.join('.') === `color.${role}`).$value;
    const surfaces = SURFACES.map((role) => [value(role)]);
    const roles = [...INK_ROLES.map((role) => [role + '-ink', value(role), [...surfaces, [value('surface'), value(role + '-soft')]], 4.5]),
      ['focus', value('accent'), surfaces, 3],
      ...['right', 'wrong'].map((role) => [role, palette.palette[`${mode}-${role}`].$value,
        [...surfaces, ...['bg', 'surface', 'surface-2'].map((bg) => [value(bg), value(role + '-soft')])], 4.5]),
    ];
    for (const [role, base, backgrounds, minimum] of roles) {
      const result = deriveColor(base, backgrounds, minimum, mode);
      const path = `${mode}-${role}${role === 'right' || role === 'wrong' ? '-accessible' : ''}`;
      // Совпавшие ink остаются ссылками: тёмная палитра уже проходит AA.
      const source = role === 'focus' ? 'accent' : role.replace(/-ink$/, '');
      const unchanged = result === base;
      const reference = unchanged ? `{${role === 'right' || role === 'wrong' ? 'palette.' + mode + '-' + role : 'color.' + source}}` : `{palette.${path}}`;
      if (!unchanged) palette.palette[path] = { $value: result };
      semantic.color[role] = {
        $value: reference,
        $description: `${role.endsWith('-ink') ? 'Текст раздела/экзамена' : 'Контрастный статус или фокус'}: ${minimum}:1; OKLCH hue базы сохранён, светлота подобрана с учётом округления платформ (решение Даши 12.10.2026).`,
      };
      rows.push({ mode, role, hex: result.hex, minimum: minimumContrast(result, backgrounds) });
    }
    outputs.push([url, JSON.stringify(semantic, null, 2) + '\n']);
  }
  outputs.push([paletteUrl, JSON.stringify(palette, null, 2) + '\n']);
  for (const [url, content] of outputs) {
    if (check) {
      if (await readFile(url, 'utf8') !== content) throw new Error(`производные цвета устарели: ${fileURLToPath(url)}`);
    } else await writeFile(url, content);
  }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = await deriveSources(process.argv.includes('--check'));
  console.log('| Токен | Светлая: значение / минимум | Тёмная: значение / минимум |');
  console.log('| --- | --- | --- |');
  for (const light of rows.filter((row) => row.mode === 'light')) {
    const dark = rows.find((row) => row.mode === 'dark' && row.role === light.role);
    console.log(`| ${light.role} | ${light.hex} / ${light.minimum.toFixed(4)}:1 | ${dark.hex} / ${dark.minimum.toFixed(4)}:1 |`);
  }
}
