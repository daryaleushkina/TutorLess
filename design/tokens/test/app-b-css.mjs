// Макет читается независимо от DTCG: ожидания не выводятся из проверяемых токенов.
import { readFile } from 'node:fs/promises';

export const html = await readFile(new URL('../../app-b/index.html', import.meta.url), 'utf8');
export const css = html.match(/<style>([\s\S]+?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
export const variables = (block) => new Map([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
export function frameVariables(mode) {
  const base = variables(css.match(/\.frame\s*\{([^}]+)\}/)[1]);
  if (mode === 'dark') for (const [name, value] of variables(css.match(/\.frame\[data-theme="dark"\]\s*\{([^}]+)\}/)[1])) base.set(name, value);
  return base;
}

export function textStyle(selectors, wide = false) {
  const value = { size: 16, weight: 400, height: 1.45, tracking: 0 };
  for (const selector of ['.frame', ...selectors, ...(wide ? selectors.map((s) => '.device-desktop ' + s) : [])]) {
    const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].split(',').some((s) => s.trim() === selector));
    if (!rule) continue;
    for (const declaration of rule[2].split(';')) {
      const [key, raw] = declaration.split(':').map((s) => s.trim());
      if (key === 'font') {
        const m = raw.match(/(\d+)\s+(\d+(?:\.\d+)?)px\/([\d.]+)/);
        if (m) Object.assign(value, { weight: Number(m[1]), size: Number(m[2]), height: Number(m[3]) });
      }
      if (key === 'font-size') value.size = Number.parseFloat(raw);
      if (key === 'font-weight') value.weight = Number(raw);
      if (key === 'line-height') value.height = Number(raw);
      if (key === 'letter-spacing') value.tracking = Number.parseFloat(raw);
    }
  }
  return value;
}

// Имена платформ сохраняются; существующие роли сопоставлены с рабочими экранами B.
export const TYPE_SELECTORS = {
  body: [], h1: ['.h1'], 'h1-wide': ['.h1'], h2: ['.h2'], h3: ['.h3'],
  button: ['.btn'], 'exam-switch': ['.exam-switch'],
  'start-title': ['.start-title'], 'start-title-wide': ['.start-title'],
  'section-name': ['.row-body b'], 'section-stat': ['.stat b'], 'section-stat-wide': ['.stat b'],
  'q-text': ['.q-text'], 'q-text-wide': ['.q-text'], opt: ['.opt'], answer: ['.ans'],
  'explain-body': ['.explain-body'], action: ['.link-row'], seg: ['.seg button'],
  'score-label': ['.x-label'], 'stat-value': ['.stat b'],
  'exam-title': ['.h2'], 'exam-title-wide': ['.h2'],
  'exam-name': ['.exam-tile'], 'exam-name-wide': ['.exam-tile'],
  headword: ['.headword'], 'headword-wide': ['.headword'],
  'sense-en': ['.sense-en'], 'word-meta': ['.word-meta'], example: ['.example'],
  'nav-label': ['.nav-item'], 'nav-label-wide': ['.nav-item'],
  'week-count': ['.week b'], 'num-unit': ['.today-num span'],
  'h1-compact': ['.h1'], 'h1-compact-wide': ['.h1'],
  'num-m': ['.headword'], 'num-m-wide': ['.headword'],
  'num-l': ['.today-num b'], 'num-l-wide': ['.today-num b'],
  'num-xl': ['.x-num'], 'num-xl-wide': ['.x-num'],
  'num-xxl': ['.sum-num'], 'num-xxl-wide': ['.sum-num'],
  'score-num': ['.metric-num'], 'score-num-wide': ['.metric-num'],
};
