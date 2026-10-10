import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const web = join(root, 'apps/web/src');

describe('CSS-переменные веба', () => {
  it('каждый var() ссылается на токен или локально объявленную переменную', () => {
    const files = readdirSync(web, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.css'))
      .map((file) => ({ file: relative(root, join(web, file)), css: readFileSync(join(web, file), 'utf8') }));
    const tokens = readFileSync(join(root, 'design/tokens/generated/web/tokens.css'), 'utf8');
    const declared = new Set([tokens, ...files.map(({ css }) => css)].flatMap((css) =>
      Array.from(css.matchAll(/(--[\w-]+)\s*:/g), (match) => match[1]),
    ));
    const missing = files.flatMap(({ file, css }) =>
      Array.from(css.matchAll(/var\(\s*(--[\w-]+)/g), (match) => match[1])
        .filter((name) => !declared.has(name))
        .map((name) => `${file}: ${name}`),
    );
    expect([...new Set(missing)], 'Необъявленные CSS-переменные (файл: переменная)').toEqual([]);
  });
});
