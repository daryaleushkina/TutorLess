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
import { useState } from 'react';
import * as geometry from './figureGeometry';
vi.mock('./figureGeometry', { spy: true });

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

// Пунктир различает линии рядов; рваный контур маленького маркера только мешает его узнать.
test('пунктир ряда не переходит на контур маркеров — на графике и в легенде', async () => {
  const series = Array.from({ length: 5 }, (_, i) => ({ id: String(i), label: `Series ${i}`, values: [1, 2, 3] }));
  await render(<DataFigure figure={{ ...figure, kind: 'line', series }} />);
  const markers = document.querySelectorAll('[data-marker="4"] > *');
  expect(markers.length).toBe(4);
  for (const marker of markers) expect(getComputedStyle(marker).strokeDasharray).toBe('none');
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
  expect(view.container.querySelector('[data-figure-scroll]')?.hasAttribute('role')).toBe(false);
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
  await expect.element(app.screen.getByRole('heading', { name: 'Сообщить об ошибке', exact: true })).toBeVisible();
  await expect.poll(() => document.querySelectorAll('[data-data-figure]').length).toBe(1);
  await expect.element(drawn()).toBeVisible();
});

for (const [yLabel, unit, expected] of [['Orders', 'orders', 'Orders'], ['Orders', 'thousands', 'Orders · thousands'], ['', 'orders', 'orders']]) test(`подпись оси и единица: ${expected}`, async () => {
  const view = await render(<DataFigure figure={{ ...figure, yLabel: yLabel!, unit: unit! }} />);
  await expect.element(view.getByText(expected!, { exact: true }).first()).toBeVisible();
});

async function bootFigures(data = figure, check = false, nextData = data) {
  fakeServer({ 'GET /api/me': () => json(user()), 'GET /api/trainings/options': () => json(OPTIONS) });
  vi.spyOn(trainingRepository, 'requestSync').mockImplementation(() => {});
  const app = await renderApp({ path: '/' });
  await expect.element(app.screen.getByRole('heading', { name: 'Тренировка' })).toBeVisible();
  const owner = await trainingRepository.store.currentOwner(); if (!owner) throw new Error('fixture owner missing');
  const q = { ...questionFixture('multiple_choice'), figure: data };
  const training = storedTraining(trainingSession({ mode: check ? 'check' : 'practice', timeLimitSeconds: check ? 300 : undefined, section: 'quant', items: [0, 1].map((position) => ({ position, question: { ...q, figure: position === 0 ? data : nextData, id: `00000000-0000-4000-8000-00000000000${position}` } })) }), Date.now());
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


test('непереполненный график не получает роль, подпись прокрутки и место в табуляции; стрелка меняет вопрос после клика', async () => {
  const data = { ...figure, categories: ['A'], series: [{ id: 's', label: 'S', values: [1] }] };
  const { app } = await bootFigures(data, true);
  const scroll = document.querySelector<HTMLElement>('[data-figure-scroll]')!;
  expect(scroll.scrollWidth).toBe(scroll.clientWidth);
  expect(scroll.hasAttribute('tabindex')).toBe(false);
  expect(scroll.hasAttribute('role')).toBe(false);
  expect(scroll.hasAttribute('aria-label')).toBe(false);
  await userEvent.click(scroll);
  await userEvent.keyboard('{ArrowRight}');
  await expect.element(app.screen.getByLabelText('Вопрос 2 из 2', { exact: true })).toBeVisible();
});

test('ResizeObserver включает и снимает доступность прокрутки при изменении размеров', async () => {
  let notify = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { notify = callback; }
    observe() {} disconnect = disconnect;
  });
  const view = await render(<DataFigure figure={{ ...figure, kind: 'table' }} />);
  const scroll = view.container.querySelector<HTMLElement>('[data-figure-scroll]')!;
  Object.defineProperties(scroll, { scrollWidth: { configurable: true, value: 1000 }, clientWidth: { configurable: true, value: 500 } });
  notify();
  await expect.element(view.getByRole('region', { name: /Synthetic data/ })).toBeVisible();
  expect(scroll.tabIndex).toBe(0);
  Object.defineProperty(scroll, 'clientWidth', { configurable: true, value: 1000 });
  notify();
  await expect.poll(() => scroll.hasAttribute('tabindex')).toBe(false);
  await view.unmount(); expect(disconnect).toHaveBeenCalled();
});

test('без ResizeObserver рисунок остаётся доступен и измеряется при первом показе', async () => {
  vi.stubGlobal('ResizeObserver', undefined);
  const view = await render(<DataFigure figure={{ ...figure, kind: 'table', series: Array.from({ length: 20 }, (_, i) => ({ ...figure.series[0]!, id: String(i), label: `Series ${i}` })) }} />);
  await expect.element(view.getByRole('region', { name: /Synthetic data/ })).toBeVisible();
});

for (const kind of ['bar', 'line'] as const) test(`${kind}: SVG имеет масштаб 1:1, увеличенный шрифт не сталкивает категории`, async () => {
  const view = await render(<div style={{ width: 500 }}><DataFigure figure={{ ...figure, kind, categories: ['mmmmmmmmmmmmmmmmmm', 'wwwwwwwwwwwwwwwwww'], series: [{ id: 's', label: 'Series', values: [1, 2] }] }} /></div>);
  const svg = view.container.querySelector<SVGSVGElement>('[data-figure-scroll] svg')!;
  await expect.poll(() => svg.getBoundingClientRect().width / svg.viewBox.baseVal.width).toBeCloseTo(1);
  const originalHeight = svg.viewBox.baseVal.height;
  document.documentElement.dataset.textSize = 'large';
  await expect.poll(() => svg.viewBox.baseVal.height).toBeGreaterThan(originalHeight);
  await expect.poll(() => {
    const labels = svg.querySelectorAll<SVGTextElement>('svg > text');
    const first = labels[0]!.getBBox(); const second = labels[1]!.getBBox();
    return first.x + first.width <= second.x;
  }).toBe(true);
  expect(svg.getBoundingClientRect().width / svg.viewBox.baseVal.width).toBeCloseTo(1);
});

test('геометрия не пересчитывается от несвязанного состояния родителя; bar не разводит метки линий', async () => {
  vi.mocked(geometry.figureScale).mockClear(); vi.mocked(geometry.figureLabelPositions).mockClear();
  function Parent() { const [count, setCount] = useState(0); return <><button onClick={() => setCount(count + 1)}>Count {count}</button><DataFigure figure={figure} /></>; }
  const view = await render(<Parent />);
  await expect.element(view.getByRole('figure')).toBeVisible();
  const calls = vi.mocked(geometry.figureScale).mock.calls.length;
  await view.getByRole('button', { name: 'Count 0' }).click();
  expect(vi.mocked(geometry.figureScale).mock.calls.length).toBe(calls);
  expect(geometry.figureLabelPositions).not.toHaveBeenCalled();
});

for (const review of [false, true]) test(`новый рисунок сбрасывает прокрутку и фокус: ${review ? 'разбор' : 'сессия'}`, async () => {
  const data = { ...figure, kind: 'table' as const, series: Array.from({ length: 10 }, (_, i) => ({ ...figure.series[0]!, id: String(i), label: `Series ${i}` })) };
  const next = { ...data, id: 'another-table', title: 'Another table' };
  const { app, training } = await bootFigures(data, true, next);
  if (review) {
    const owner = await trainingRepository.store.currentOwner(); if (!owner) throw new Error('fixture owner missing');
    await trainingRepository.store.put(owner, { ...training, finish: { finishedAt: new Date().toISOString(), timedOut: false } });
  }
  if (review) await app.router.navigate({ to: '/training/$trainingId/review/$position', params: { trainingId: training.session.id, position: 0 } });
  await expect.element(app.screen.getByRole('figure')).toBeVisible();
  const scroll = document.querySelector<HTMLElement>('[data-figure-scroll]')!;
  scroll.scrollLeft = scroll.scrollWidth; scroll.focus();
  expect(scroll.scrollLeft).toBeGreaterThan(0);
  await app.screen.getByRole('button', { name: review ? 'Следующий' : 'Пропустить', exact: true }).click();
  await expect.element(app.screen.getByText('Another table', { exact: true })).toBeVisible();
  expect(document.querySelector('[data-figure-scroll]')).not.toBe(scroll);
  expect(document.querySelector('[data-figure-scroll]')?.scrollLeft).toBe(0);
  expect(document.activeElement).not.toBe(scroll);
});

test('таблица отделяет шапку линией и выравнивает заголовки чисел над значениями', async () => {
  const view = await render(<DataFigure figure={{ ...figure, kind: 'table' }} />);
  const headers = view.container.querySelectorAll('thead th');
  expect(getComputedStyle(headers[0]!).borderBottomWidth).not.toBe('0px');
  expect(getComputedStyle(headers[0]!).textAlign).toBe('left');
  expect(getComputedStyle(headers[1]!).textAlign).toBe('right');
  expect(getComputedStyle(view.container.querySelector('tbody tr:last-child th')!).borderBottomWidth).toBe('0px');
});

test('подписи осей обрезают внешние пробелы; пустая подпись таблицы берёт перевод', async () => {
  const view = await render(<I18nProvider locale="en"><DataFigure figure={{ ...figure, kind: 'table', xLabel: '  ', yLabel: ' Orders ', unit: ' orders ' }} /></I18nProvider>);
  await expect.element(view.getByRole('columnheader', { name: 'Category', exact: true })).toBeVisible();
  await expect.element(view.getByText('Orders', { exact: true })).toBeVisible();
});

for (const theme of ['light', 'dark']) test(`все пять цветов графики имеют контраст не ниже 3:1: ${theme}`, async () => {
  document.documentElement.dataset.theme = theme;
  const view = await render(<DataFigure figure={{ ...figure, series: Array.from({ length: 5 }, (_, i) => ({ ...figure.series[0]!, id: String(i), label: `Series ${i}` })) }} />);
  const root = getComputedStyle(view.container.querySelector('figure')!);
  const luminance = (color: string) => {
    const channels = color.match(/\d+/g)!.slice(0, 3).map(Number).map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const background = luminance(root.backgroundColor);
  for (const series of view.container.querySelectorAll('[data-series]')) {
    const color = luminance(getComputedStyle(series).color);
    expect((Math.max(color, background) + 0.05) / (Math.min(color, background) + 0.05)).toBeGreaterThanOrEqual(3);
  }
  expect((view.container.querySelector('[data-series]') as SVGElement).style.color).toBe('var(--color-quant)');
});
