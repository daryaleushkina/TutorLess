import { readFileSync } from 'node:fs';
import { gradeTrainingAnswer, trainingNumericSolution } from '@greprep/api-client';
import { schemas } from '@greprep/api-client';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { answerFormat, draftAnswer } from './QuestionContent';
import { storedTraining } from './model';
import { TrainingRules } from './rules';

// Новые форматы проверяются отдельно; старые примеры всё ещё читаются приложением Android целиком.
const fixture = z.object({ answers: z.array(z.object({
  name: z.string(), question: schemas.Question, answer: schemas.GivenAnswer,
  correct: z.boolean(), badAnswer: z.boolean(),
})) }).parse(JSON.parse(readFileSync(new URL('../../../../api/conformance/question-types.json', import.meta.url), 'utf8')));

describe('новые формы ответа в общем договоре', () => {
  for (const c of fixture.answers) test(c.name, () => {
    expect(gradeTrainingAnswer(c.question, c.answer)).toEqual({ correct: c.correct, badAnswer: c.badAnswer });
  });
});

describe('реестр ответа использует общий договор', () => {
  for (const c of fixture.answers) test(c.name, () => {
    const format = answerFormat(c.question);
    expect(format).toBeDefined();
    expect(format?.isCorrect(c.question, c.answer)).toBe(c.correct);
    if (!c.badAnswer) {
      const restored = draftAnswer(c.question, format!.decode(c.answer));
      expect(format?.isCorrect(c.question, restored)).toBe(c.correct);
    }
    if (c.question.questionType === 'numeric_entry' || c.question.questionType === 'select_in_passage') {
      const hasValue = c.answer.numericAnswer !== undefined || c.answer.sentenceId !== undefined;
      expect(format?.isComplete(c.question, c.answer)).toBe(hasValue && !c.answer.dontKnow && !c.badAnswer);
    }
  });
  test('итог учитывает ответы без optionIds', () => {
    const examples = fixture.answers.filter((c) => c.correct && c.question.questionType !== 'multiple_choice_multi').slice(0, 2);
    const training = storedTraining({ id: '00000000-0000-4000-8000-000000000100', mode: 'practice', section: 'quant',
      questionTypes: ['numeric_entry'], startedAt: '2026-10-12T00:00:00Z',
      items: examples.map((c, position) => ({ position, question: c.question, answer: { ...c.answer, position } })),
    }, Date.now());
    expect(TrainingRules.result(training)).toMatchObject({ correct: examples.length, unanswered: 0 });
  });
});

describe('числовой ключ в разборе использует то же округление', () => {
  for (const c of fixture.answers.filter((c) => c.question.questionType === 'numeric_entry')) test(c.name, () => {
    const numericAnswer = trainingNumericSolution(c.question);
    expect(gradeTrainingAnswer(c.question, { ...c.answer, optionIds: [], sentenceId: undefined, dontKnow: false, numericAnswer }).correct).toBe(true);
  });
  test('повреждённое задание не превращается в числовой ответ', () => {
    const q = fixture.answers.find((c) => c.question.questionType === 'numeric_entry')!.question;
    expect(trainingNumericSolution({ ...q, numericEntry: undefined })).toEqual(q.numericAnswer);
    expect(trainingNumericSolution({ ...q, numericAnswer: undefined })).toBeUndefined();
    const bad = { ...q, numericAnswer: { number: 'invalid' }, numericEntry: { format: 'number' as const, decimalPlaces: 2 } };
    expect(trainingNumericSolution(bad)).toBeUndefined();
    expect(gradeTrainingAnswer({ ...q, numericEntry: undefined }, fixture.answers.find((c) => c.question.questionType === 'numeric_entry')!.answer).badAnswer).toBe(true);
  });
  test('десятичная точка без целой части, минус и округление до целого', () => {
    const q = fixture.answers.find((c) => c.question.questionType === 'numeric_entry')!.question;
    const question = { ...q, numericAnswer: { number: '-.875' }, numericEntry: { format: 'number' as const, decimalPlaces: 0 } };
    expect(trainingNumericSolution(question)).toEqual({ number: '-1' });
    expect(gradeTrainingAnswer(question, { ...fixture.answers[0]!.answer, optionIds: [], numericAnswer: { number: '-1' } }).correct).toBe(true);
    const integer = { ...q, numericAnswer: { number: '7' }, numericEntry: { format: 'number' as const, decimalPlaces: 2 } };
    expect(trainingNumericSolution(integer)).toEqual({ number: '7.00' });
    const fraction = { ...question, numericEntry: { format: 'fraction' as const, decimalPlaces: 1 }, numericAnswer: { numerator: '1', denominator: '3' } };
    expect(trainingNumericSolution(fraction)).toEqual({ numerator: '3', denominator: '10' });
  });
});

const legacy = z.object({ answers: z.array(z.discriminatedUnion('badAnswer', [
  z.object({ name: z.string(), question: schemas.Question, answer: schemas.GivenAnswer, correct: z.boolean(), badAnswer: z.literal(false) }),
  z.object({ name: z.string(), badAnswer: z.literal(true) }),
])) }).parse(JSON.parse(readFileSync(new URL('../../../../api/conformance/training-rules.json', import.meta.url), 'utf8')));
for (const c of legacy.answers) if (!c.badAnswer) test(`реестр прежних форматов: ${c.name}`, () => {
  expect(answerFormat(c.question)?.isCorrect(c.question, c.answer)).toBe(c.correct);
});


for (const key of [undefined, { number: 'broken' }, { number: '' }]) test(`числовой кодек сохраняет форму независимо от ключа ${JSON.stringify(key)}`, () => {
  const original = fixture.answers.find((c) => c.question.questionType === 'numeric_entry' && c.question.numericEntry?.format === 'number')!;
  const q = { ...original.question, numericAnswer: key };
  const answer = draftAnswer(q, ['22,5']);
  expect(answer.numericAnswer).toEqual({ number: '22.5' });
  expect(answerFormat(q)?.isComplete(q, answer)).toBe(true);
});

for (const c of fixture.answers.filter((c) => c.question.questionType === 'numeric_entry' || c.question.questionType === 'select_in_passage')) test(`пачка проверки не содержит неполный ввод: ${c.name}`, () => {
  const q = c.question;
  const values = q.questionType === 'select_in_passage' ? [[], ['missing'], ['', 'unexpected']] : q.numericEntry?.format === 'fraction' ? [[], ['9'], ['9', '-']] : [[], ['-'], ['.']];
  for (const value of values) {
    const answer = draftAnswer(q, value);
    expect(answer).not.toHaveProperty('numericAnswer');
    expect(answer).not.toHaveProperty('sentenceId');
  }
});
