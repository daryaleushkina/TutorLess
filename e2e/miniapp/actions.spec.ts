import { checkScreen, expect, test } from '../fixtures';
import { startSession } from '../training';

test('кнопка над безопасной зоной; последнее поле не прячется под панелью', async ({ miniApp: page }) => {
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  const footer = page.locator('footer[data-shell="telegram"]');
  await expect(footer.getByRole('button', { name: /^Начать ·/ })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--tg-viewport-content-safe-area-inset-bottom', '16px');
  });
  await expect.poll(() => footer.evaluate((element) => {
    const button = element.querySelector('button');
    if (!button) return -1;
    const css = getComputedStyle(document.documentElement);
    const inset = Number.parseFloat(css.getPropertyValue('--tg-viewport-safe-area-inset-bottom')) + 16;
    return element.getBoundingClientRect().bottom - button.getBoundingClientRect().bottom - inset;
  })).toBeGreaterThanOrEqual(0);
  await page.locator('main').evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const last = page.getByRole('button', { name: /Темы и сложность/ });
  expect((await last.boundingBox())!.y + (await last.boundingBox())!.height).toBeLessThanOrEqual((await footer.boundingBox())!.y);
  await expect(page.locator('#tg-mock-bar')).toHaveCount(0);
  await footer.getByRole('button', { name: /^Начать ·/ }).click();
  await expect(page.getByRole('heading', { name: 'Text Completion' })).toBeVisible();
  const events = await page.evaluate(() => {
    const mock: unknown = Reflect.get(window, '__tgMock');
    if (typeof mock !== 'object' || mock === null) throw new Error('Telegram mock missing');
    const events: unknown = Reflect.get(mock, 'events');
    if (!Array.isArray(events)) throw new Error('Telegram mock events missing');
    return events.filter((name): name is string => typeof name === 'string');
  });
  expect(events.filter((name) => name === 'web_app_trigger_haptic_feedback')).toHaveLength(1);
  expect(events).not.toContain('web_app_setup_main_button');
  expect(events).not.toContain('web_app_setup_secondary_button');
});

test('запрос блокирует кнопку, показывает загрузку, после отказа можно повторить', async ({ miniApp: page }) => {
  await page.getByRole('link', { name: 'Настроить тренировку' }).click();
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/trainings', async (route) => {
    await held;
    await route.fulfill({ status: 400, json: { code: 'no_questions', message: 'Synthetic failure' } });
  });
  try {
    const button = page.getByRole('button', { name: /^Начать ·/ });
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button.getByRole('progressbar')).toBeVisible();
    release();
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('alert')).toBeVisible();
  } finally { release(); }
});

test('клавиатура iOS: visualViewport уменьшается и сдвигается, кнопка остаётся видимой', async ({ miniApp: page }) => {
  await startSession(page);
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await page.getByRole('textbox', { name: 'Что не так' }).fill('Synthetic keyboard fixture');
  await page.getByRole('textbox', { name: 'Что не так' }).focus();
  await page.evaluate(() => {
    const visible = window.visualViewport;
    if (!visible) throw new Error('visualViewport unavailable');
    Object.defineProperties(visible, { height: { configurable: true, value: 360 }, offsetTop: { configurable: true, value: 80 } });
    visible.dispatchEvent(new Event('resize')); visible.dispatchEvent(new Event('scroll'));
  });
  const button = page.getByRole('button', { name: 'Отправить', exact: true });
  await expect.poll(async () => {
    const box = await button.boundingBox();
    return box && box.y >= 80 && box.y + box.height <= 440;
  }).toBe(true);
  await expect(button).toBeVisible();
  const inputBounds = await page.getByRole('textbox', { name: 'Что не так' }).boundingBox();
  const mainBounds = await page.locator('main').boundingBox();
  expect(inputBounds!.y).toBeGreaterThanOrEqual(mainBounds!.y);
  expect(inputBounds!.y + inputBounds!.height).toBeLessThanOrEqual(mainBounds!.y + mainBounds!.height);
  await page.evaluate(() => {
    const visible = window.visualViewport;
    if (!visible) throw new Error('visualViewport unavailable');
    Object.defineProperties(visible, { height: { configurable: true, value: innerHeight }, offsetTop: { configurable: true, value: 0 } });
    visible.dispatchEvent(new Event('resize')); visible.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => page.locator('footer').evaluate((element) => element.getBoundingClientRect().bottom)).toBe(await page.evaluate(() => innerHeight));
});

test('клавиатура Android: уменьшение окна сохраняет нашу кнопку и прокрутку', async ({ miniApp: page }) => {
  await startSession(page);
  await page.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  await page.getByRole('textbox', { name: 'Что не так' }).focus();
  await page.setViewportSize({ width: 390, height: 440 });
  await expect.poll(() => page.getByRole('button', { name: 'Отправить', exact: true }).evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(440);
  await expect(page.getByRole('textbox', { name: 'Что не так' })).toBeFocused();
  await checkScreen(page, 'training-report-keyboard');
});
