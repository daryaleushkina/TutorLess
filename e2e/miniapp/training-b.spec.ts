import { test } from '../fixtures';
import { checkStatesB, equivalenceB, existingAnswersB, EXISTING_ANSWERS_B, practiceBackB, quantBuilderB, invalidReviewBackB } from '../training-b';
test('B: назад в практике с неизменным ответом и черновиком', async ({ miniApp }) => { await practiceBackB(miniApp); });
test('B: Sentence Equivalence — ровно два слова без подсказок клавиш', async ({ miniApp }) => { await equivalenceB(miniApp); });
test('B: конструктор Quant запрашивает секцию и обещает доступное число', async ({ miniApp }) => { await quantBuilderB(miniApp); });
test('B: неверная ссылка разбора сохраняет возврат к списку', async ({ miniApp }) => { await invalidReviewBackB(miniApp); });
for (const answer of EXISTING_ANSWERS_B) test(`B: полные ответы ${answer[0]} и всех пропусков`, async ({ miniApp }) => { await existingAnswersB(miniApp, answer); });
test('B: минута до конца, подтверждение с пропусками, таймаут и фильтр отмеченных', async ({ miniApp }) => { await checkStatesB(miniApp); });

import { exitCheckB, timeoutOverlayB, missingReportB } from '../training-b';
test('B ревью: выход сохраняет ответы и время продолжает идти', async ({ miniApp }) => { await exitCheckB(miniApp); });
for (const overlay of ['overview', 'exit'] as const) test(`B ревью: таймаут со шторкой ${overlay}`, async ({ miniApp }) => { await timeoutOverlayB(miniApp, overlay); });
test('B ревью: недоступная жалоба и неверные параметры сохраняют возврат', async ({ miniApp }) => { await missingReportB(miniApp); });

import { reportRetryB } from '../training-b';
test('B ревью: потерянный ответ жалобы повторяется с тем же id', async ({ miniApp, me }) => { await reportRetryB(miniApp, me, true); });
