// Преобразования sRGB ↔ OKLCH: матрицы CSS Color 4, без внешней зависимости.
// https://www.w3.org/TR/css-color-4/#color-conversion-code
const multiply = (matrix, vector) => matrix.map((row) => row.reduce((sum, x, i) => sum + x * vector[i], 0));
const linear = (x) => Math.abs(x) <= 0.04045 ? x / 12.92 : Math.sign(x) * ((Math.abs(x) + 0.055) / 1.055) ** 2.4;
const gamma = (x) => Math.abs(x) <= 0.0031308 ? x * 12.92 : Math.sign(x) * (1.055 * Math.abs(x) ** (1 / 2.4) - 0.055);
const RGB_XYZ = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
];
const XYZ_RGB = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
];
const XYZ_LMS = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_LAB = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const LAB_LMS = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];
const LMS_XYZ = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];
const clamp = (x) => Math.max(0, Math.min(1, x));

export function toOklch(components) {
  const xyz = multiply(RGB_XYZ, components.map(linear));
  const [l, a, b] = multiply(LMS_LAB, multiply(XYZ_LMS, xyz).map(Math.cbrt));
  const c = Math.hypot(a, b);
  return [l, c, c < 1e-7 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];
}

export function fromOklch([l, c, h]) {
  const angle = h * Math.PI / 180;
  const lms = multiply(LAB_LMS, [l, c * Math.cos(angle), c * Math.sin(angle)]).map((x) => x ** 3);
  return multiply(XYZ_RGB, multiply(LMS_XYZ, lms)).map(gamma);
}

// Уменьшаем только C до границы sRGB: поканальное обрезание изменило бы оттенок.
export function inGamut([l, c, h]) {
  const fits = (rgb) => rgb.every((x) => x >= -1e-10 && x <= 1 + 1e-10);
  const original = fromOklch([l, c, h]);
  if (fits(original)) return original.map(clamp);
  let low = 0;
  let high = c;
  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2;
    if (fits(fromOklch([l, mid, h]))) low = mid;
    else high = mid;
  }
  return fromOklch([l, low, h]).map(clamp);
}

export function asColor(components) {
  const bytes = components.map((x) => Math.round(clamp(x) * 255));
  return { colorSpace: 'srgb', components: bytes.map((x) => x / 255), hex: '#' + bytes.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase() };
}

export function renderedColor(color, platform) {
  const round = platform === 'android' ? (x) => Math.round(x * 255) / 255 : platform === 'apple' ? (x) => Number(x.toFixed(4)) : (x) => x;
  return { components: color.components.map(round), alpha: round(color.alpha ?? 1) };
}

export function flatten(layers) {
  return layers.slice(1).reduce((background, layer) => layer.components.map((x, i) => x * (layer.alpha ?? 1) + background[i] * (1 - (layer.alpha ?? 1))), layers[0].components);
}

export function contrast(a, b) {
  const luminance = (rgb) => rgb.map(linear).reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

export function minimumContrast(color, backgrounds) {
  return Math.min(...['web', 'apple', 'android'].flatMap((platform) => backgrounds.map((layers) => {
    const rendered = layers.map((layer) => renderedColor(layer, platform));
    return contrast(flatten([...rendered, renderedColor(color, platform)]), flatten(rendered));
  })));
}

// Находим ближайшую к базе светлоту, которая проходит порог уже после округления выходов.
// Hue фиксирован; chroma снижается лишь при выходе за sRGB (решение Даши 12.10.2026).
export function deriveColor(base, backgrounds, minimum, mode) {
  if (minimumContrast(base, backgrounds) >= minimum) return base;
  const [l, c, h] = toOklch(base.components);
  const at = (lightness) => asColor(inGamut([lightness, c, h]));
  let passing = mode === 'light' ? 0 : 1;
  let failing = l;
  if (minimumContrast(at(passing), backgrounds) < minimum) throw new Error(`невозможно достичь ${minimum}:1`);
  for (let i = 0; i < 48; i++) {
    const mid = (passing + failing) / 2;
    if (minimumContrast(at(mid), backgrounds) >= minimum) passing = mid;
    else failing = mid;
  }
  return at(passing);
}
