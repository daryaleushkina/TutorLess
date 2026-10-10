// Сборка токенов «Ночной студии»: src/*.json (формат W3C DTCG) → веб, Apple, Android и шапка DESIGN.md.
//
//   pnpm build   — пересобрать generated/ и шапку DESIGN.md
//   pnpm check   — то же в памяти; если файлы в git разошлись с источником — выход 1 (для CI)
//
// Style Dictionary разбирает DTCG, ссылки {palette.…} и наследование $type; файлы для платформ пишем
// своими форматами: встроенные выдают одну тему на файл, а нам нужны светлая и тёмная вместе —
// в CSS через data-theme, у Apple в каталоге цветов с вариантами внешнего вида, в Compose двумя наборами.
// Сгенерированное лежит в git: Xcode и Gradle не должны зависеть от Node (решение Даши 05.10.2026).
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import StyleDictionary from 'style-dictionary';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const out = join(here, 'generated');
const MODES = ['light', 'dark'];
const WIDE = '-wide';
const HEADER = 'Сгенерировано design/tokens/build.mjs из design/tokens/src — руками не править.';

// ---------- Чтение ----------

export async function resolveModes() {
  const modes = {};
  for (const mode of MODES) {
    const sd = new StyleDictionary({
      source: [
        join(here, 'src/primitives/*.json'),
        join(here, 'src/semantic/typography.json'),
        join(here, 'src/semantic/control.json'),
        join(here, `src/semantic/color.${mode}.json`),
        join(here, `src/third-party/sign-in.${mode}.json`),
      ],
      log: { verbosity: 'silent', warnings: 'error', errors: { brokenReferences: 'throw' } },
      platforms: { raw: {} },
    });
    const { allTokens } = await sd.getPlatformTokens('raw');
    // Палитра — только сырьё для смысловых токенов, наружу не выходит.
    modes[mode] = allTokens.filter((t) => t.path[0] !== 'palette');
  }
  return modes;
}

const THEMED = new Set(['color', 'gradient', 'shadow']);
const usesThin = (t) => t.$type === 'typography' && t.original.$value.fontWeight === '{font.weight.thin}';
const usesMono = (t) => t.$type === 'typography' && t.original.$value.fontFamily === '{font.family.mono}';
const isThemed = (t) => THEMED.has(t.$type) || (t.$type === 'fontWeight' && t.path.join('.') === 'font.weight.thin');

// Нетематические токены обязаны совпадать в обеих темах, иначе тема протекла не туда.
export function split(modes) {
  const [light, dark] = MODES.map((m) => modes[m]);
  const key = (t) => t.path.join('.');
  const darkByKey = new Map(dark.map((t) => [key(t), t]));
  for (const t of light) {
    const d = darkByKey.get(key(t));
    if (!d) throw new Error(`токен ${key(t)} есть в светлой теме, но нет в тёмной`);
    if (t.$type !== d.$type) throw new Error(`тип токена ${key(t)} разный в темах`);
    if (usesThin(t) !== usesThin(d)) throw new Error(`ссылка на thin у ${key(t)} разная в темах`);
    // У роли, явно ссылающейся на thin, тематичен только вес. Размер, семейство и интервалы
    // по-прежнему обязаны совпадать: ссылка не даёт разрешения менять всю типографику с темой.
    const commonValue = (token) => usesThin(token) ? { ...token.$value, fontWeight: '{font.weight.thin}' } : token.$value;
    if (!isThemed(t) && JSON.stringify(commonValue(t)) !== JSON.stringify(commonValue(d))) {
      throw new Error(`нетематический токен ${key(t)} разный в темах`);
    }
  }
  if (dark.length !== light.length) throw new Error('в тёмной теме есть токены, которых нет в светлой');
  return {
    common: light.filter((t) => !isThemed(t)),
    themed: Object.fromEntries(MODES.map((m) => [m, modes[m].filter(isThemed)])),
  };
}

// ---------- Значения ----------

const rgb255 = (c) => c.components.map((x) => Math.round(x * 255));
const alphaOf = (c) => c.alpha ?? 1;
const fmt = (n) => String(Number(n.toFixed(4)));

export function cssColor(c) {
  if (alphaOf(c) === 1) return (c.hex ?? '#' + rgb255(c).map((x) => x.toString(16).padStart(2, '0')).join('')).toUpperCase();
  return `rgb(${rgb255(c).join(' ')} / ${fmt(alphaOf(c))})`;
}
const px = (d) => `${fmt(d.value)}${d.unit}`;
const rem = (d) => `${fmt(d.value / 16)}rem`;
const shadow = (s) => `${s.inset ? 'inset ' : ''}${px(s.offsetX)} ${px(s.offsetY)} ${px(s.blur)} ${px(s.spread)} ${cssColor(s.color)}`;
const gradient = (stops) => `linear-gradient(180deg, ${stops.map((s) => `${cssColor(s.color)} ${fmt(s.position * 100)}%`).join(', ')})`;
const family = (f) => f.map((x) => (/\s/.test(x) ? `'${x}'` : x)).join(', ');

function cssValue(t) {
  const v = t.$value;
  switch (t.$type) {
    case 'color': return cssColor(v);
    case 'gradient': return gradient(v);
    case 'shadow': return shadow(v);
    case 'dimension': return px(v);
    case 'duration': return `${v.value}${v.unit}`;
    case 'cubicBezier': return `cubic-bezier(${v.join(', ')})`;
    case 'fontFamily': return family(v);
    case 'fontWeight': case 'number': return fmt(v);
    default: throw new Error(`нет вывода CSS для типа ${t.$type} (${t.path.join('.')})`);
  }
}

const typeTokens = (common) => common.filter((t) => t.$type === 'typography');
const roleName = (t) => t.path.at(-1);
const baseRoles = (common) => typeTokens(common).filter((t) => !roleName(t).endsWith(WIDE));
const wideOf = (common, role) => typeTokens(common).find((t) => roleName(t) === role + WIDE);
const lineHeightPx = (v) => Number((v.fontSize.value * v.lineHeight).toFixed(4));
const trackingEm = (v) => (v.letterSpacing.unit === 'em' ? v.letterSpacing.value : v.letterSpacing.value / v.fontSize.value);

// ---------- Веб ----------

function emitCss({ common, themed }) {
  const name = (t) => '--' + t.path.join('-');
  const block = (sel, tokens, extra = []) =>
    `${sel} {\n${[...extra, ...tokens.map((t) => `  ${name(t)}: ${cssValue(t)};`)].join('\n')}\n}\n`;
  // Размер текста — в rem: «Крупнее» и настройка шрифта браузера масштабируют весь текст разом.
  const font = (t) => `${usesThin(t) ? 'var(--font-weight-thin)' : t.$value.fontWeight} ${rem(t.$value.fontSize)}/${fmt(t.$value.lineHeight)} var(--font-family-${usesMono(t) ? 'mono' : 'text'})`;
  const typeVars = (t, role = roleName(t)) => [
    `  --font-${role}: ${font(t)};`,
    `  --tracking-${role}: ${fmt(trackingEm(t.$value))}em;`,
  ];
  const plain = common.filter((t) => t.$type !== 'typography');
  const large = common.find((t) => t.path.join('.') === 'font.text-scale-large').$value;
  const wide = common.find((t) => t.path.join('.') === 'layout.breakpoint-wide').$value;
  const wides = baseRoles(common).filter((t) => wideOf(common, roleName(t)));
  return [
    `/* ${HEADER}\n * Тема: data-theme="light" | "dark" на <html>; без атрибута — как в системе (до запуска JS).\n * Размер текста: data-text-size="large" на <html>. Роли текста: font: var(--font-body); letter-spacing: var(--tracking-body). */\n`,
    block(':root', [...plain, ...themed.light], ['  color-scheme: light;', ...baseRoles(common).flatMap((t) => typeVars(t))]),
    block(':root[data-theme="dark"]', themed.dark, ['  color-scheme: dark;']),
    `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', themed.dark, ['  color-scheme: dark;']).replace(/^/gm, '  ').trimEnd()}\n}\n`,
    `:root[data-text-size="large"] {\n  font-size: ${fmt(large * 100)}%;\n}\n`,
    `@media (min-width: ${px(wide)}) {\n  :root {\n${wides.flatMap((t) => typeVars(wideOf(common, roleName(t)), roleName(t))).map((l) => '  ' + l).join('\n')}\n  }\n}\n`,
  ].join('\n');
}

// ---------- Apple ----------

const camel = (parts) => parts.join('-').split('-').map((p, i) => (i ? p[0].toUpperCase() + p.slice(1) : p)).join('');
const swiftName = (parts) => { const n = camel(parts); return /^\d/.test(n) ? 's' + n : n; };

// Каталог цветов: у каждого цвета два внешних вида, систему переключает сама ОС.
// Компонент — всегда с десятичной точкой: число без неё Xcode читает как целое 0–255, и «1» становится 1/255
// (непрозрачный цвет почти исчезает). Тест — test/xcassets.test.mjs.
function emitColorAssets({ themed }) {
  const files = { 'GPColors.xcassets/Contents.json': { info: { author: 'xcode', version: 1 } } };
  const unit = (n) => n.toFixed(4);
  const comp = (c) => {
    const [r, g, b] = c.components;
    return { 'color-space': 'srgb', components: { red: unit(r), green: unit(g), blue: unit(b), alpha: unit(alphaOf(c)) } };
  };
  const dark = new Map(themed.dark.map((t) => [t.path.join('.'), t]));
  for (const t of themed.light.filter((t) => t.$type === 'color')) {
    const n = camel(t.path.slice(t.path[0] === 'color' ? 1 : 0));
    files[`GPColors.xcassets/${n}.colorset/Contents.json`] = {
      colors: [
        { color: comp(t.$value), idiom: 'universal' },
        { appearances: [{ appearance: 'luminosity', value: 'dark' }], color: comp(dark.get(t.path.join('.')).$value), idiom: 'universal' },
      ],
      info: { author: 'xcode', version: 1 },
    };
  }
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, JSON.stringify(v, null, 2) + '\n']));
}

// Роль текста → стиль Dynamic Type, с которым она растёт (Font.custom(_:size:relativeTo:)).
const RELATIVE = {
  body: 'body', h1: 'largeTitle', h2: 'title3', h3: 'headline', eyebrow: 'caption', lead: 'body',
  button: 'headline', 'exam-switch': 'subheadline', 'start-title': 'largeTitle', meta: 'footnote',
  'section-name': 'headline', caption: 'caption', 'section-stat': 'title2', 'session-count': 'title3',
  'q-text': 'body', opt: 'body', answer: 'callout', 'explain-body': 'body', action: 'callout', seg: 'caption',
  'score-label': 'caption', 'score-num': 'largeTitle', 'stat-value': 'body', 'exam-title': 'largeTitle',
  'exam-name': 'largeTitle', headword: 'largeTitle', 'sense-en': 'body', 'word-meta': 'callout',
  example: 'body', 'nav-label': 'caption2', 'week-count': 'title2', ipa: 'footnote',
};
const SWIFT_WEIGHT = { 200: '.ultraLight', 300: '.light', 400: '.regular', 500: '.medium', 600: '.semibold' };

function emitSwift({ common, themed }) {
  const group = (head) => common.filter((t) => t.path[0] === head && t.$type === 'dimension');
  const cg = (title, head, doc) => [
    `/// ${doc}`,
    `public enum ${title} {`,
    ...group(head).map((t) => `${t.$description ? `    /// ${t.$description}\n` : ''}    public static let ${swiftName(t.path.slice(1))}: CGFloat = ${fmt(t.$value.value)}`),
    '}',
  ].join('\n');
  const get = (p) => common.find((t) => t.path.join('.') === p).$value;
  const systemDescription = common.find((t) => t.path.join('.') === 'font.family.system').$description;
  const googleWeight = SWIFT_WEIGHT[get('sign-in.google.font-weight')];
  if (!googleWeight) throw new Error('нет веса кнопки Google для Swift');
  const appleWeight = SWIFT_WEIGHT[get('sign-in.apple.font-weight')];
  if (!appleWeight) throw new Error('нет веса кнопки Apple для Swift');
  const style = (t, role) => {
    const v = t.$value;
    const rel = RELATIVE[role];
    if (!rel) throw new Error(`для роли ${role} не задан стиль Dynamic Type`);
    if (!SWIFT_WEIGHT[v.fontWeight]) throw new Error(`нет веса ${v.fontWeight} для Swift`);
    return `GPTextStyle(size: ${fmt(v.fontSize.value)}, lineHeight: ${lineHeightPx(v)}, weight: ${usesThin(t) ? 'theme.thin' : SWIFT_WEIGHT[v.fontWeight]}, tracking: ${fmt(trackingEm(v))}, relativeTo: .${rel}, fontFamily: "${v.fontFamily[0]}")`;
  };
  const roles = typeTokens(common).map((t) => {
    const n = roleName(t);
    const base = n.endsWith(WIDE) ? n.slice(0, -WIDE.length) : n;
    return `        ${swiftName([n])} = ${style(t, base)}`;
  });
  const declarations = typeTokens(common).map((t) => `${t.$description ? `    /// ${t.$description}\n` : ''}    public let ${swiftName([roleName(t)])}: GPTextStyle`);
  const swiftColor = (c) => `Color(.sRGB, red: ${fmt(c.components[0])}, green: ${fmt(c.components[1])}, blue: ${fmt(c.components[2])}, opacity: ${fmt(alphaOf(c))})`;
  const themeSets = MODES.map((mode) => {
    const getTheme = (path) => themed[mode].find((t) => t.path.join('.') === path).$value;
    const s = getTheme('shadow.glow');
    return `    public static let ${mode} = GPThemeTokens(\n        thin: ${SWIFT_WEIGHT[getTheme('font.weight.thin')]},\n        glow: GPShadow(color: ${swiftColor(s.color)}, offsetX: ${fmt(s.offsetX.value)}, offsetY: ${fmt(s.offsetY.value)}, blur: ${fmt(s.blur.value)}, spread: ${fmt(s.spread.value)})\n    )`;
  });
  const ease = get('motion.easing.out');
  return `// ${HEADER}
// Цвета — в GPColors.xcassets (Color(.text), Color(.text2)…), внешний вид выбирает система.
// Для тонких ролей и свечения вместе с ним выбирайте GPType.light/dark и GPThemeTokens.light/dark.
import SwiftUI

${cg('GPSpace', 'space', 'Отступы и промежутки, pt.')}

${cg('GPRadius', 'radius', 'Радиусы скругления, pt. full — капсула: используйте Capsule().')}

${cg('GPSize', 'size', 'Размеры элементов, pt.')}

${cg('GPLayout', 'layout', 'Раскладка, pt. breakpointWide — граница компактной и широкой раскладки.')}

/// Прозрачность состояний элементов.
public enum GPOpacity {
${common.filter((t) => t.path[0] === 'opacity').map((t) => `    public static let ${swiftName(t.path.slice(1))}: Double = ${fmt(t.$value)}`).join('\n')}
}

/// Типографика кнопки Google по правилам Google. Размер и разрядка — pt.
public enum GPSignInGoogle {
    public static let fontFamily = ${JSON.stringify(get('sign-in.google.font-family')[0])}
    public static let fontFallbacks = ${JSON.stringify(get('sign-in.google.font-family').slice(1)).replaceAll(',', ', ')}
    public static let fontSize: CGFloat = ${fmt(get('sign-in.google.font-size').value)}
    public static let fontWeight: Font.Weight = ${googleWeight}
    public static let tracking: CGFloat = ${fmt(get('sign-in.google.tracking').value)}
    public static let lineHeight: CGFloat = ${fmt(get('sign-in.google.line-height').value)}
}

/// Типографика кнопки Apple. Семейство — системное; размер и межстрочный — pt.
public enum GPSignInApple {
    public static let fontSize: CGFloat = ${fmt(get('sign-in.apple.font-size').value)}
    public static let fontWeight: Font.Weight = ${appleWeight}
    public static let lineHeight: CGFloat = ${fmt(get('sign-in.apple.line-height').value)}
    public static var font: Font {
        GPType.systemFont(size: fontSize, weight: fontWeight)
    }
}

/// Роль текста: размер и межстрочный — pt, трекинг — доля размера (em), relativeTo — с каким стилем Dynamic Type растёт.
public struct GPTextStyle: Sendable {
    public let size: CGFloat
    public let lineHeight: CGFloat
    public let weight: Font.Weight
    public let tracking: CGFloat
    public let relativeTo: Font.TextStyle
    public let fontFamily: String
}

/// Свечение: параметры каталога, pt. spread сохраняется отдельно для отрисовки расширенного слоя.
public struct GPShadow: Sendable {
    public let color: Color
    public let offsetX: CGFloat
    public let offsetY: CGFloat
    public let blur: CGFloat
    public let spread: CGFloat
}

/// Тематический вес и свечение: выбираются одновременно с внешним видом цветов.
public struct GPThemeTokens: Sendable {
    public let thin: Font.Weight
    public let glow: GPShadow

${themeSets.join('\n\n')}
}

/// Роли Geologica; IPA — IBM Plex Mono. Wide — та же роль в широкой раскладке (iPad, Mac).
public struct GPType: Sendable {
    public static let fontFamily = "${get('font.family.text')[0]}"
    public static let monoFontFamily = "${get('font.family.mono')[0]}"
    public static let mathFontFamily = "${get('font.family.math')[0]}"
    public static let mathFontFallbacks = ${JSON.stringify(get('font.family.math').slice(1)).replaceAll(',', ', ')}
    /// ${systemDescription}
    public static func systemFont(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
    /// Настройка «Крупнее»: множитель размера поверх Dynamic Type.
    public static let textScaleLarge: CGFloat = ${fmt(get('font.text-scale-large'))}
${declarations.join('\n')}

    public static let light = GPType(theme: .light)
    public static let dark = GPType(theme: .dark)

    private init(theme: GPThemeTokens) {
${roles.join('\n')}
    }
}

/// Движение. Длительности — секунды; при «Уменьшить движение» анимации нажатия и появления выключаются.
public enum GPMotion {
    public static let press: Double = ${fmt(get('motion.duration.press').value / 1000)}
    public static let reveal: Double = ${fmt(get('motion.duration.reveal').value / 1000)}
    public static let pulse: Double = ${fmt(get('motion.duration.pulse').value / 1000)}
    public static let pressScale: CGFloat = ${fmt(get('motion.press-scale'))}
    public static func easeOut(duration: Double) -> Animation {
        .timingCurve(${ease.map(fmt).join(', ')}, duration: duration)
    }
}
`;
}

// ---------- Android ----------

const KOTLIN_PACKAGE = 'greprep.design'; // поменяется вместе с именем бренда и id приложения
const kName = (parts) => { const n = camel(parts); return /^\d/.test(n) ? 's' + n : n; };
const kColor = (c) => {
  const [r, g, b] = rgb255(c);
  const a = Math.round(alphaOf(c) * 255);
  return `Color(0x${[a, r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase()})`;
};

function emitKotlin({ common, themed }) {
  const colors = (m) => themed[m].filter((t) => t.$type === 'color');
  const cName = (t) => kName(t.path.slice(t.path[0] === 'color' ? 1 : 0));
  const obj = (title, head, doc) => [
    `/** ${doc} */`,
    `object ${title} {`,
    ...common.filter((t) => t.path[0] === head && t.$type === 'dimension').map((t) => `${t.$description ? `    /** ${t.$description} */\n` : ''}    val ${kName(t.path.slice(1))} = ${fmt(t.$value.value)}.dp`),
    '}',
  ].join('\n');
  const get = (p) => common.find((t) => t.path.join('.') === p).$value;
  const ts = (t) => {
    const v = t.$value;
    return `TextStyle(fontFamily = ${usesMono(t) ? 'monoFamily' : 'family'}, fontSize = ${fmt(v.fontSize.value)}.sp, lineHeight = ${lineHeightPx(v)}.sp, fontWeight = ${usesThin(t) ? 'theme.thin' : `FontWeight.W${v.fontWeight}`}, letterSpacing = (${fmt(trackingEm(v))}).em)`;
  };
  const themeSets = MODES.map((mode) => {
    const getTheme = (path) => themed[mode].find((t) => t.path.join('.') === path).$value;
    const s = getTheme('shadow.glow');
    const color = `Color(red = ${fmt(s.color.components[0])}f, green = ${fmt(s.color.components[1])}f, blue = ${fmt(s.color.components[2])}f, alpha = ${fmt(alphaOf(s.color))}f)`;
    return `val Gp${mode[0].toUpperCase() + mode.slice(1)}Theme = GpThemeTokens(\n    thin = FontWeight.W${getTheme('font.weight.thin')},\n    glow = GpShadow(color = ${color}, offsetX = ${fmt(s.offsetX.value)}.dp, offsetY = ${fmt(s.offsetY.value)}.dp, blur = ${fmt(s.blur.value)}.dp, spread = ${fmt(s.spread.value)}.dp),\n)`;
  });
  const ease = get('motion.easing.out');
  return `// ${HEADER}
// Вместе с цветами выбирайте GpLightTheme/GpDarkTheme и GpTypography.light/dark.
package ${KOTLIN_PACKAGE}

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/** Смысловые цвета. Тема выбирает набор: GpLightColors или GpDarkColors. */
@Immutable
class GpColors(
${colors('light').map((t) => `    val ${cName(t)}: Color,`).join('\n')}
)

${MODES.map((m) => `val Gp${m[0].toUpperCase() + m.slice(1)}Colors = GpColors(\n${colors(m).map((t) => `    ${cName(t)} = ${kColor(t.$value)},`).join('\n')}\n)`).join('\n\n')}

/** Свечение: параметры каталога. spread — расширение слоя перед размытием. */
@Immutable
class GpShadow(
    val color: Color,
    val offsetX: Dp,
    val offsetY: Dp,
    val blur: Dp,
    val spread: Dp,
)

/** Тематический вес и свечение выбираются вместе с набором цветов. */
@Immutable
class GpThemeTokens(val thin: FontWeight, val glow: GpShadow)

${themeSets.join('\n\n')}

${obj('GpSpace', 'space', 'Отступы и промежутки.')}

${obj('GpRadius', 'radius', 'Радиусы скругления. full — капсула: используйте CircleShape или RoundedCornerShape(50).')}

${obj('GpSize', 'size', 'Размеры элементов.')}

${obj('GpLayout', 'layout', 'Раскладка. breakpointWide — граница компактной и широкой раскладки.')}

/** Прозрачность состояний элементов. */
object GpOpacity {
${common.filter((t) => t.path[0] === 'opacity').map((t) => `    const val ${t.path.slice(1).join('_').replace(/-/g, '_').toUpperCase()} = ${fmt(t.$value)}f`).join('\n')}
}

/** Типографика кнопки Google. Размер и разрядка — sp, чтобы следовать системному масштабу текста. */
object GpSignInGoogle {
    const val FONT_FAMILY = ${JSON.stringify(get('sign-in.google.font-family')[0])}
    val FONT_FALLBACKS = listOf(${get('sign-in.google.font-family').slice(1).map((name) => JSON.stringify(name)).join(', ')})
    val fontSize = ${fmt(get('sign-in.google.font-size').value)}.sp
    val fontWeight = FontWeight.W${get('sign-in.google.font-weight')}
    val tracking = ${fmt(get('sign-in.google.tracking').value)}.sp
    val lineHeight = ${fmt(get('sign-in.google.line-height').value)}.sp
}

/** Типографика кнопки Apple: системный шрифт Android, размеры текста — sp. */
object GpSignInApple {
    val fontFamily = GpTypography.SYSTEM_FONT_FAMILY
    val fontSize = ${fmt(get('sign-in.apple.font-size').value)}.sp
    val fontWeight = FontWeight.W${get('sign-in.apple.font-weight')}
    val lineHeight = ${fmt(get('sign-in.apple.line-height').value)}.sp
}

/** family — Geologica, monoFamily — IBM Plex Mono из ресурсов. sp растут с системным масштабом. */
@Immutable
class GpTypography private constructor(family: FontFamily, monoFamily: FontFamily, theme: GpThemeTokens) {
${typeTokens(common).map((t) => `${t.$description ? `    /** ${t.$description} */\n` : ''}    val ${kName([roleName(t)])} = ${ts(t)}`).join('\n')}

    companion object {
        /** Настройка «Крупнее»: множитель поверх системного масштаба шрифта. */
        const val TEXT_SCALE_LARGE = ${fmt(get('font.text-scale-large'))}f
        const val FONT_FAMILY = "${get('font.family.text')[0]}"
        const val MONO_FONT_FAMILY = "${get('font.family.mono')[0]}"
        const val MATH_FONT_FAMILY = "${get('font.family.math')[0]}"
        val MATH_FONT_FALLBACKS = listOf(${get('font.family.math').slice(1).map((name) => JSON.stringify(name)).join(', ')})
        /** ${common.find((t) => t.path.join('.') === 'font.family.system').$description} */
        val SYSTEM_FONT_FAMILY = FontFamily.Default
        fun light(family: FontFamily, monoFamily: FontFamily) = GpTypography(family, monoFamily, GpLightTheme)
        fun dark(family: FontFamily, monoFamily: FontFamily) = GpTypography(family, monoFamily, GpDarkTheme)
    }
}

/** Движение. Длительности — миллисекунды. */
object GpMotion {
    const val PRESS = ${get('motion.duration.press').value}
    const val REVEAL = ${get('motion.duration.reveal').value}
    const val PULSE = ${get('motion.duration.pulse').value}
    const val PRESS_SCALE = ${fmt(get('motion.press-scale'))}f
    val EaseOut = CubicBezierEasing(${ease.map((x) => fmt(x) + 'f').join(', ')})
}
`;
}

// Цвета ресурсами Android: их читает то, что рисуется до Compose, — фон окна и заставка запуска (иначе окно
// мигнёт чужим цветом). Светлая тема — values, тёмная — values-night, имена — gp_<роль>.
function emitAndroidColorResources({ themed }) {
  const xName = (t) => 'gp_' + t.path.slice(t.path[0] === 'color' ? 1 : 0).join('_').replace(/-/g, '_');
  const xColor = (c) => {
    const [r, g, b] = rgb255(c);
    const a = Math.round(alphaOf(c) * 255);
    return '#' + [a, r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const file = (m) => `<?xml version="1.0" encoding="utf-8"?>
<!-- ${HEADER} -->
<resources>
${themed[m].filter((t) => t.$type === 'color').map((t) => `    <color name="${xName(t)}">${xColor(t.$value)}</color>`).join('\n')}
</resources>
`;
  return { 'android/res/values/gp_colors.xml': file('light'), 'android/res/values-night/gp_colors.xml': file('dark') };
}

// ---------- Шапка DESIGN.md ----------

// Формат DESIGN.md (google-labs-code/design.md): темы в схеме нет, поэтому у тёмных цветов суффикс -dark.
function emitFrontmatter({ common, themed }) {
  const q = (s) => JSON.stringify(s);
  const lines = ['---', 'name: GrePrepApp', 'description: Подготовка к GRE® — дизайн «Ночная студия»', 'colors:'];
  for (const m of MODES) {
    for (const t of themed[m].filter((t) => t.$type === 'color')) {
      const n = t.path.slice(t.path[0] === 'color' ? 1 : 0).join('-') + (m === 'dark' ? '-dark' : '');
      lines.push(`  ${n}: ${q(cssColor(t.$value))}`);
    }
  }
  lines.push('typography:');
  for (const t of typeTokens(common)) {
    const v = t.$value;
    lines.push(`  ${roleName(t)}:`, `    fontFamily: ${q(family(v.fontFamily))}`, `    fontSize: ${q(px(v.fontSize))}`,
      `    fontWeight: ${v.fontWeight}`, `    lineHeight: ${q(px({ value: lineHeightPx(v), unit: 'px' }))}`,
      `    letterSpacing: ${q(fmt(trackingEm(v)) + 'em')}`);
    if (usesThin(t)) lines.push(`    fontWeightDark: ${themed.dark.find((token) => token.path.join('.') === 'font.weight.thin').$value}`);
  }
  lines.push('fontFamilies:');
  for (const t of common.filter((t) => t.path[0] === 'font' && t.$type === 'fontFamily')) lines.push(`  ${t.path.at(-1)}: ${q(family(t.$value))}`);
  lines.push('fontWeights:');
  for (const t of common.filter((t) => t.path[0] === 'font' && t.$type === 'fontWeight')) lines.push(`  ${t.path.at(-1)}: ${t.$value}`);
  for (const mode of MODES) lines.push(`  thin${mode === 'dark' ? '-dark' : ''}: ${themed[mode].find((t) => t.path.join('.') === 'font.weight.thin').$value}`);
  const signIn = common.filter((t) => t.path[0] === 'sign-in');
  lines.push('signIn:');
  for (const provider of new Set(signIn.map((t) => t.path[1]))) {
    lines.push(`  ${provider}:`);
    for (const t of signIn.filter((token) => token.path[1] === provider)) {
      lines.push(`    ${camel(t.path.slice(2))}: ${t.$type === 'fontWeight' ? t.$value : q(cssValue(t))}`);
    }
  }
  lines.push('shadows:');
  for (const mode of MODES) {
    for (const t of themed[mode].filter((t) => t.$type === 'shadow')) lines.push(`  ${t.path.at(-1)}${mode === 'dark' ? '-dark' : ''}: ${q(shadow(t.$value))}`);
  }
  for (const [key, head] of [['rounded', 'radius'], ['spacing', 'space'], ['layout', 'layout']]) {
    lines.push(`${key}:`);
    for (const t of common.filter((t) => t.path[0] === head)) lines.push(`  ${q(t.path.slice(1).join('-'))}: ${q(px(t.$value))}`);
  }
  lines.push('opacity:');
  for (const t of common.filter((t) => t.path[0] === 'opacity')) lines.push(`  ${t.path.slice(1).join('-')}: ${fmt(t.$value)}`);
  const dimension = (path) => px(common.find((t) => t.path.join('.') === path).$value);
  // Цвет и форма — ссылками на токены выше, размеры — из того же источника.
  lines.push('components:',
    '  button-main:', '    backgroundColor: "{colors.accent}"', '    textColor: "{colors.on-accent}"', '    rounded: "{rounded.full}"', '    shadow: "{shadows.glow}"', `    minHeight: ${q(dimension('size.button'))}`, `    padding: ${q('0 ' + dimension('layout.gutter'))}`,
    '  button-secondary:', '    backgroundColor: "{colors.surface-2}"', '    textColor: "{colors.text}"', '    rounded: "{rounded.full}"', `    minHeight: ${q(dimension('size.button'))}`,
    '  card:', '    backgroundColor: "{colors.surface}"', '    textColor: "{colors.text}"', '    rounded: "{rounded.l}"', `    padding: ${q(dimension('layout.gutter'))}`,
    '  answer-option:', '    backgroundColor: "{colors.surface}"', '    textColor: "{colors.text}"', '    rounded: "{rounded.m}"', `    minHeight: ${q(dimension('size.opt'))}`, `    padding: ${q(dimension('space.10') + ' ' + dimension('space.14'))}`,
    '  exam-switch:', '    backgroundColor: "{colors.surface-2}"', '    textColor: "{colors.text}"', '    rounded: "{rounded.full}"', `    minHeight: ${q(dimension('size.exam-switch'))}`,
    '  nav:', '    backgroundColor: "{colors.nav-bg}"', '    textColor: "{colors.text-3}"', '    borderColor: "{colors.line}"',
    '---');
  return lines.join('\n') + '\n';
}

// ---------- Запись ----------

export async function render() {
  const parts = split(await resolveModes());
  const files = {
    'web/tokens.css': emitCss(parts),
    'apple/GPTokens.swift': emitSwift(parts),
    'android/GpTokens.kt': emitKotlin(parts),
    ...emitAndroidColorResources(parts),
    ...Object.fromEntries(Object.entries(emitColorAssets(parts)).map(([k, v]) => ['apple/' + k, v])),
  };
  return { files, frontmatter: emitFrontmatter(parts) };
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const res = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) res.push(...(await walk(p)));
    else res.push(p);
  }
  return res;
}

function withFrontmatter(doc, fm) {
  if (!doc.startsWith('---\n')) return fm + '\n' + doc;
  const end = doc.indexOf('\n---\n', 4);
  if (end === -1) throw new Error('DESIGN.md: шапка начата, но не закрыта');
  return fm + doc.slice(end + 5);
}

async function main() {
  const check = process.argv.includes('--check');
  const { files, frontmatter } = await render();
  const designPath = join(repo, 'DESIGN.md');
  const design = await readFile(designPath, 'utf8').catch(() => '');
  const want = { ...Object.fromEntries(Object.entries(files).map(([k, v]) => [join(out, k), v])), [designPath]: withFrontmatter(design, frontmatter) };

  if (check) {
    const stale = [];
    for (const [p, v] of Object.entries(want)) if ((await readFile(p, 'utf8').catch(() => null)) !== v) stale.push(relative(repo, p));
    for (const p of await walk(out)) if (!(p in want)) stale.push(relative(repo, p) + ' (лишний)');
    if (stale.length) {
      console.error(`Токены разошлись с design/tokens/src — запустите pnpm --dir design/tokens build:\n  ${stale.join('\n  ')}`);
      process.exit(1);
    }
    console.log('Токены совпадают с источником.');
    return;
  }
  await rm(out, { recursive: true, force: true });
  for (const [p, v] of Object.entries(want)) {
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, v);
  }
  console.log(`Собрано: ${Object.keys(files).length} файлов в design/tokens/generated и шапка DESIGN.md.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
