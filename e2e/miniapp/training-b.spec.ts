import { test } from '../fixtures';
import { checkStatesB, equivalenceB, existingAnswersB, EXISTING_ANSWERS_B, practiceBackB, quantBuilderB, invalidReviewBackB } from '../training-b';
test('B: назад в практике с неизменным ответом и черновиком', async ({ miniApp }) => { await practiceBackB(miniApp); });
test('B: Sentence Equivalence — ровно два слова без подсказок клавиш', async ({ miniApp }) => { await equivalenceB(miniApp); });
test('B: конструктор Quant сохраняет число вопросов секции', async ({ miniApp }) => { await quantBuilderB(miniApp); });
test('B: неверная ссылка разбора сохраняет возврат к списку', async ({ miniApp }) => { await invalidReviewBackB(miniApp); });
for (const answer of EXISTING_ANSWERS_B) test(`B: полные ответы ${answer[0]} и всех пропусков`, async ({ miniApp }) => { await existingAnswersB(miniApp, answer); });
test('B: минута до конца, подтверждение с пропусками, таймаут и фильтр отмеченных', async ({ miniApp }) => { await checkStatesB(miniApp); });
