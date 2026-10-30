const DISPLAY_DIGITS = 12;
const MAX_EXPONENT = 99;
const ROOT_DIGITS = 30;
const MAX_TOKENS = 256;
type Fraction = { n: bigint; d: bigint };
type Operator = '+' | '−' | '×' | '÷';
type Token = Fraction | Operator | '(' | ')';
export type CalculatorError = 'division_zero' | 'negative_root' | 'overflow' | 'parentheses' | 'incomplete';
export interface CalculatorState {
  tokens: Token[]; entry: string; value: Fraction | null; memory: Fraction;
  display: string; expression: string; error: CalculatorError | null; evaluated: boolean;
  announcement: number;
}
class CalculationError extends Error {
  constructor(readonly code: CalculatorError) { super(code); }
}
const zero: Fraction = { n: 0n, d: 1n };
const abs = (n: bigint) => n < 0n ? -n : n;
const power = (n: number) => 10n ** BigInt(n);
function fraction(n: bigint, d = 1n): Fraction {
  if (!d) throw new CalculationError('division_zero');
  if (d < 0n) { n = -n; d = -d; }
  let a = abs(n), b = d;
  while (b) { const next = a % b; a = b; b = next; }
  return { n: n / a, d: d / a };
}
function decimal(input: string): Fraction {
  const [whole, part = ''] = input.split('.');
  return fraction(BigInt(`${whole}${part}`), power(part.length));
}
function exponent(value: Fraction): number {
  const n = abs(value.n);
  let exp = n.toString().length - value.d.toString().length;
  if (exp >= 0 ? n < value.d * power(exp) : n * power(-exp) < value.d) exp--;
  return exp;
}
/** Округление выполняется целыми; Number используется только для размеров строк и показателя степени. */
function rounded(value: Fraction): { digits: string; exp: number; negative: boolean } {
  if (!value.n) return { digits: '0', exp: 0, negative: false };
  let exp = exponent(value);
  if (Math.abs(exp) > MAX_EXPONENT) throw new CalculationError('overflow');
  const shift = DISPLAY_DIGITS - 1 - exp;
  const n = abs(value.n) * (shift >= 0 ? power(shift) : 1n);
  const d = value.d * (shift < 0 ? power(-shift) : 1n);
  let digits = ((n * 2n + d) / (d * 2n)).toString();
  if (digits.length > DISPLAY_DIGITS) { exp++; digits = digits.slice(0, DISPLAY_DIGITS); }
  if (exp > MAX_EXPONENT) throw new CalculationError('overflow');
  return { digits: digits.replace(/0+$/, ''), exp, negative: value.n < 0n };
}
function format(value: Fraction, scientific = true): string {
  const { digits, exp, negative } = rounded(value);
  const sign = negative ? '-' : '';
  if (digits === '0') return '0';
  if (scientific && (exp < -6 || exp >= DISPLAY_DIGITS)) return `${sign}${digits[0]}${digits.length > 1 ? `.${digits.slice(1)}` : ''}e${exp >= 0 ? '+' : ''}${exp}`;
  if (exp < 0) return `${sign}0.${'0'.repeat(-exp - 1)}${digits}`;
  if (digits.length <= exp + 1) return sign + digits.padEnd(exp + 1, '0');
  return `${sign}${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`;
}
function operation(a: Fraction, op: Operator, b: Fraction): Fraction {
  const result = op === '+' ? fraction(a.n * b.d + b.n * a.d, a.d * b.d)
    : op === '−' ? fraction(a.n * b.d - b.n * a.d, a.d * b.d)
    : op === '×' ? fraction(a.n * b.n, a.d * b.d) : fraction(a.n * b.d, a.d * b.n);
  rounded(result);
  return result;
}
function sqrt(value: Fraction): Fraction {
  if (value.n < 0n) throw new CalculationError('negative_root');
  if (!value.n) return zero;
  const shift = ROOT_DIGITS - Math.floor(exponent(value) / 2);
  const scaled = shift >= 0 ? value.n * power(shift * 2) / value.d : value.n / (value.d * power(-shift * 2));
  let root = 1n << BigInt(Math.ceil(scaled.toString(2).length / 2));
  for (;;) {
    const next = (root + scaled / root) / 2n;
    if (next >= root) break;
    root = next;
  }
  return shift >= 0 ? fraction(root, power(shift)) : fraction(root * power(-shift));
}
const isNumber = (token: Token | undefined): token is Fraction => typeof token === 'object';
const isOperator = (token: Token | undefined): token is Operator => token === '+' || token === '−' || token === '×' || token === '÷';
function evaluate(tokens: Token[]): Fraction {
  let cursor = 0;
  const atom = (): Fraction => {
    const token = tokens[cursor++];
    if (isNumber(token)) return token;
    if (token === '(') {
      const result = sum();
      if (tokens[cursor++] !== ')') throw new CalculationError('parentheses');
      return result;
    }
    throw new CalculationError(token === ')' ? 'parentheses' : 'incomplete');
  };
  const product = (): Fraction => {
    let result = atom();
    while (tokens[cursor] === '×' || tokens[cursor] === '÷') {
      const op = tokens[cursor++] as Operator;
      result = operation(result, op, atom());
    }
    return result;
  };
  const sum = (): Fraction => {
    let result = product();
    while (tokens[cursor] === '+' || tokens[cursor] === '−') {
      const op = tokens[cursor++] as Operator;
      result = operation(result, op, product());
    }
    return result;
  };
  const result = sum();
  if (cursor !== tokens.length) throw new CalculationError('parentheses');
  return result;
}
const expression = (tokens: Token[]) => tokens.map((token) => isNumber(token) ? format(token) : token).join(' ');
const current = (state: CalculatorState): Fraction | null => state.entry ? decimal(state.entry) : state.value;
function flush(state: CalculatorState): Token[] {
  const value = current(state);
  return value ? [...state.tokens, value] : [...state.tokens];
}
export function initialCalculator(): CalculatorState {
  return { tokens: [], entry: '', value: null, memory: zero, display: '', expression: '', error: null, evaluated: false, announcement: 0 };
}
/** Копия состояния не содержит DOM, React и долговременного хранилища. */
export function pressCalculator(previous: CalculatorState, input: string): CalculatorState {
  const key = input === ',' ? '.' : input === '*' ? '×' : input === '/' ? '÷' : input === '-' ? '−' : input;
  let state = { ...previous, tokens: [...previous.tokens] };
  try {
    if (key === 'MC') return { ...state, memory: zero };
    if (key === 'C') return { ...initialCalculator(), memory: state.memory, announcement: state.announcement };
    if (state.error) {
      if (!/^[0-9.]$/.test(key) && key !== 'CE' && key !== 'MR') return state;
      state = { ...initialCalculator(), memory: state.memory, announcement: state.announcement };
    }
    if (/^[0-9.]$/.test(key)) {
      if (state.evaluated) state = { ...initialCalculator(), memory: state.memory, announcement: state.announcement };
      if (!state.entry && !state.value && state.tokens.at(-1) === ')') state.tokens.push('×');
      let entry = state.entry || (key === '.' ? '0' : '');
      if (key === '.' && entry.includes('.')) return state;
      entry += key;
      entry = entry.replace(/^(-?)0+(?=\d)/, '$1');
      if (entry.replace(/[-.]/g, '').replace(/^0+/, '').length > DISPLAY_DIGITS) return state;
      const value = decimal(entry);
      if (value.n) rounded(value);
      if (entry.length > MAX_EXPONENT + DISPLAY_DIGITS + 2) throw new CalculationError('overflow');
      return { ...state, entry, value: null, display: entry, expression: expression(state.tokens) };
    }
    if (key === 'CE') {
      if (state.evaluated) return { ...initialCalculator(), memory: state.memory, announcement: state.announcement };
      if (!current(state) && state.tokens.at(-1) === ')') removeGroup(state);
      return { ...state, entry: '', value: null, display: '', expression: expression(state.tokens) };
    }
    if (key === 'MR') {
      if (state.tokens.at(-1) === ')') removeGroup(state);
      return { ...state, entry: '', value: state.memory, display: format(state.memory), evaluated: false, announcement: state.announcement + 1 };
    }
    if (key === 'M+') {
      const value = current(state) ?? (state.tokens.at(-1) === ')' ? evaluate(state.tokens) : null);
      return value ? { ...state, memory: operation(state.memory, '+', value) } : state;
    }
    if (key === '±' || key === '√') {
      if (key === '±' && state.entry) {
        const entry = state.entry.startsWith('-') ? state.entry.slice(1) : `-${state.entry}`;
        return { ...state, entry, display: entry, announcement: state.announcement + 1 };
      }
      let value = current(state);
      if (!value && state.tokens.at(-1) === ')') value = removeGroup(state);
      if (!value) value = zero;
      value = key === '±' ? { ...value, n: -value.n } : sqrt(value);
      return { ...state, entry: '', value, display: format(value), expression: expression(state.tokens), announcement: state.announcement + 1 };
    }
    if (key === '(') {
      const tokens = state.evaluated ? [] : flush(state);
      if (isNumber(tokens.at(-1)) || tokens.at(-1) === ')') tokens.push('×');
      tokens.push('(');
      state = { ...state, tokens, entry: '', value: null, evaluated: false, expression: expression(tokens) };
    } else if (key === ')') {
      const tokens = flush(state);
      if (tokens.filter((token) => token === '(').length <= tokens.filter((token) => token === ')').length) throw new CalculationError('parentheses');
      tokens.push(')');
      const start = lastGroupStart(tokens);
      const display = format(evaluate(tokens.slice(start)));
      state = { ...state, tokens, entry: '', value: null, display, expression: expression(tokens) };
    } else if (isOperator(key as Token)) {
      const tokens = state.evaluated ? [current(state) ?? zero] : flush(state);
      if (isOperator(tokens.at(-1))) tokens[tokens.length - 1] = key as Operator;
      else if (!tokens.length || tokens.at(-1) === '(') {
        if (key !== '−') return state;
        return { ...state, entry: '-0', value: null, display: '-0' };
      } else tokens.push(key as Operator);
      state = { ...state, tokens, entry: '', value: null, evaluated: false, expression: expression(tokens) };
    } else if (key === '=') {
      if (state.evaluated || !state.tokens.length && !current(state)) return state;
      const tokens = flush(state);
      const value = evaluate(tokens);
      return { ...state, tokens: [], entry: '', value, display: format(value), expression: `${expression(tokens)} =`, evaluated: true, announcement: state.announcement + 1 };
    } else return state;
    if (state.tokens.length > MAX_TOKENS) throw new CalculationError('overflow');
    return state;
  } catch (error) {
    if (!(error instanceof CalculationError)) throw error;
    return { ...previous, error: error.code, display: '', announcement: previous.announcement + 1 };
  }
}
function lastGroupStart(tokens: Token[]): number {
  let nesting = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i] === ')') nesting++;
    else if (tokens[i] === '(' && --nesting === 0) return i;
  }
  throw new CalculationError('parentheses');
}
function removeGroup(state: CalculatorState): Fraction {
  const start = lastGroupStart(state.tokens);
  const value = evaluate(state.tokens.slice(start));
  state.tokens = state.tokens.slice(0, start);
  return value;
}
/** В ответ уходит именно округлённое число дисплея, развёрнутое без экспоненты. */
export function calculatorAnswer(state: CalculatorState): string | undefined {
  if (state.error || !state.display) return;
  const [mantissa, exp] = state.display.split('e');
  if (!exp) return format(decimal(mantissa!), false);
  const value = decimal(mantissa!);
  const shift = Number(exp);
  return format(shift >= 0 ? fraction(value.n * power(shift), value.d) : fraction(value.n, value.d * power(-shift)), false);
}
