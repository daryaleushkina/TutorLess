import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ShellProvider } from '../shellContext';
import { TrainingSecondaryAction } from './SecondaryAction';

for (const shell of ['telegram', 'site'] as const) test(`${shell}: вторая кнопка остаётся на странице и блокируется на время запроса`, async () => {
  const onClick = vi.fn();
  const action = (busy = false) => <ShellProvider value={{ shell, launch: null }}>
    <TrainingSecondaryAction text="Не знаю" disabled={false} busy={busy} onClick={onClick} />
  </ShellProvider>;
  const screen = await render(action());
  const button = screen.getByRole('button', { name: 'Не знаю' });
  await button.click(); expect(onClick).toHaveBeenCalledTimes(1);
  await screen.rerender(action(true));
  await expect.element(button).toBeDisabled();
  await expect.element(button).toHaveAttribute('aria-busy', 'true');
  const element = button.element();
    if (!(element instanceof HTMLButtonElement)) throw new Error('fixture button missing');
    element.click(); expect(onClick).toHaveBeenCalledTimes(1);
});
