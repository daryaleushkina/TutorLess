// Ленивые разделы сохраняют живой мини-апп при потере сети.
import { expect, miniAppUrl, navLink, test } from '../fixtures';

test('после первого экрана все вкладки открываются без сети и перезагрузки', async ({ miniApp: page, context }) => {
  // WebKit вносит шум в performance.timeOrigin; метка принадлежит самому документу и исчезнет при reload.
  const documentId = await page.evaluate(() => document.documentElement.dataset.testDocument = crypto.randomUUID());
  // Дожидаемся фоновой загрузки разделов, не открывая их: сеть пропадёт до первого перехода.
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource')
    .some((entry) => /(?:sections\.lazy|ProgressScreen)-.*\.js/.test(entry.name)))).toBe(true);
  await context.setOffline(true);
  for (const name of ['Слова', 'Экзамен', 'Прогресс', 'Тренировка']) {
    await navLink(page, name).click();
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.testDocument)).toBe(documentId);
  }
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
});

test('незагруженный раздел — «Нет сети»; повтор открывает его без перезагрузки', async ({ page, watch, tgUser, tgTheme, tgPlatform, tgInsets, me }) => {
  watch(page);
  await me.api('PUT', '/me/exam', { exam: 'gre' });
  let fail = true;
  // Имитация потери сети только для куска: запросы входа и первого плана проходят.
  await page.route(/\/(?:sections\.lazy|ProgressScreen)-[^/]+\.js(?:\?.*)?$/, (route) => fail ? route.abort('internetdisconnected') : route.continue());
  await page.goto(miniAppUrl(tgUser, { tgTheme, tgPlatform, tgInsets }));
  await expect(page.getByText('После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.')).toBeVisible();
  // WebKit вносит шум в performance.timeOrigin; метка принадлежит самому документу и исчезнет при reload.
  const documentId = await page.evaluate(() => document.documentElement.dataset.testDocument = crypto.randomUUID());
  await navLink(page, 'Прогресс').click();
  await expect(page.getByRole('heading', { name: 'Нет сети', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.testDocument)).toBe(documentId);
  fail = false;
  await page.getByRole('button', { name: 'Попробовать снова', exact: true }).click();
  await expect(page.getByText('Здесь будет точность по разделам, история тренировок и примерный балл.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.testDocument)).toBe(documentId);
});
