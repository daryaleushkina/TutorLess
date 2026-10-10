import { expect, it } from 'vitest';
import { apiError, fakeServer, renderApp } from '../test/app';

it('экран рисуется Geologica: кириллица, латиница и тонкие веса загружаются со своего сервера', async () => {
  fakeServer({ 'GET /api/me': () => apiError(401, 'unauthorized') });
  const { screen } = await renderApp({ path: '/signin' });
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await document.fonts.ready;
  expect(getComputedStyle(screen.getByRole('heading', { level: 1 }).element()).fontFamily.split(',')[0]).toBe('Geologica');
  for (const weight of [200, 300, 600]) {
    const faces = await document.fonts.load(`${weight} 16px Geologica`, 'Сегодня GRE');
    expect(faces.length).toBeGreaterThanOrEqual(2);
    expect(faces.every((face) => face.family === 'Geologica' && face.status === 'loaded')).toBe(true);
    expect(document.fonts.check(`${weight} 16px Geologica`, 'Сегодня GRE')).toBe(true);
  }
});

it('семейства моноширинного текста и формул загружаются под именами токенов', async () => {
  for (const family of ['IBM Plex Mono', 'Source Serif 4']) {
    const faces = await document.fonts.load(`400 16px "${family}"`, 'Число x = 2');
    expect(faces.length).toBeGreaterThanOrEqual(2);
    expect(faces.every((face) => face.family.replaceAll('"', '') === family && face.status === 'loaded')).toBe(true);
  }
});
