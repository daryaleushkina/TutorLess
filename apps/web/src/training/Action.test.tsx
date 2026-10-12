import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import * as sdkRuntime from '@tma.js/sdk-react';
import { setTelegramRuntime } from '../telegram/runtime';
import { ShellProvider } from '../shellContext';
import { TrainingAction } from './Action';

const sdk = vi.hoisted(() => ({
  setParams: { isAvailable: vi.fn(() => true), ifAvailable: vi.fn() },
  onClick: { ifAvailable: vi.fn(() => ({ ok: true, data: vi.fn() })) },
}));
const haptic = vi.hoisted(() => vi.fn());
vi.mock('@tma.js/sdk-react', () => ({ mainButton: sdk, secondaryButton: sdk, hapticFeedback: { impactOccurred: { ifAvailable: haptic } } }));

const action = (shell: 'site' | 'telegram', disabled = false, busy = false, onClick = vi.fn()) => {
  setTelegramRuntime(shell === 'telegram' ? sdkRuntime : null);
  return <ShellProvider value={{ shell, launch: null }}>
    <TrainingAction text="Начать" disabled={disabled} busy={busy} onClick={onClick} />
  </ShellProvider>;
};

for (const shell of ['telegram', 'site'] as const) test(`${shell}: наша кнопка, томат из токенов, без вызовов родных кнопок`, async () => {
  vi.clearAllMocks();
  const onClick = vi.fn(); const screen = await render(action(shell, false, false, onClick));
  const button = screen.getByRole('button', { name: 'Начать' });
  await expect.element(button).toBeVisible();
  const probe = document.createElement('span');
  probe.style.color = 'var(--color-accent)'; document.body.append(probe);
  expect(getComputedStyle(button.element()).backgroundColor).toBe(getComputedStyle(probe).color);
  probe.remove();
  await button.click(); expect(onClick).toHaveBeenCalledTimes(1);
  expect(haptic.mock.calls).toEqual(shell === 'telegram' ? [['light']] : []);
  expect(sdk.setParams.ifAvailable).not.toHaveBeenCalled();
  expect(sdk.onClick.ifAvailable).not.toHaveBeenCalled();
});

test('запрос блокирует действие и показывает загрузку; после запроса кнопка снова доступна', async () => {
  const onClick = vi.fn(); const screen = await render(action('telegram', false, false, onClick));
  const button = screen.getByRole('button', { name: 'Начать' });
  for (const [disabled, busy] of [[true, false], [false, true]] as const) {
    await screen.rerender(action('telegram', disabled, busy, onClick));
    await expect.element(button).toBeVisible();
    await expect.element(button).toBeDisabled();
    await expect.element(button).toHaveAttribute('aria-busy', String(busy));
    expect(button.element().querySelector('[role="progressbar"]') !== null).toBe(busy);
    const element = button.element();
    if (!(element instanceof HTMLButtonElement)) throw new Error('fixture button missing');
    element.click(); expect(onClick).not.toHaveBeenCalled();
  }
  await screen.rerender(action('telegram', false, false, onClick));
  await button.click(); expect(onClick).toHaveBeenCalledTimes(1);
});
