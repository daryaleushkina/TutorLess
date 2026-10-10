// Читаем статичный каталог независимо от токенов; учитываем контейнеры и явное наследование.
import { readFile } from 'node:fs/promises';

export function rules(css, wide = false) {
  const result = [];
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let cursor = 0;
  while (cursor < css.length) {
    const open = css.indexOf('{', cursor);
    if (open < 0) break;
    let close = open + 1;
    let depth = 1;
    while (depth && close < css.length) {
      if (css[close] === '{') depth++;
      if (css[close] === '}') depth--;
      close++;
    }
    const selector = css.slice(cursor, open).trim();
    const body = css.slice(open + 1, close - 1);
    if (selector.startsWith('@container')) result.push(...rules(body, /min-width:\s*900px/.test(selector)));
    else if (!selector.startsWith('@')) for (const part of selector.split(',')) result.push({ selector: part.trim(), body, wide });
    cursor = close;
  }
  return result;
}

export async function loadCatalog(names) {
  return Object.fromEntries(await Promise.all([...new Set(names)].map(async (name) => [
    name, rules(await readFile(new URL(`../../night-studio/${name === 'core' ? 'core' : 'screens/' + name}.css`, import.meta.url), 'utf8')),
  ])));
}

export function catalogStyle(parsed, file, selector, wide, parents = [], resetTracking = false) {
  const style = { size: 16, weight: 400, height: 1.45, tracking: { value: resetTracking ? 0 : -0.08, unit: 'px' } };
  for (const entry of [...parents, selector]) {
    const colon = entry.indexOf(':');
    const source = colon >= 0 ? entry.slice(0, colon) : file;
    const target = colon >= 0 ? entry.slice(colon + 1) : entry;
    for (const rule of parsed[source].filter((r) => r.selector === target && (!r.wide || wide))) {
      for (const declaration of rule.body.split(';')) {
        const split = declaration.indexOf(':');
        if (split < 0) continue;
        const key = declaration.slice(0, split).trim();
        const value = declaration.slice(split + 1).trim();
        if (key === 'font') {
          const match = value.match(/(var\(--thin\)|[23456]00)\s+(\d+(?:\.\d+)?)px\/([\d.]+)(px)?/);
          if (!match) throw new Error(`${target}: неподдержанный font ${value}`);
          style.weight = match[1] === 'var(--thin)' ? 'thin' : Number(match[1]);
          style.size = Number(match[2]);
          style.height = Number(match[3]) / (match[4] ? style.size : 1);
        }
        if (key === 'font-size') style.size = Number.parseFloat(value);
        if (key === 'font-weight') style.weight = value === 'var(--thin)' ? 'thin' : Number(value);
        if (key === 'line-height') style.height = Number.parseFloat(value);
        if (key === 'letter-spacing') style.tracking = { value: Number.parseFloat(value), unit: value.endsWith('em') ? 'em' : 'px' };
      }
    }
  }
  return style;
}
