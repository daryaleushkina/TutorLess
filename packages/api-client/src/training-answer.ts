import type { GivenAnswer, NumericAnswer, Question } from './generated/model/index.zod';

interface Rational { numerator: bigint; denominator: bigint }
const decimal = /^-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/;
const integer = /^-?[0-9]+$/;
function matches(value: string | undefined, pattern: RegExp): value is string {
  return value !== undefined && value.length <= 128 && pattern.exec(value)?.[0] === value;
}
function numericValue(answer: NumericAnswer, format: 'number' | 'fraction'): Rational | undefined {
  if (format === 'fraction') {
    if (answer.number !== undefined || !matches(answer.numerator, integer) || !matches(answer.denominator, integer)) return undefined;
    let numerator = BigInt(answer.numerator);
    let denominator = BigInt(answer.denominator);
    if (denominator === 0n) return undefined;
    if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
    return { numerator, denominator };
  }
  if (answer.numerator !== undefined || answer.denominator !== undefined || !matches(answer.number, decimal)) return undefined;
  const negative = answer.number.startsWith('-');
  const parts = answer.number.replace(/^-/, '').split('.');
  return { numerator: BigInt((parts[0] || '0') + (parts[1] ?? '')) * (negative ? -1n : 1n), denominator: 10n ** BigInt(parts[1]?.length ?? 0) };
}
function rounded(value: Rational, places: number): Rational {
  const denominator = 10n ** BigInt(places);
  const scaled = value.numerator * denominator;
  const absolute = scaled < 0n ? -scaled : scaled;
  const quotient = absolute / value.denominator;
  const half = (absolute % value.denominator) * 2n >= value.denominator;
  return { numerator: (quotient + (half ? 1n : 0n)) * (scaled < 0n ? -1n : 1n), denominator };
}

// Общие примеры проверяют точное значение без Number: двоичная погрешность не должна менять балл.
export function gradeTrainingAnswer(question: Question, answer: GivenAnswer): { correct: boolean; badAnswer: boolean } {
  const bad = { correct: false, badAnswer: true };
  const wrong = { correct: false, badAnswer: false };
  const ids = answer.optionIds;
  const numeric = answer.numericAnswer;
  const sentence = answer.sentenceId;
  if (answer.dontKnow && (ids.length > 0 || numeric !== undefined || sentence !== undefined)) return bad;
  if (question.questionType === 'numeric_entry') {
    if (ids.length > 0 || sentence !== undefined) return bad;
    if (numeric === undefined) return wrong;
    const spec = question.numericEntry;
    const keyAnswer = question.numericAnswer;
    if (!spec || !keyAnswer) return bad;
    const value = numericValue(numeric, spec.format);
    const key = numericValue(keyAnswer, spec.format);
    if (!value || !key) return bad;
    const expected = spec.decimalPlaces === undefined ? key : rounded(key, spec.decimalPlaces);
    return { correct: value.numerator * expected.denominator === expected.numerator * value.denominator, badAnswer: false };
  }
  if (question.questionType === 'select_in_passage') {
    if (ids.length > 0 || numeric !== undefined) return bad;
    if (sentence === undefined) return wrong;
    if (!question.passage?.paragraphs.some((p) => p.sentences.some((s) => s.id === sentence))) return bad;
    return { correct: question.answer.length === 1 && question.answer[0] === sentence, badAnswer: false };
  }
  if (numeric !== undefined || sentence !== undefined || new Set(ids).size !== ids.length) return bad;
  for (const id of ids) if (!question.groups.some((g) => g.options.some((o) => o.id === id))) return bad;
  if (!(question.questionType === 'multiple_choice_multi' && question.selectCount === 0) &&
      question.groups.some((g) => g.options.filter((o) => ids.includes(o.id)).length > question.selectCount)) return bad;
  return { correct: ids.length > 0 && ids.length === question.answer.length && question.answer.every((id) => ids.includes(id)), badAnswer: false };
}
