import { test } from '../fixtures';
import { firstSelection, profileSettings, switchExam } from '../shellFlows';
test('профиль: тема, размер, язык с сохранением и откатом, disabled и выход', async ({ site }) => profileSettings(site, 'site'));
test('экзамен: смена через T7 и пустые разделы TOEFL', async ({ site }) => switchExam(site));
test('первый вход выбирает экзамен через T3', async ({ site }) => firstSelection(site, 'site'));

import { repeatRealMistake } from '../shellFlows';
test('повтор реальной ошибки открывает новую тренировку', async ({ site: page }) => repeatRealMistake(page));
