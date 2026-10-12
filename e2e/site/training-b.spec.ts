import { test } from '../fixtures';
import { checkStatesB, equivalenceB, existingAnswersB, EXISTING_ANSWERS_B, practiceBackB, quantBuilderB, invalidReviewBackB } from '../training-b';
test('B: назад в практике с неизменным ответом и черновиком', async ({ site }) => { await practiceBackB(site); });
test('B: Sentence Equivalence — ровно два слова без подсказок клавиш', async ({ site }) => { await equivalenceB(site); });
test('B: конструктор Quant запрашивает секцию и обещает доступное число', async ({ site }) => { await quantBuilderB(site); });
test('B: неверная ссылка разбора сохраняет возврат к списку', async ({ site }) => { await invalidReviewBackB(site); });
for (const answer of EXISTING_ANSWERS_B) test(`B: полные ответы ${answer[0]} и всех пропусков`, async ({ site }) => { await existingAnswersB(site, answer); });
test('B: минута до конца, подтверждение с пропусками, таймаут и фильтр отмеченных', async ({ site }) => { await checkStatesB(site); });

import { exitCheckB, timeoutOverlayB, missingReportB } from '../training-b';
test('B ревью: выход сохраняет ответы и время продолжает идти', async ({ site }) => { await exitCheckB(site); });
for (const overlay of ['overview', 'exit'] as const) test(`B ревью: таймаут со шторкой ${overlay}`, async ({ site }) => { await timeoutOverlayB(site, overlay); });
test('B ревью: недоступная жалоба и неверные параметры сохраняют возврат', async ({ site }) => { await missingReportB(site); });

import { reportRetryB } from '../training-b';
test('B ревью: потерянный ответ жалобы повторяется с тем же id', async ({ site, me }) => { await reportRetryB(site, me); });
