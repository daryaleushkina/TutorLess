import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const startup = vi.hoisted(() => ({
  render: vi.fn(),
  sync: vi.fn(),
  report: vi.fn(),
  restore: vi.fn(async (_device?: unknown) => {}),
  start: vi.fn(async (): Promise<{ kind: 'ok'; launch: null } | { kind: 'failed'; error: Error }> => ({ kind: 'ok', launch: null })),
  device: {},
}));
vi.mock('react-dom/client', () => ({ createRoot: () => ({ render: startup.render }) }));
vi.mock('./App', () => ({ App: () => null }));
vi.mock('./components/StartFailure', () => ({ StartFailure: () => null }));
vi.mock('./errors/report', () => ({ installGlobalReporter: vi.fn(), configureReporter: vi.fn(), reportError: startup.report }));
vi.mock('./router', () => ({ makeRouter: vi.fn() }));
vi.mock('./queryClient', () => ({ makeQueryClient: vi.fn() }));
vi.mock('./styles/theme', () => ({ restoreTheme: startup.restore }));
vi.mock('./telegram/sdk', () => ({ startTelegram: startup.start, syncTelegramTheme: startup.sync, telegramThemeStorage: () => startup.device }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('document', { getElementById: () => ({}) });
  vi.stubGlobal('location', { pathname: '/tg/' });
});
afterEach(() => vi.unstubAllGlobals());

it('первый кадр не ждёт DeviceStorage; отказ фонового чтения обработан', async () => {
  let reject: ((error: Error) => void) | undefined;
  startup.restore.mockImplementation(async (device) => {
    if (device) await new Promise<void>((_resolve, fail) => { reject = fail; });
  });
  try {
    await import('./main');
    await expect.poll(() => startup.render.mock.calls.length).toBe(1);
    expect(startup.restore).toHaveBeenCalledExactlyOnceWith(startup.device);
    reject?.(new Error('device denied'));
    await expect.poll(() => startup.report.mock.calls.length).toBe(1);
    expect(startup.render).toHaveBeenCalledOnce();
  } finally {
    reject?.(new Error('test finished'));
  }
});

it('при отказе запуска цвета клиента синхронизированы до экрана ошибки', async () => {
  startup.start.mockResolvedValueOnce({ kind: 'failed', error: new Error('missing initData') });
  await import('./main');
  await expect.poll(() => startup.render.mock.calls.length).toBe(1);
  expect(startup.sync).toHaveBeenCalledOnce();
  expect(startup.sync.mock.invocationCallOrder[0]).toBeLessThan(startup.render.mock.invocationCallOrder[0]!);
});
