import { test } from '../fixtures';
import { NEW_TYPES, newTypesSession, numericConformanceUi, numericInvalidPaste, readingScroll, explicitNumericExamples, flaggedHover } from '../training-types';

for (const type of NEW_TYPES) test(`B новые: сессия ${type[0]} ${type[1]}, перезагрузка и очередь без сети`, async ({ site }) => { await newTypesSession(site, type); });
test('B новые: ввод по общим примерам правил', async ({ site }) => { await numericConformanceUi(site); });
test('B новые: плохой ввод из буфера остаётся черновиком', async ({ site }) => { await numericInvalidPaste(site); });
test('B новые: RC сохраняет прокрутку текста и открывает следующий вопрос', async ({ site }) => { await readingScroll(site); });
test('B новые: 22,5 = 22.50 и 9/15 = 3/5, черновик после перезагрузки', async ({ site }) => { await explicitNumericExamples(site); });
test('B новые: отметка проверки читается под указателем', async ({ site }) => { await flaggedHover(site); });
