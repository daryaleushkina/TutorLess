import { gradeTrainingAnswer, type GivenAnswer, type Question } from '@greprep/api-client';
import type { Dict } from '../i18n/dict';
import { ChoiceRules } from './choiceRules';

/** Модель формата не загружает экран: репозиторий и главная используют её до ленивой сессии. */
export interface AnswerFormat {
  component: 'choice' | 'numeric' | 'passage';
  instruction: (question: Question, text: Dict['training']) => string;
  title?: (question: Question, text: Dict['training']) => string;
  decode: (answer: GivenAnswer) => string[];
  encode: (question: Question, value: string[]) => Pick<GivenAnswer, 'optionIds' | 'numericAnswer' | 'sentenceId'>;
  isComplete: (question: Question, answer: GivenAnswer | undefined) => boolean;
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
  isCorrect,
  select: (question, value, input) => question.questionType === 'sentence_equivalence' && value.length >= question.selectCount && !value.includes(input)
    ? { value, limit: true } : { value: question.questionType === 'multiple_choice_multi' && question.selectCount === 0
      ? value.includes(input) ? value.filter((id) => id !== input) : [...value, input] : ChoiceRules.toggle(question, value, input), limit: false },
  selectKey: (question, value, key) => {
    const group = question.groups.find((group) => !group.options.some((option) => value.includes(option.id))) ?? question.groups[0];
    return group?.options[key.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)]?.id;
  },
};
const numericFormat: AnswerFormat = {
  component: 'numeric',
  title: (question, text) => question.numericEntry?.format === 'fraction' ? text.type_fraction_title : text.type_number_title,
  instruction: (question, text) => question.numericEntry?.format === 'fraction' ? text.instruction_fraction : text.instruction_number,
  decode: (answer) => answer.numericAnswer ? answer.numericAnswer.number !== undefined ? [answer.numericAnswer.number] : [answer.numericAnswer.numerator ?? '', answer.numericAnswer.denominator ?? ''] : [],
  encode: (question, value) => {
    const numericAnswer = question.numericEntry?.format === 'fraction'
      ? { numerator: value[0] ?? '', denominator: value[1] ?? '' } : { number: (value[0] ?? '').replaceAll(',', '.') };
    const answer: GivenAnswer = { position: 0, optionIds: [], numericAnswer, dontKnow: false, flagged: false, answeredAt: '1970-01-01T00:00:00Z', elapsedMs: 0 };
    return gradeTrainingAnswer(question, answer).badAnswer ? { optionIds: [] } : { optionIds: [], numericAnswer };
  },
  isComplete: (question, answer) => Boolean(answer?.numericAnswer && !answer.dontKnow && !gradeTrainingAnswer(question, answer).badAnswer),
  isCorrect, select: (_question, value) => ({ value, limit: false }),
};
const passageFormat: AnswerFormat = {
  component: 'passage',
  instruction: (_question, text) => text.instruction_sentence,
  decode: (answer) => answer.sentenceId ? [answer.sentenceId] : [],
  encode: (_question, value) => ({ optionIds: [], ...(value[0] && { sentenceId: value[0] }) }),
  isComplete: (question, answer) => Boolean(answer?.sentenceId && !answer.dontKnow && !gradeTrainingAnswer(question, answer).badAnswer),
  isCorrect, select: (_question, _value, input) => ({ value: [input], limit: false }),
};
const ANSWER_FORMATS: Partial<Record<Question['questionType'], AnswerFormat>> = {
  text_completion: choiceFormat, sentence_equivalence: choiceFormat,
  quantitative_comparison: choiceFormat, multiple_choice: choiceFormat,
  multiple_choice_multi: { ...choiceFormat, title: (_question, text) => text.type_multi_title, instruction: (question, text) => question.selectCount === 0 ? text.instruction_all : text.instruction_count(question.selectCount) },
  numeric_entry: numericFormat, select_in_passage: passageFormat,
};
export function answerFormat(question: Question) { return ANSWER_FORMATS[question.questionType]; }

