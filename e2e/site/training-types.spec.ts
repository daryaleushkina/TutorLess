import { test } from '../fixtures';
import { NEW_TYPES, newTypesSession, numericConformanceUi, numericInvalidPaste, readingScroll, explicitNumericExamples, flaggedHover, readingKeyboard, readingShortcuts, longOpenQuestion, suspendedWriteExit, partialBatch } from '../training-types';

for (const type of NEW_TYPES) test(`B новые: сессия ${type[0]} ${type[1]}, перезагрузка и очередь без сети`, async ({ site }) => { await newTypesSession(site, type); });
test('B новые: ввод по общим примерам правил', async ({ site }) => { await numericConformanceUi(site); });
test('B новые: плохой ввод из буфера остаётся черновиком', async ({ site }) => { await numericInvalidPaste(site); });
test('B новые: RC сохраняет прокрутку текста и открывает следующий вопрос', async ({ site }) => { await readingScroll(site); });
test('B новые: 22,5 = 22.50 и 9/15 = 3/5, черновик после перезагрузки', async ({ site }) => { await explicitNumericExamples(site); });
test('B новые: отметка проверки читается под указателем', async ({ site }, info) => { if (!info.project.use.hasTouch) await flaggedHover(site); });

for (const type of NEW_TYPES) test(`B новые: проверка ${type[0]} ${type[1]}, очередь без сети`, async ({ site }) => { await newTypesSession(site, type, 'check'); });
test('B новые: пустые и частичные поля не попадают в пачку проверки', async ({ site }) => { await partialBatch(site); });
for (const mode of ['practice', 'check'] as const) test(`B новые: стрелки RC на втором вопросе ${mode}`, async ({ site }) => { await readingKeyboard(site, mode); });
test('B новые: RC выбирает буквами на тексте и проверяет Enter после варианта', async ({ site }) => { await readingShortcuts(site); });
test('B новые: проверка вопроса, открытого больше суток', async ({ site }) => { await longOpenQuestion(site); });
test('B новые: крестик выходит при зависшей записи', async ({ site }) => { await suspendedWriteExit(site); });
