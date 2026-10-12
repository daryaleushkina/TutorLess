import { expect, navLink, test } from '../fixtures';

test('панель по ширине, экзамен аккаунта и профиль', async ({ site: page, me }) => {
  const width = page.viewportSize()?.width ?? 0;
  await me.api('PUT', '/me/exam', { exam: 'toefl' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Экзамен: TOEFL, сменить' })).toHaveAttribute('aria-haspopup', 'dialog');
  for (const [tab, text] of [
    ['Слова', 'Здесь будут слова: учить, повторять и искать.'],
    ['Экзамен', 'Здесь будут пробные экзамены TOEFL с оценкой Writing и Speaking.'],
    ['Прогресс', 'Здесь будет точность по разделам, история тренировок и примерный балл.'],
    ['Тренировка', 'Здесь будут тренировки по четырём частям TOEFL.'],
  ] as const) {
    await navLink(page, tab).click();
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(navLink(page, tab)).toHaveAttribute('aria-current', 'page');
  }
  if (width < 900) await expect(page.locator('.tabbar')).toBeVisible();
  else {
    await expect(page.locator('.tabbar')).toBeHidden();
    const panel = await page.getByRole('navigation', { name: 'Разделы' }).boundingBox();
    const sidebarWidth = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--layout-sidebar-width')));
    expect(panel?.width).toBe(sidebarWidth);
    expect(panel?.height ?? 0).toBeGreaterThan(600);
    const profile = await page.getByRole('link', { name: /Профиль/ }).boundingBox();
    expect(profile?.y ?? 0).toBeGreaterThan(650);
  }
  await page.getByRole('link', { name: /Профиль/ }).click();
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeAttached();
});

test('возврат во вкладку сохраняет конструктор и введённое число вопросов', async ({ site: page }) => {
  await page.getByRole('link', { name: /^Quant/ }).click();
  await page.getByRole('textbox', { name: 'Вопросов' }).fill('5');
  await navLink(page, 'Слова').click();
  await navLink(page, 'Тренировка').click();
  await expect(page).toHaveURL(/\/training\/new\?section=quant$/);
  await expect(page.getByRole('textbox', { name: 'Вопросов' })).toHaveValue('5');
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Тренировка', exact: true })).toBeVisible();
});

test('главная начинает тренировку в режиме фокуса', async ({ site: page }) => {
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Text Completion/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Разделы' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Закрыть тренировку' }).click();
  await expect(page.getByRole('link', { name: /Продолжить тренировку/ })).toBeVisible();
});
