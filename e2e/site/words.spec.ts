import { test } from '../fixtures';
import { dictionaryFlow, wordsRace, wordsRecovery } from '../words';

test('словарь: список по рейтингу, страницы, поиск, карточка и назад', async ({ site }) => dictionaryFlow(site));
test('ошибка, повтор и отсутствие сети', async ({ site }) => {
  test.info().annotations.push({ type: 'expects-5xx', description: 'словарь отказывает нарочно' });
  await wordsRecovery(site);
});
test('запоздавший поиск не заменяет свежий', async ({ site }) => wordsRace(site));
