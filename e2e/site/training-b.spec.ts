import { test } from '../fixtures';
import { checkStatesB, equivalenceB, existingAnswersB, EXISTING_ANSWERS_B, practiceBackB, quantBuilderB, invalidReviewBackB } from '../training-b';
test('B: назад в практике с неизменным ответом и черновиком', async ({ site }) => { await practiceBackB(site); });
test('B: Sentence Equivalence — ровно два слова без подсказок клавиш', async ({ site }) => { await equivalenceB(site); });
test('B: конструктор Quant сохраняет число вопросов секции', async ({ site }) => { await quantBuilderB(site); });
test('B: неверная ссылка разбора сохраняет возврат к списку', async ({ site }) => { await invalidReviewBackB(site); });
for (const answer of EXISTING_ANSWERS_B) test(`B: полные ответы ${answer[0]} и всех пропусков`, async ({ site }) => { await existingAnswersB(site, answer); });
test('B: минута до конца, подтверждение с пропусками, таймаут и фильтр отмеченных', async ({ site }) => { await checkStatesB(site); });
