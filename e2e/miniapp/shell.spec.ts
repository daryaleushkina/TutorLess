import { schemas } from '../../packages/api-client/src';
import { expect, navLink, test } from '../fixtures';

test('главная начинает тренировку, внутри сессии нет вкладок', async ({ miniApp: page }) => {
  await expect(navLink(page, 'Тренировка')).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Text Completion/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Разделы' })).toHaveCount(0);
  await page.locator('#tg-mock-back').click();
  await expect(page.getByRole('link', { name: /Продолжить тренировку/ })).toBeVisible();
});

test('каждая вкладка возвращает к своему экрану и сохраняет форму конструктора', async ({ miniApp: page }) => {
  await page.getByRole('link', { name: /^Quant/ }).click();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await navLink(page, 'Слова').click();
  await expect(page.getByRole('searchbox', { name: 'Найти слово' })).toBeVisible();
  await navLink(page, 'Экзамен').click();
  await expect(page.getByText('Здесь будут пробные экзамены GRE и эссе с оценкой.')).toBeVisible();
  await navLink(page, 'Тренировка').click();
  await expect(page).toHaveURL(/\/training\/new\?section=quant$/);
  await expect(page.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#tg-mock-back').click();
  await expect(page.getByRole('heading', { name: 'Тренировка', exact: true })).toBeVisible();
});

test('переключатель берёт экзамен аккаунта, профиль открывает нынешние настройки', async ({ miniApp: page, me }) => {
  await me.api('PUT', '/me/exam', { exam: 'toefl' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Экзамен: TOEFL, сменить' })).toHaveAttribute('aria-haspopup', 'dialog');
  await page.getByRole('link', { name: 'Профиль', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Выйти' })).toHaveCount(0);
  await page.locator('#tg-mock-back').click();
  await expect(page.getByRole('heading', { name: 'Тренировка', exact: true })).toBeVisible();
  const account = schemas.User.parse(await me.api('GET', '/me'));
  expect(account.activeExam).toBe('toefl');
});

test('без сети новый старт не проходит, сеть вернулась — тренировка начинается', async ({ miniApp: page, context }) => {
  await context.setOffline(true);
  await expect(page.getByText('Нет сети — обновим, когда она появится.')).toBeVisible();
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect(page.getByText('Чтобы начать, нужна сеть: задания скачаются целиком, и дальше можно без неё.')).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Text Completion/ })).toBeVisible();
});
