import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { screenHorizontalIssues } from '../../../../e2e/screenLayout';

test('checkScreen допускает широкое содержимое внутри рамки рисунка', async () => {
  await render(<main className="app-shell" style={{ width: 300 }}><div data-figure-scroll style={{ width: 280, overflowX: 'auto' }}><div style={{ width: innerWidth * 2 }}>Wide content</div></div></main>);
  expect(screenHorizontalIssues()).toEqual([]);
});

// overflow-y: auto делает auto и вычисленный overflow-x, поэтому признак «прокрутка» есть у каждой панели текста и шторки.
// Без пометки рисунка широкое содержимое в них — ошибка вёрстки, а не задуманная прокрутка.
for (const overflow of [{ overflowY: 'auto' }, { overflowX: 'auto' }] as const) test(`checkScreen ловит широкое содержимое прокрутки без пометки рисунка: ${JSON.stringify(overflow)}`, async () => {
  await render(<main className="app-shell" style={{ width: 300 }}><div style={{ width: 280, height: 100, ...overflow }}><div style={{ width: innerWidth * 2 }}>Wide content</div></div></main>);
  expect(screenHorizontalIssues().some((issue) => issue.startsWith('вылезает вправо:'))).toBe(true);
});

test('checkScreen проверяет саму рамку и обычное содержимое без прокрутки', async () => {
  const view = await render(<main className="app-shell"><div style={{ width: innerWidth * 2, overflowX: 'auto' }}>Outside frame</div></main>);
  expect(screenHorizontalIssues().some((issue) => issue.startsWith('вылезает вправо:'))).toBe(true);
  await view.rerender(<main className="app-shell"><div style={{ position: 'absolute', left: innerWidth + 10 }}>Outside content</div></main>);
  expect(screenHorizontalIssues().some((issue) => issue.startsWith('вылезает вправо:'))).toBe(true);
});

test('checkScreen сообщает об отсутствующей оболочке', () => { expect(screenHorizontalIssues()).toEqual(['нет main.app-shell']); });
