import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ShellProvider } from '../shellContext';
import { TrainingActions } from './Action';

for (const shell of ['telegram', 'site'] as const) test(`${shell}: пара помещается при длинных подписях и второй кнопки может не быть`, async () => {
  const primary = { text: 'Повторить · 6 вопросов', disabled: false, onClick: vi.fn() };
  const secondary = { text: 'Вернуться к вопросу 12 из 50', disabled: false, onClick: vi.fn() };
  const pair = (both = true) => <ShellProvider value={{ shell, launch: null }}>
    <TrainingActions primary={primary} secondary={both ? secondary : undefined} />
  </ShellProvider>;
  const screen = await render(pair());
  const main = screen.getByRole('button', { name: primary.text });
  const second = screen.getByRole('button', { name: secondary.text });
  await expect.element(main).toBeVisible(); await expect.element(second).toBeVisible();
  for (const button of [main.element(), second.element()]) {
    expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(54);
  }
  await main.click(); await second.click();
  expect(primary.onClick).toHaveBeenCalledTimes(1); expect(secondary.onClick).toHaveBeenCalledTimes(1);
  await screen.rerender(pair(false));
  await expect.element(second).not.toBeInTheDocument();
});
