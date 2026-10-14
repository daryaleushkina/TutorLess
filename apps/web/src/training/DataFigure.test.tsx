import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import type { DataFigure as Figure } from '@greprep/api-client';
import { DataFigure } from './DataFigure';
import { I18nProvider } from '../i18n/i18n';
import { page, userEvent } from 'vitest/browser';
import { fakeServer, json, OPTIONS, renderApp, user } from '../test/app';
import { questionFixture, trainingSession } from '../test/training';
import { storedTraining } from './model';
import { trainingRepository } from './repository';
import { vi } from 'vitest';

const figure: Figure = { id: 'synthetic', kind: 'bar', title: 'Synthetic data', xLabel: 'Day', yLabel: 'Orders', unit: 'orders',
  categories: ['Monday', 'Tuesday', 'Wednesday'], series: [{ id: 'east', label: 'East', values: [-12, 0, 30] }], description: 'East: Monday −12, Tuesday 0, Wednesday 30 orders.' };

for (const kind of ['bar', 'line', 'table'] as const) test(`${kind}: описание доступно, подписи и все значения видны`, async () => {
  const screen = await render(<DataFigure figure={{ ...figure, kind }} />);
  await expect.element(screen.getByRole('figure', { name: figure.description })).toBeVisible();
  await expect.element(screen.getByText(figure.title)).toBeVisible();
  await expect.element(screen.getByText('Monday', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('−12', { exact: true }).last()).toBeVisible();
});

test('таблица: настоящие заголовки строк и столбцов; прокрутка остаётся внутри рамки, включая клавиатуру', async () => {
  await render(<DataFigure figure={{ ...figure, kind: 'table', series: Array.from({ length: 20 }, (_, i) => ({ id: String(i), label: `Synthetic long series ${i}`, values: [-12, 0, 30] })) }} />);
  await expect.element(page.getByRole('columnheader', { name: 'Day', exact: true })).toBeVisible();
  await expect.element(page.getByRole('rowheader', { name: 'Monday', exact: true })).toBeVisible();
  const scroll = document.querySelector<HTMLElement>('[data-figure-scroll]')!;
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
  scroll.focus(); await userEvent.keyboard('{ArrowRight}');
  await expect.poll(() => scroll.scrollLeft).toBeGreaterThan(0);
});

for (const kind of ['bar', 'line'] as const) test(`${kind}: 100 длинных категорий, 20 рядов, отрицательные и нулевые значения`, async () => {
  const categories = Array.from({ length: 100 }, (_, i) => `Synthetic category ${i} ` + 'x'.repeat(180));
  const series = Array.from({ length: 20 }, (_, i) => ({ id: String(i), label: `Series ${i}`, values: categories.map((_, j) => j % 3 === 0 ? 0 : (i + 1) * (j % 2 ? -1 : 1)) }));
  await render(<DataFigure figure={{ ...figure, kind, categories, series }} />);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
  const svg = document.querySelector('[data-figure-scroll] svg')!;
  expect(svg.innerHTML).not.toMatch(/NaN|Infinity/);
  expect(svg.querySelectorAll('[data-series]')).toHaveLength(20);
  expect(svg.querySelectorAll('[data-marker]')).toHaveLength(2000);
  const shapes = document.querySelectorAll('li svg');
  expect(new Set([...shapes].map((node) => node.querySelector('g')!.innerHTML + (node instanceof SVGElement ? node.style.strokeDasharray : ''))).size).toBe(20);
});

test('нулевой график и единственная точка не дают вырожденную геометрию', async () => {
  for (const kind of ['bar', 'line'] as const) {
    const view = await render(<DataFigure figure={{ ...figure, kind, categories: ['Only point'], series: [{ id: 'one', label: 'One', values: [0] }] }} />);
    expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/);
    await view.unmount();
  }
});

test('нет подписей осей и единицы; язык и категория берутся из словаря', async () => {
  const view = await render(<I18nProvider locale="en"><DataFigure figure={{ ...figure, kind: 'table', unit: '', xLabel: '', yLabel: '' }} /></I18nProvider>);
  await expect.element(view.getByRole('columnheader', { name: 'Category' })).toBeVisible();
  await expect.element(view.getByRole('region', { name: 'Figure data: scroll horizontally' })).toBeVisible();
});

test('повреждённые данные: вместо мусора текстовое описание и понятное сообщение', async () => {
  const view = await render(<I18nProvider locale="en"><DataFigure figure={{ ...figure, series: [{ id: 'bad', label: 'Bad', values: [Infinity] }] }} /></I18nProvider>);
  await expect.element(view.getByText('The figure could not be drawn. Its data is described below.')).toBeVisible();
  await expect.element(view.getByText(figure.description)).toBeVisible();
  expect(view.container.querySelector('svg')).toBeNull();
});

test('общий рисунок остаётся после ответа, назад и вперёд, в списке, разборе и жалобе', async () => {
  const { app } = await bootFigures();
  const drawn = () => app.screen.getByRole('figure', { name: figure.description });
  await expect.element(drawn()).toBeVisible();
  await app.screen.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await expect.element(drawn()).toBeVisible();
  await app.screen.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect.element(drawn()).toBeVisible();
  await app.screen.getByRole('button', { name: 'Предыдущий вопрос', exact: true }).click();
  await expect.element(drawn()).toBeVisible();
  await app.screen.getByRole('button', { name: 'К вопросу 2', exact: true }).click();
  await app.screen.getByRole('button', { name: 'Не знаю', exact: true }).click();
  await app.screen.getByRole('button', { name: 'К итогу', exact: true }).click();
  await app.screen.getByRole('link', { name: 'Все ответы и разборы' }).click();
  await expect.poll(() => document.querySelectorAll('[data-data-figure]').length).toBe(2);
  await app.screen.getByRole('link', { name: /^Вопрос 1,/ }).click();
  await expect.element(drawn()).toBeVisible();
  await app.screen.getByRole('button', { name: 'Следующий', exact: true }).click();
  await expect.element(drawn()).toBeVisible();
  await app.screen.getByRole('button', { name: 'Предыдущий вопрос', exact: true }).click();
  await expect.element(drawn()).toBeVisible();
  await app.screen.getByRole('link', { name: 'Сообщить об ошибке' }).click();
  expect(document.querySelector('[data-data-figure]')?.getAttribute('aria-label')).toBe(figure.description);
});

for (const [yLabel, unit, expected] of [['Orders', 'orders', 'Orders'], ['Orders', 'thousands', 'Orders · thousands'], ['', 'orders', 'orders']]) test(`подпись оси и единица: ${expected}`, async () => {
  const view = await render(<DataFigure figure={{ ...figure, yLabel: yLabel!, unit: unit! }} />);
  await expect.element(view.getByText(expected!, { exact: true }).first()).toBeVisible();
});

async function bootFigures(data = figure, check = false) {
  fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/trainings/options': () => json(OPTIONS) });
  vi.spyOn(trainingRepository, 'requestSync').mockImplementation(() => {});
  const app = await renderApp({ path: '/' });
  await expect.element(app.screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
  const owner = await trainingRepository.store.currentOwner(); if (!owner) throw new Error('fixture owner missing');
  const q = { ...questionFixture('multiple_choice'), figure: data };
  const training = storedTraining(trainingSession({ mode: check ? 'check' : 'practice', timeLimitSeconds: check ? 300 : undefined, section: 'quant', items: [0, 1].map((position) => ({ position, question: { ...q, id: `00000000-0000-4000-8000-00000000000${position}` } })) }), Date.now());
  await trainingRepository.store.put(owner, training);
  await app.router.navigate({ to: '/training/$trainingId', params: { trainingId: training.session.id } });
  await expect.element(app.screen.getByRole('figure', { name: data.description })).toBeVisible();
  return { app, training };
}

test('стрелки прокручивают широкую таблицу, сохраняя текущий вопрос проверки', async () => {
  const { app } = await bootFigures({ ...figure, kind: 'table', series: Array.from({ length: 6 }, (_, i) => ({ ...figure.series[0]!, id: String(i), label: `Series ${i}` })) }, true);
  const scroll = document.querySelector<HTMLElement>('[data-figure-scroll]')!;
  scroll.focus(); await userEvent.keyboard('{ArrowRight}');
  await expect.poll(() => scroll.scrollLeft).toBeGreaterThan(0);
  await expect.element(app.screen.getByLabelText('Вопрос 1 из 2', { exact: true })).toBeVisible();
});

test('длинные широкие буквы в соседних категориях не накладываются', async () => {
  await render(<DataFigure figure={{ ...figure, categories: ['W'.repeat(200), 'M'.repeat(200)], series: [{ id: 'wide', label: 'Wide', values: [1, 2] }] }} />);
  const labels = document.querySelectorAll<SVGTextElement>('svg > text');
  const first = labels[0]!.getBBox(); const second = labels[1]!.getBBox();
  expect(first.x + first.width).toBeLessThanOrEqual(second.x);
});
