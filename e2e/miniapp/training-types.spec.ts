import { test } from '../fixtures';
import { NEW_TYPES, newTypesSession, numericConformanceUi, numericInvalidPaste, readingScroll, explicitNumericExamples, flaggedHover } from '../training-types';

for (const type of NEW_TYPES) test(`B новые: сессия ${type[0]} ${type[1]}, перезагрузка и очередь без сети`, async ({ miniApp }) => { await newTypesSession(miniApp, type); });
test('B новые: ввод по общим примерам правил', async ({ miniApp }) => { await numericConformanceUi(miniApp); });
test('B новые: плохой ввод из буфера остаётся черновиком', async ({ miniApp }) => { await numericInvalidPaste(miniApp); });
test('B новые: RC сохраняет прокрутку текста и открывает следующий вопрос', async ({ miniApp }) => { await readingScroll(miniApp); });
test('B новые: 22,5 = 22.50 и 9/15 = 3/5, черновик после перезагрузки', async ({ miniApp }) => { await explicitNumericExamples(miniApp); });
test('B новые: отметка проверки читается под указателем', async ({ miniApp }) => { await flaggedHover(miniApp); });
