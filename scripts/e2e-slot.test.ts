import { expect, test, vi } from 'vitest';
import { e2eSlot } from '../tools/dev/e2e-slot';

test('слот 0 сохраняет прежние адреса и имена', () => {
  expect(e2eSlot()).toEqual({ slot: 0, webPort: 5191, apiPort: 8093, oidcPort: 8094, browsersPort: 3556,
    database: 'greprep_web_e2e', composeProject: 'greprep', buildDir: 'dist-e2e', outputDir: 'test-results', reportDir: 'playwright-report' });
});

test('два слота не делят ни порты, ни имена, ни каталоги сборки и результатов', () => {
  const zero = e2eSlot('0'); const one = e2eSlot('1');
  expect(one).toMatchObject({ webPort: 5211, apiPort: 8113, oidcPort: 8114, browsersPort: 3576,
    database: 'greprep_web_e2e_1', composeProject: 'greprep-e2e-1' });
  for (const field of ['webPort', 'apiPort', 'oidcPort', 'browsersPort', 'database', 'composeProject', 'buildDir', 'outputDir', 'reportDir'] as const) {
    expect(zero[field]).not.toBe(one[field]);
  }
});

for (const invalid of ['', '-1', '1.5', '01', 'abc', '2873', '9007199254740992']) test(`неверный слот ${invalid} отклоняется до запуска стенда`, () => {
  expect(() => e2eSlot(invalid)).toThrow('E2E_SLOT');
});

test('верхний слот оставляет все порты в диапазоне TCP', () => {
  expect(e2eSlot('2872').oidcPort).toBe(65534);
});

test('Playwright передаёт слот в адреса серверов, сборку, базу и результаты', async () => {
  vi.stubEnv('E2E_SLOT', '1');
  try {
    const { default: config } = await import('../playwright.config');
    expect(config.use?.baseURL).toBe('https://localhost:5211');
    expect(config.use?.connectOptions?.wsEndpoint).toBe('ws://127.0.0.1:3576/');
    expect(config.outputDir).toBe('test-results-1');
    expect(config.webServer).toEqual(expect.arrayContaining([
      expect.objectContaining({ env: expect.objectContaining({ E2E_DB: 'greprep_web_e2e_1', E2E_API_ADDR: '127.0.0.1:8113', E2E_OIDC_ADDR: '127.0.0.1:8114' }) }),
      expect.objectContaining({ command: expect.stringContaining('--outDir dist-e2e-1'), url: 'https://localhost:5211' }),
    ]));
  } finally { vi.unstubAllEnvs(); }
});
