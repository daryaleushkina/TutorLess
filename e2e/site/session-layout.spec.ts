import type { Page } from '@playwright/test';
import { schemas } from '../../packages/api-client/src';
import { expect, test } from '../fixtures';
import { pick, startSession } from '../training';

/** Геометрия не зависит от случайного задания: сохраняем серверные варианты, меняем только длину текста. */
async function layoutSession(page: Page, longExplanation = false, longAnswer = false) {
  await page.route('**/api/trainings', async (route) => {
    const response = await route.fetch();
    const session = schemas.TrainingSession.parse(await response.json());
    const item = session.items.find(({ question }) => question.groups.length === 1)!;
    const question = item.question;
    const options = question.groups[0]!.options;
    const correct = options.find((option) => question.answer.includes(option.id))!;
    const wrong = options.find((option) => !question.answer.includes(option.id))!;
    await route.fulfill({ response, json: {
      ...session, items: [{ ...item, position: 0, question: {
        ...question, prompt: 'A short question ___, with a conclusion.',
        groups: [{ ...question.groups[0], options: [
          { ...correct, text: longAnswer ? correct.text.repeat(40).slice(0, 500) : correct.text }, wrong,
        ] }],
        ...(longExplanation && { explanation: { ...question.explanation, solution: {
          ...question.explanation.solution, ru: Array.from({ length: 30 }, () => question.explanation.solution.ru).join('\n\n'),
        } } }),
      } }],
    } });
  });
  return startSession(page, 'practice', 50);
}

test('короткий вопрос помещается над панелью без прокрутки', async ({ site: page }) => {
  await layoutSession(page);
  await expect.poll(() => page.locator('main').evaluate((main) => main.scrollHeight - main.clientHeight)).toBe(0);
  const geometry = await page.evaluate(() => {
    const main = document.querySelector('main')!.getBoundingClientRect();
    const footer = document.querySelector('footer')!.getBoundingClientRect();
    return { mainBottom: main.bottom, footerTop: footer.top, footerBottom: footer.bottom, height: innerHeight };
  });
  expect(geometry.mainBottom).toBeCloseTo(geometry.footerTop, 0);
  expect(geometry.footerBottom).toBeCloseTo(geometry.height, 0);
  const actions = await page.locator('footer').evaluate((footer) => {
    const content = footer.firstElementChild!.getBoundingClientRect();
    return [...footer.querySelectorAll('button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, right: rect.right, contentLeft: content.left, contentRight: content.right };
    });
  });
  for (const action of actions) {
    expect(action.left).toBeGreaterThanOrEqual(action.contentLeft - 1);
    expect(action.right).toBeLessThanOrEqual(action.contentRight + 1);
  }
});

test('длинный выбранный ответ переносится внутри пропуска и не расширяет страницу', async ({ site: page }) => {
  await layoutSession(page, false, true);
  await page.getByRole('radio').first().click();
  const geometry = await page.getByRole('img', { name: /пропуск/ }).evaluate((blank) => ({
    height: blank.getBoundingClientRect().height, lineHeight: Number.parseFloat(getComputedStyle(blank).lineHeight),
    mainWidth: document.querySelector('main')!.clientWidth, scrollWidth: document.querySelector('main')!.scrollWidth,
  }));
  expect(geometry.height).toBeGreaterThan(geometry.lineHeight);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.mainWidth + 1);
});

test('последний текст длинного разбора виден над панелью; под safe area содержимое не просвечивает', async ({ site: page }) => {
  const session = await layoutSession(page, true);
  await pick(page, session.items[0]!.question, true);
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.getByTestId('explanation')).toBeVisible();
  await page.evaluate(() => document.documentElement.style.setProperty('--app-inset-bottom', 'var(--space-32)'));
  await page.locator('main').evaluate((main) => { main.scrollTop = main.scrollHeight; });
  const geometry = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const footer = document.querySelector('footer')!;
    const last = document.querySelector('[data-testid="explanation"]')!.getBoundingClientRect();
    return {
      scroll: main.scrollTop, mainBottom: main.getBoundingClientRect().bottom, lastBottom: last.bottom,
      footerTop: footer.getBoundingClientRect().top, footerBottom: footer.getBoundingClientRect().bottom,
      height: innerHeight, bottomIsFooter: footer.contains(document.elementFromPoint(innerWidth / 2, innerHeight - 1)),
    };
  });
  expect(geometry.scroll).toBeGreaterThan(0);
  expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.mainBottom + 1);
  expect(geometry.mainBottom).toBeCloseTo(geometry.footerTop, 0);
  expect(geometry.footerBottom).toBeCloseTo(geometry.height, 0);
  expect(geometry.bottomIsFooter).toBe(true);
});

test('запятая после пропуска остаётся на его строке при любой ширине текста', async ({ site: page }) => {
  await layoutSession(page);
  await page.evaluate(() => document.fonts.ready);
  const failures = await page.locator('p[lang="en"]').first().evaluate((prompt) => {
    const blank = prompt.querySelector('[role="img"]')!;
    const walker = document.createTreeWalker(prompt, NodeFilter.SHOW_TEXT);
    let comma: Text | undefined;
    while (walker.nextNode()) {
      if (walker.currentNode.textContent?.startsWith(',')) { comma = walker.currentNode as Text; break; }
    }
    if (!comma) throw new Error('Нет запятой после пропуска');
    const range = document.createRange();
    range.setStart(comma, 0); range.setEnd(comma, 1);
    const failures: number[] = [];
    for (let width = 220; width <= 360; width++) {
      prompt.style.width = `${width}px`;
      const b = blank.getBoundingClientRect();
      const c = range.getBoundingClientRect();
      if (c.top >= b.bottom - 1) failures.push(width);
    }
    prompt.style.removeProperty('width');
    return failures;
  });
  expect(failures, 'ширины, при которых запятая начинает новую строку').toEqual([]);
});

test('наведение сохраняет подложку выбранного ответа', async ({ site: page }) => {
  await layoutSession(page);
  const option = page.getByRole('radio').first();
  await option.click();
  await page.mouse.move(0, 0);
  const background = await option.evaluate((element) => getComputedStyle(element).backgroundColor);
  await option.hover();
  await expect.poll(() => option.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(background);
});
