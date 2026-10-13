import { test, expect } from '../fixtures';
import { dictionaryFlow, wordList, wordsRace, wordsRecovery } from '../words';

test('словарь: список по рейтингу, страницы, поиск, карточка и назад', async ({ miniApp }) => dictionaryFlow(miniApp));
test('ошибка, повтор и отсутствие сети', async ({ miniApp }) => {
  test.info().annotations.push({ type: 'expects-5xx', description: 'словарь отказывает нарочно' });
  await wordsRecovery(miniApp);
});
test('запоздавший поиск не заменяет свежий', async ({ miniApp }) => wordsRace(miniApp));
test('API от человека не выдаёт черновики и слова другого экзамена', async ({ miniApp: _page, me }) => {
  const list = wordList(await me.api('GET', '/words?exam=gre'));
  expect(list.words.map((word) => word.lemma)).toEqual(['zorble', 'zorbling', 'flimble', 'glimlet', 'thrumple', 'plindle']);
  const foreign = wordList(await me.api('GET', '/words?exam=toefl'));
  expect(foreign.words.map((word) => word.lemma)).toEqual(['foreignling']);
});
