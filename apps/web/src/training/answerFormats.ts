import { gradeTrainingAnswer, type GivenAnswer, type NumericAnswer, type Question } from '@greprep/api-client';
import type { Dict } from '../i18n/dict';
import { ChoiceRules } from './choiceRules';
import { TYPE_LABELS } from './builder';

/** Модель формата не загружает экран: репозиторий и главная используют её до ленивой сессии. */
export interface AnswerFormat {
  component: 'choice' | 'numeric' | 'passage';
  instruction: (question: Question, text: Dict['training']) => string;
  title?: (question: Question, text: Dict['training']) => string;
  decode: (answer: GivenAnswer) => string[];
  encode: (question: Question, value: string[]) => Pick<GivenAnswer, 'optionIds' | 'numericAnswer' | 'sentenceId'>;
  isComplete: (question: Question, answer: GivenAnswer | undefined) => boolean;
  canAdvance: (question: Question, answer: GivenAnswer | undefined, complete: boolean) => boolean;
  isCorrect: (question: Question, answer: GivenAnswer | undefined) => boolean;
  select: (question: Question, value: string[], input: string) => { value: string[]; limit: boolean };
  selectKey?: (question: Question, value: string[], key: string) => string | undefined;
}
export function draftAnswer(question: Question, value: string[]): GivenAnswer {
  return { position: 0, ...(answerFormat(question)?.encode(question, value) ?? { optionIds: [] }), dontKnow: false, flagged: false, answeredAt: '1970-01-01T00:00:00Z', elapsedMs: 0 };
}
const isCorrect: AnswerFormat['isCorrect'] = (question, answer) => Boolean(answer && gradeTrainingAnswer(question, answer).correct);
const choiceFormat: AnswerFormat = {
  component: 'choice',
  instruction: (question, text) => question.selectCount === 2 ? text.instruction_two : question.groups.length > 1 ? text.instruction_blanks : text.instruction_one,
  decode: (answer) => answer.optionIds,
  encode: (_question, value) => ({ optionIds: value }),
  isComplete: (question, answer) => Boolean(answer && !answer.dontKnow && !gradeTrainingAnswer(question, answer).badAnswer &&
    (question.questionType === 'multiple_choice_multi' && question.selectCount === 0 ? answer.optionIds.length > 0 : ChoiceRules.isComplete(question, answer.optionIds))),
  canAdvance: (question, answer, complete) => complete || question.questionType !== 'multiple_choice_multi' && Boolean(answer?.optionIds.some(Boolean)),
  isCorrect,
  select: (question, value, input) => question.questionType === 'sentence_equivalence' && value.length >= question.selectCount && !value.includes(input)
    ? { value, limit: true } : { value: question.questionType === 'multiple_choice_multi' && question.selectCount === 0
      ? value.includes(input) ? value.filter((id) => id !== input) : [...value, input] : ChoiceRules.toggle(question, value, input), limit: false },
  selectKey: (question, value, key) => {
    const group = question.groups.find((group) => !group.options.some((option) => value.includes(option.id))) ?? question.groups[0];
    return group?.options[key.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)]?.id;
  },
};
// Форма ввода проверяется отдельно от ключа задания: повреждённый ключ не теряет ответ человека.
const NUMERIC_LIMIT = 128;
const decimal = /^-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/;
const integer = /^-?[0-9]+$/;
const matches = (value: string | undefined, pattern: RegExp) => value !== undefined && value.length <= NUMERIC_LIMIT && pattern.exec(value)?.[0] === value;
export function numericInputError(values: string[], fraction: boolean): 'too_long' | 'invalid' | 'zero' | undefined {
  if (values.some((value) => value.length > NUMERIC_LIMIT)) return 'too_long';
  if (values.some((value) => (fraction ? /^-?[0-9]*$/ : /^-?[0-9]*[.,]?[0-9]*$/).exec(value)?.[0] !== value)) return 'invalid';
  if (fraction && values[1] !== undefined && /^-?0+$/.exec(values[1])?.[0] === values[1]) return 'zero';
  return undefined;
}
function validNumeric(question: Question, value: NumericAnswer): boolean {
  if (question.numericEntry?.format === 'number') return value.numerator === undefined && value.denominator === undefined && matches(value.number, decimal);
  return question.numericEntry?.format === 'fraction' && value.number === undefined && matches(value.numerator, integer) && matches(value.denominator, integer) && !/^-?0+$/.test(value.denominator!);
}
export function questionTitle(question: Question, text: Dict['training']): string {
  return question.passage ? 'Reading Comprehension' : answerFormat(question)?.title?.(question, text) ?? TYPE_LABELS[question.questionType];
}
export function answerStateLabel(text: Dict['training'], selected: boolean, correct: boolean): string {
  return correct ? selected ? text.question_selected_correct : text.question_omitted_correct : selected ? text.question_selected_wrong : text.question_not_selected;
}
const numericFormat: AnswerFormat = {
  component: 'numeric',
  title: (question, text) => question.numericEntry?.format === 'fraction' ? text.type_fraction_title : text.type_number_title,
  instruction: (question, text) => question.numericEntry?.format === 'fraction' ? text.instruction_fraction : text.instruction_number,
  decode: (answer) => answer.numericAnswer ? answer.numericAnswer.number !== undefined ? [answer.numericAnswer.number] : [answer.numericAnswer.numerator ?? '', answer.numericAnswer.denominator ?? ''] : [],
  encode: (question, value) => {
    const numericAnswer = question.numericEntry?.format === 'fraction'
      ? { numerator: value[0] ?? '', denominator: value[1] ?? '' } : { number: (value[0] ?? '').replaceAll(',', '.') };
    return validNumeric(question, numericAnswer) ? { optionIds: [], numericAnswer } : { optionIds: [] };
  },
  isComplete: (question, answer) => Boolean(answer?.numericAnswer && !answer.dontKnow && !answer.optionIds.length && answer.sentenceId === undefined && validNumeric(question, answer.numericAnswer)),
  canAdvance: (_question, _answer, complete) => complete,
  isCorrect, select: (_question, value) => ({ value, limit: false }),
};
const passageFormat: AnswerFormat = {
  component: 'passage',
  instruction: (_question, text) => text.instruction_sentence,
  decode: (answer) => answer.sentenceId ? [answer.sentenceId] : [],
  encode: (question, value) => ({ optionIds: [], ...(value.length === 1 && question.passage?.paragraphs.some((p) => p.sentences.some((s) => s.id === value[0])) && { sentenceId: value[0] }) }),
  isComplete: (question, answer) => Boolean(answer?.sentenceId && !answer.dontKnow && !gradeTrainingAnswer(question, answer).badAnswer),
  canAdvance: (_question, _answer, complete) => complete,
  isCorrect, select: (_question, _value, input) => ({ value: [input], limit: false }),
};
const ANSWER_FORMATS: Partial<Record<Question['questionType'], AnswerFormat>> = {
  text_completion: choiceFormat, sentence_equivalence: choiceFormat,
  quantitative_comparison: choiceFormat, multiple_choice: choiceFormat,
  multiple_choice_multi: { ...choiceFormat, title: (_question, text) => text.type_multi_title, instruction: (question, text) => question.selectCount === 0 ? text.instruction_all : text.instruction_count(question.selectCount) },
  numeric_entry: numericFormat, select_in_passage: passageFormat,
};
export function answerFormat(question: Question) { return ANSWER_FORMATS[question.questionType]; }

