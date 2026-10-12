import { readFileSync } from 'node:fs';
import { gradeTrainingAnswer } from '@greprep/api-client';
import { schemas } from '@greprep/api-client';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

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
