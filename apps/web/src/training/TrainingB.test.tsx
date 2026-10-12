import { expect, test, vi } from 'vitest';
import { fakeServer, json, renderApp, OPTIONS, user } from '../test/app';
import { givenAnswer, questionFixture, trainingSession } from '../test/training';
import { storedTraining, type StoredTraining } from './model';
import { trainingRepository } from './repository';
import { page, userEvent } from 'vitest/browser';
import { reportSavedFeedback } from './TrainingFeedback';

async function boot(training: StoredTraining) {
  fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/trainings/options': () => json(OPTIONS) });
  vi.spyOn(trainingRepository, 'requestSync').mockImplementation(() => {});
  const app = await renderApp({ path: '/' });
  await expect.element(app.screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
  const owner = await trainingRepository.store.currentOwner();
  if (!owner) throw new Error('fixture owner missing');
  await trainingRepository.store.put(owner, training);
  await app.router.navigate({ to: '/training/$trainingId', params: { trainingId: training.session.id } });
  return app;
}

test('B: варианты без букв; третье слово SE не заменяет выбранные два', async () => {
  const q = questionFixture('sentence_equivalence');
  q.groups[0]!.options.forEach((o, i) => { o.text = ['first', 'second', 'third'][i]!; });
  const { screen } = await boot(storedTraining(trainingSession({ items: [{ position: 0, question: q }] }), Date.now()));
  const check = screen.getByRole('button', { name: 'Проверить', exact: true });
  await expect.element(check).toBeDisabled();
  await screen.getByRole('checkbox', { name: 'first', exact: true }).click();
  await expect.element(check).toBeDisabled();
  await screen.getByRole('checkbox', { name: 'second', exact: true }).click();
  await expect.element(check).toBeEnabled();
  await screen.getByRole('checkbox', { name: 'third', exact: true }).click();
  await expect.element(screen.getByRole('checkbox', { name: 'first', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect.element(screen.getByRole('checkbox', { name: 'third', exact: true })).toHaveAttribute('aria-checked', 'false');
});

test('B: «Не знаю» даёт нейтральное «Разберём» и сохраняет dontKnow', async () => {
  const { screen } = await boot(storedTraining(trainingSession(), Date.now()));
  await screen.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await expect.element(screen.getByText('Разберём', { exact: true })).toBeVisible();
  await expect.poll(async () => (await trainingRepository.get(trainingSession().id))?.answers['0']?.dontKnow).toBe(true);
});

test('B: прошлый ответ неизменен, возврат восстанавливает черновик текущего', async () => {
  const training = storedTraining(trainingSession(), Date.now());
  training.position = 1; training.answers['0'] = givenAnswer(); training.drafts = { 1: ['B'] };
  const { screen } = await boot(training);
  await screen.getByRole('button', { name: 'Предыдущий вопрос' }).click();
  await expect.element(screen.getByText(/ответ уже засчитан/)).toBeVisible();
  await expect.element(screen.getByTestId('explanation')).not.toBeInTheDocument();
  await screen.getByRole('button', { name: 'Показать разбор' }).click();
  await expect.element(screen.getByTestId('explanation')).toBeVisible();
  await screen.getByRole('button', { name: 'К вопросу 2' }).click();
  await expect.element(screen.getByRole('radio', { name: 'B', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('B: завершение проверки с пропусками требует подтверждения', async () => {
  const { screen } = await boot(storedTraining(trainingSession({ mode: 'check', timeLimitSeconds: 270 }), Date.now()));
  await screen.getByRole('button', { name: 'Вопросы', exact: true }).click();
  await expect.element(screen.getByRole('dialog', { name: 'Вопросы' })).toBeVisible();
  await screen.getByRole('button', { name: 'Завершить проверку', exact: true }).click();
  await expect.element(screen.getByRole('dialog', { name: 'Без ответа: 3. Завершить?' })).toBeVisible();
  await screen.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect.element(screen.getByRole('heading', { name: '0 из 3 верно' })).not.toBeInTheDocument();
});

test('B: конец времени — отдельный экран, затем итог', async () => {
  const training = storedTraining(trainingSession({ mode: 'check', timeLimitSeconds: 1 }), Date.now() - 2000);
  const { screen } = await boot(training);
  await expect.element(screen.getByRole('heading', { name: 'Время вышло', exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect.element(screen.getByRole('heading', { name: '0 из 3 верно' })).toBeVisible();
});

test('B: отказ диска при переходе с конца времени оставляет экран и предлагает повторить', async () => {
  const training = storedTraining(trainingSession({ mode: 'check', timeLimitSeconds: 1 }), Date.now() - 2000);
  const { screen } = await boot(training);
  await expect.element(screen.getByRole('heading', { name: 'Время вышло', exact: true })).toBeVisible();
  vi.spyOn(trainingRepository, 'acknowledgeTimeout').mockRejectedValue(new Error('Synthetic storage failure'));
  await screen.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect.element(screen.getByRole('alert')).toMatchTextContent(/Не получилось сохранить тренировку/);
  await expect.element(screen.getByRole('heading', { name: 'Время вышло', exact: true })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'К итогу', exact: true })).toBeEnabled();
});

test('B: стрелки на компьютере возвращают к прежнему ответу, на первом вопросе не выходят из сессии', async () => {
  const training = storedTraining(trainingSession(), Date.now());
  training.position = 1; training.answers['0'] = givenAnswer();
  const { screen } = await boot(training);
  await expect.element(screen.getByRole('button', { name: 'Предыдущий вопрос' })).toBeVisible();
  await userEvent.keyboard('{ArrowLeft}');
  await expect.element(screen.getByText(/ответ уже засчитан/)).toBeVisible();
  await userEvent.keyboard('{ArrowLeft}');
  await expect.element(screen.getByText(/ответ уже засчитан/)).toBeVisible();
  await userEvent.keyboard('{ArrowRight}');
  await expect.element(screen.getByText(/ответ уже засчитан/)).not.toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: 'Проверить', exact: true })).toBeVisible();
});

test('B: подтверждение таймаута не завершает действующую практику', async () => {
  const training = storedTraining(trainingSession(), Date.now());
  await boot(training);
  await trainingRepository.acknowledgeTimeout(training.session.id);
  const saved = await trainingRepository.get(training.session.id);
  expect(saved?.finish).toBeUndefined();
  expect(saved?.timeoutSeen).toBeUndefined();
});

test('B: фильтр отмеченных, время, все варианты, стрелки, свайп и язык между вопросами', async () => {
  const q = questionFixture('quantitative_comparison');
  const training = storedTraining(trainingSession({ mode: 'check', section: 'quant', items: [0, 1, 2].map((position) => ({ position, question: q })) }), Date.now());
  training.answers = { 0: givenAnswer({ optionIds: ['B'], flagged: true, elapsedMs: 100000 }), 1: givenAnswer({ position: 1, flagged: true, elapsedMs: 20000 }) };
  training.finish = { finishedAt: new Date().toISOString(), timedOut: false };
  const { screen } = await boot(training);
  await screen.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await screen.getByRole('button', { name: 'Отмеченные · 2' }).click();
  await expect.poll(() => screen.getByRole('link', { name: /^Вопрос / }).elements().length).toBe(2);
  await screen.getByRole('link', { name: /^Вопрос 1,/ }).click();
  await expect.element(screen.getByText(/1:40 — дольше среднего/)).toBeVisible();
  await screen.getByRole('button', { name: 'Все варианты' }).click();
  await expect.poll(() => screen.getByRole('radio').elements().length).toBe(3);
  await screen.getByRole('button', { name: 'Свернуть варианты' }).click();
  await expect.poll(() => screen.getByRole('radio').elements().length).toBe(2);
  await screen.getByRole('button', { name: 'EN', exact: true }).click();
  await screen.getByRole('button', { name: 'Следующий', exact: true }).click();
  await expect.element(screen.getByRole('heading', { name: 'Вопрос 2', exact: true })).toBeVisible();
  await expect.element(screen.getByTestId('explanation')).toHaveAttribute('lang', 'en');
  await screen.getByRole('button', { name: 'Предыдущий вопрос' }).click();
  await expect.element(screen.getByRole('heading', { name: 'Вопрос 1', exact: true })).toBeVisible();
  const region = screen.getByRole('region', { name: 'Вопрос 1', exact: true }).element();
  const touch = (x: number, y: number) => new Touch({ identifier: 1, target: region, clientX: x, clientY: y });
  region.dispatchEvent(new TouchEvent('touchend', { changedTouches: [], bubbles: true }));
  region.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(200, 100)], bubbles: true }));
  region.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(20, 220)], bubbles: true }));
  await expect.element(screen.getByRole('heading', { name: 'Вопрос 1', exact: true })).toBeVisible();
  region.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(200, 100)], bubbles: true }));
  region.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(20, 100)], bubbles: true }));
  await expect.element(screen.getByRole('heading', { name: 'Вопрос 2', exact: true })).toBeVisible();
  const second = screen.getByRole('region', { name: 'Вопрос 2', exact: true }).element();
  second.dispatchEvent(new TouchEvent('touchstart', { touches: [], bubbles: true }));
  second.dispatchEvent(new TouchEvent('touchend', { changedTouches: [], bubbles: true }));
  second.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(20, 100)], bubbles: true }));
  second.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(200, 100)], bubbles: true }));
  await expect.element(screen.getByRole('heading', { name: 'Вопрос 1', exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
  await expect.element(screen.getByRole('heading', { name: 'Вопрос 2', exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'К итогу', exact: true }).click();
  await expect.element(screen.getByRole('heading', { name: '1 из 3 верно' })).toBeVisible();
});

test('B: выход из проверки — подтверждение; отмена сохраняет выбранное, выход сохраняет сессию', async () => {
  const { screen } = await boot(storedTraining(trainingSession({ mode: 'check', timeLimitSeconds: 270 }), Date.now()));
  await screen.getByRole('radio', { name: 'A', exact: true }).click();
  await screen.getByRole('button', { name: 'Закрыть тренировку', exact: true }).click();
  await expect.element(screen.getByRole('dialog', { name: 'Выйти из проверки?' })).toBeVisible();
  await expect.element(screen.getByText('Ответы сохранятся.')).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(screen.getByRole('radio', { name: 'A', exact: true })).toHaveAttribute('aria-checked', 'true');
  await screen.getByRole('button', { name: 'Закрыть тренировку', exact: true }).click();
  await screen.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect.element(screen.getByRole('heading', { name: 'Тренировка', exact: true })).toBeVisible();
  await expect.poll(async () => (await trainingRepository.active())?.answers['0']?.optionIds).toEqual(['A']);
});

test('B: отмеченных нет; развёрнутые варианты TC и возврат к отфильтрованному списку', async () => {
  const q = questionFixture('text_completion');
  const training = storedTraining(trainingSession({ items: [0, 1, 2].map((position) => ({ position, question: q })) }), Date.now());
  training.answers = { 0: givenAnswer(), 1: givenAnswer({ position: 1, optionIds: ['B'] }) };
  training.finish = { finishedAt: new Date().toISOString(), timedOut: false };
  const { screen } = await boot(training);
  await screen.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await screen.getByRole('button', { name: 'Отмеченные · 0' }).click();
  await expect.element(screen.getByText('Отмеченных вопросов нет.')).toBeVisible();
  await screen.getByRole('button', { name: 'Ошибки · 2' }).click();
  await screen.getByRole('link', { name: /^Вопрос 2,/ }).click();
  await screen.getByRole('button', { name: 'Все варианты' }).click();
  await expect.poll(() => screen.getByRole('radio').elements().length).toBe(3);
  await screen.getByRole('button', { name: 'Свернуть варианты' }).click();
  await expect.element(screen.getByText('Ваш ответ', { exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Закрыть тренировку', exact: true }).click();
  await expect.element(screen.getByRole('button', { name: 'Ошибки · 2' })).toHaveAttribute('aria-pressed', 'true');
});

test('B: жалоба «Другое» требует текст; перевод доступен на втором языке; Escape закрывает шторку', async () => {
  const { screen } = await boot(storedTraining(trainingSession(), Date.now()));
  await screen.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await screen.getByRole('button', { name: 'EN', exact: true }).click();
  await screen.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await expect.element(screen.getByRole('button', { name: 'В переводе' })).toBeVisible();
  await screen.getByRole('button', { name: 'Другое', exact: true }).click();
  const send = screen.getByRole('button', { name: 'Отправить', exact: true });
  await expect.element(send).toBeDisabled();
  await screen.getByRole('textbox', { name: 'Что не так' }).fill('Synthetic report');
  await expect.element(send).toBeEnabled();
  await userEvent.keyboard('{Escape}');
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  await expect.element(screen.getByTestId('explanation')).toHaveAttribute('lang', 'en');
  await screen.getByRole('button', { name: 'RU', exact: true }).click();
  await screen.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await expect.element(screen.getByRole('button', { name: 'В переводе' })).not.toBeInTheDocument();
  screen.getByRole('dialog').element().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

test('B: подтверждение жалобы исчезает через три секунды', async () => {
  const { screen } = await boot(storedTraining(trainingSession(), Date.now()));
  await expect.element(screen.getByRole('button', { name: 'Проверить', exact: true })).toBeVisible();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    reportSavedFeedback();
    await expect.element(screen.getByText('Спасибо — проверим и поправим')).toBeVisible();
    await vi.advanceTimersByTimeAsync(3001);
    await expect.element(screen.getByText('Спасибо — проверим и поправим')).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

test('B: на компьютере старт под конструктором, при сужении — в нижней панели', async () => {
  await page.viewport(1280, 800);
  try {
    const { screen, router } = await boot(storedTraining(trainingSession(), Date.now()));
    await router.navigate({ to: '/training/new' });
    await expect.element(screen.getByRole('heading', { name: 'Новая тренировка' })).toBeVisible();
    await expect.poll(() => Boolean(screen.getByRole('button', { name: /^Начать ·/ }).element().closest('main'))).toBe(true);
    await page.viewport(390, 844);
    await expect.poll(() => Boolean(screen.getByRole('button', { name: /^Начать ·/ }).element().closest('main'))).toBe(false);
  } finally { await page.viewport(390, 844); }
});
