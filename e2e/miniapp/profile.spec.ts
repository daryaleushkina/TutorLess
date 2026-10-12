import { expect, test } from '../fixtures';
import { firstSelection, profileSettings, switchExam } from '../shellFlows';
test('профиль: тема, размер, язык с сохранением и откатом, disabled', async ({ miniApp }) => profileSettings(miniApp, 'telegram'));
test('экзамен: смена через T7 и пустые разделы TOEFL', async ({ miniApp }) => switchExam(miniApp));
test('первый вход выбирает экзамен через T3', async ({ miniApp }) => firstSelection(miniApp, 'telegram'));
test('повтор ошибок запускает source mistakes', async ({ miniApp: page }) => {
  await page.route('**/api/home?**', (route) => route.fulfill({ json: { lastTraining: null, sections: [{ section: 'verbal', total: 10, correct: 7 }], mistakes: 3, weakSpot: null, week: { days: 1, answers: 10, minutes: 12 } } }));
  await page.reload();
  const posted = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/trainings'));
  await page.route('**/api/trainings', (route) => route.fulfill({ status: 409, json: { code: 'no_questions', message: 'synthetic empty', requestId: 'mistakes' } }));
  await page.getByRole('button', { name: /Повторить мои ошибки/ }).click();
  expect((await posted).postDataJSON()).toMatchObject({ exam: 'gre', source: 'mistakes' });
  await expect(page.getByRole('alert')).toBeVisible();
});

import { repeatRealMistake } from '../shellFlows';
test('повтор реальной ошибки открывает новую тренировку', async ({ miniApp: page }) => repeatRealMistake(page));
