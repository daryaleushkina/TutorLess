import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { screenHorizontalIssues } from '../../../../e2e/screenLayout';

for (const overflowX of ['auto', 'scroll'] as const) test(`checkScreen допускает внутреннюю прокрутку любого блока: ${overflowX}`, async () => {
  await render(<main className="app-shell" style={{ width: 300 }}><div style={{ width: 280, overflowX }}><div style={{ width: innerWidth * 2 }}>Wide content</div></div></main>);
  expect(screenHorizontalIssues()).toEqual([]);
});

test('checkScreen проверяет саму рамку и обычное содержимое без прокрутки', async () => {
  const view = await render(<main className="app-shell"><div style={{ width: innerWidth * 2, overflowX: 'auto' }}>Outside frame</div></main>);
  expect(screenHorizontalIssues().some((issue) => issue.startsWith('вылезает вправо:'))).toBe(true);
  await view.rerender(<main className="app-shell"><div style={{ position: 'absolute', left: innerWidth + 10 }}>Outside content</div></main>);
  expect(screenHorizontalIssues().some((issue) => issue.startsWith('вылезает вправо:'))).toBe(true);
});

test('checkScreen сообщает об отсутствующей оболочке', () => { expect(screenHorizontalIssues()).toEqual(['нет main.app-shell']); });
