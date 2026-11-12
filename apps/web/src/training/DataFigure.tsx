import type { DataFigure as Figure } from '@greprep/api-client';
import { memo, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import { useShell } from '../shellContext';
import { figureLabel, figureLabelUnits, figureLabelPositions, figureScale, figureValue, validFigure } from './figureGeometry';
import styles from './DataFigure.module.css';

// Цвета графики имеют ≥ 3:1 к поверхности в обеих темах; Quant остаётся первым по R12.
const SERIES_COLORS = ['quant', 'verbal', 'exam', 'words', 'essay-ink'];
const SERIES_DASHES = ['none', '6 3', '2 3', '8 3 2 3', '1 2'];
const seriesStyle = (index: number): CSSProperties => ({ color: `var(--color-${SERIES_COLORS[index % SERIES_COLORS.length]})`, strokeDasharray: SERIES_DASHES[Math.floor(index / MARKER_SHAPES)] });

// Координаты символов SVG, а не отступы интерфейса. Размер текста берётся из токена.
const MARKER_SHAPES = 4;
const MARKER_RADIUS = 4;
// Треугольник и ромб на четверть крупнее: при той же площади, что у круга, они не выглядят мельче.
const MARKER_POINT = MARKER_RADIUS * 1.25;
const LEGEND_WIDTH = 32;
const LEGEND_HEIGHT = 16;

function Marker({ index, x = 0, y = 0 }: { index: number; x?: number; y?: number }) {
  const shape = index % MARKER_SHAPES;
  return <g transform={`translate(${x} ${y})`} className={styles.marker} data-marker={index}>
    {shape === 0 ? <circle r={MARKER_RADIUS} /> : shape === 1 ? <rect x={-MARKER_RADIUS} y={-MARKER_RADIUS} width={MARKER_RADIUS * 2} height={MARKER_RADIUS * 2} /> : <path d={shape === 2 ? `M0 ${-MARKER_POINT} ${MARKER_POINT} ${MARKER_RADIUS} ${-MARKER_POINT} ${MARKER_RADIUS}Z` : `M0 ${-MARKER_POINT} ${MARKER_POINT} 0 0 ${MARKER_POINT} ${-MARKER_POINT} 0Z`} />}
  </g>;
}

export const DataFigure = memo(function DataFigure({ figure }: { figure: Figure }) {
  const { t, locale } = useI18n();
  const valid = useMemo(() => validFigure(figure), [figure]);
  // Маршрутизатор восстанавливает прокрутку по селектору; новая рамка не наследует её от старой.
  const scrollId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const font = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ width: 0, fontSize: 0, overflow: false });
  useLayoutEffect(() => {
    const element = frame.current, metric = font.current;
    if (!element || !metric) return;
    const measure = () => {
      const next = { width: element.clientWidth, fontSize: Number.parseFloat(getComputedStyle(metric).fontSize), overflow: element.scrollWidth > element.clientWidth };
      setSize((previous) => previous.width === next.width && previous.fontSize === next.fontSize && previous.overflow === next.overflow ? previous : next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // Проба в 1 em меняет размер и при увеличении текста без изменения ширины рамки.
    observer.observe(metric);
    return () => observer.disconnect();
  }, [figure]);
  const xLabel = figure.xLabel.trim();
  const axisLabel = [figure.yLabel.trim(), figure.unit.trim()].filter((label, index, labels) => label && labels.findIndex((other) => other.toLowerCase() === label.toLowerCase()) === index).join(' · ');
  return <figure className={styles.figure} aria-label={figure.description} lang="en" data-data-figure={figure.kind}>
    <figcaption className={styles.title}>{figure.title}</figcaption>
    {!valid ? <><p lang={locale}>{t.training.figure_unavailable}</p><p>{figure.description}</p></> : <>
      {axisLabel && <p className={styles.axis}>{axisLabel}</p>}
      {figure.kind !== 'table' && <ul className={styles.legend}>{figure.series.map((series, index) => <li key={index}>
        <svg viewBox={`0 0 ${LEGEND_WIDTH} ${LEGEND_HEIGHT}`} aria-hidden="true" style={seriesStyle(index)}><line x1={0} y1={LEGEND_HEIGHT / 2} x2={LEGEND_WIDTH} y2={LEGEND_HEIGHT / 2} /><Marker index={index} x={LEGEND_WIDTH / 2} y={LEGEND_HEIGHT / 2} /></svg><span>{series.label}</span>
      </li>)}</ul>}
      <div ref={frame} data-scroll-restoration-id={`figure/${figure.id}/${scrollId}`} className={styles.scroll} tabIndex={size.overflow ? 0 : undefined} role={size.overflow ? 'region' : undefined} aria-label={size.overflow ? t.training.figure_scroll(figure.title) : undefined} lang={locale} data-figure-scroll>
        <span ref={font} className={styles.fontMetric} aria-hidden="true" />
        {figure.kind === 'table' ? <table lang="en" aria-label={figure.title}>
          <thead><tr><th scope="col" lang={xLabel ? 'en' : locale}>{xLabel || t.training.figure_category}</th>{figure.series.map((series, index) => <th scope="col" key={index}>{series.label}</th>)}</tr></thead>
          <tbody>{figure.categories.map((category, row) => <tr key={row}><th scope="row">{category}</th>{figure.series.map((series, index) => <td key={index}>{figureValue(series.values[row]!)}</td>)}</tr>)}</tbody>
        </table> : <Chart figure={figure} frameWidth={size.width} fontSize={size.fontSize} />}
      </div>
      {figure.kind !== 'table' && xLabel && <p className={styles.xAxis}>{xLabel}</p>}
    </>}
  </figure>;
});

// Множители координат SVG выражены в измеренном размере шрифта подписи.
// Это геометрия рисунка, не новые размеры интерфейса: шрифт задаёт --font-caption.
const GLYPH_EM = 0.62;
const CELL_PADDING_EM = 1.25;
const MIN_CELL_EM = 3.1;
const RIGHT_PADDING_EM = 1.25;
const PLOT_HEIGHT_EM = 14;
const SERIES_HEIGHT_EM = 1.7;
const TOP_PADDING_EM = 2.15;
const CATEGORY_OFFSET_EM = 3.2;
const LABEL_LINE_EM = 1.45;
const VALUE_ABOVE_EM = 0.8;
const VALUE_BELOW_EM = 1.4;
const TEXT_BASELINE_EM = 0.3;
const TICK_GAP_EM = 0.62;
const LABEL_TOP_EM = 1.1;

function Chart({ figure, frameWidth, fontSize }: { figure: Figure; frameWidth: number; fontSize: number }) {
  const scale = useMemo(() => figureScale(figure.series), [figure]);
  const labels = useMemo(() => figure.categories.map((label) => figureLabel(label)), [figure]);
  const geometry = useMemo(() => {
    const textWidth = (text: string) => figureLabelUnits(text) * fontSize * GLYPH_EM;
    const padding = fontSize * CELL_PADDING_EM;
    const valueWidth = Math.max(fontSize * MIN_CELL_EM, ...figure.series.flatMap((series) => series.values.map((value) => textWidth(figureValue(value)) + padding)));
    const labelWidth = Math.max(...labels.flatMap((lines) => lines.map((line) => textWidth(line) + padding)));
    const step = Math.max(labelWidth, figure.kind === 'bar' ? valueWidth * figure.series.length : valueWidth);
    const left = Math.max(fontSize * MIN_CELL_EM, ...scale.ticks.map((tick) => textWidth(figureValue(tick.value)) + padding));
    const right = fontSize * RIGHT_PADDING_EM;
    const width = Math.max(frameWidth, left + figure.categories.length * step + right);
    const stride = (width - left - right) / figure.categories.length;
    const plotHeight = fontSize * Math.max(PLOT_HEIGHT_EM, figure.series.length * SERIES_HEIGHT_EM);
    const top = fontSize * TOP_PADDING_EM;
    const y = (value: number) => top + scale.ratio(value) * plotHeight;
    const x = (category: number) => left + stride * (category + 0.5);
    const categoryY = top + plotHeight + fontSize * CATEGORY_OFFSET_EM;
    const labelGap = fontSize * LABEL_LINE_EM;
    const height = categoryY + Math.max(...labels.map((lines) => lines.length)) * labelGap;
    const positions = figure.kind === 'line' ? figure.categories.map((_, category) => figureLabelPositions(figure.series.map((series) => y(series.values[category]!) - fontSize * VALUE_ABOVE_EM), fontSize * LABEL_TOP_EM, top + plotHeight - fontSize * TICK_GAP_EM, labelGap)) : [];
    return { valueWidth, left, right, width, plotHeight, top, x, y, categoryY, labelGap, height, positions };
  }, [figure, frameWidth, fontSize, scale, labels]);
  const { valueWidth, left, right, width, plotHeight, top, x, y, categoryY, labelGap, height, positions } = geometry;
  const zero = y(0);
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} style={{ width, height }} aria-hidden="true" lang="en">
    {scale.ticks.map((tick, index) => <g key={index} className={styles.grid}>
      <line x1={left} x2={width - right} y1={top + tick.ratio * plotHeight} y2={top + tick.ratio * plotHeight} />
      <text className={styles.tick} x={left - fontSize * TICK_GAP_EM} y={top + tick.ratio * plotHeight + fontSize * TEXT_BASELINE_EM}>{figureValue(tick.value)}</text>
    </g>)}
    <line className={styles.zero} x1={left} x2={width - right} y1={zero} y2={zero} />
    {figure.series.map((series, index) => <g key={index} style={seriesStyle(index)} data-series={series.id}>
      {figure.kind === 'line' && <polyline className={styles.line} points={series.values.map((value, category) => `${x(category)},${y(value)}`).join(' ')} />}
      {series.values.map((value, category) => {
        const pointX = figure.kind === 'line' ? x(category) : x(category) + (index - (figure.series.length - 1) / 2) * valueWidth;
        const pointY = y(value);
        const labelY = figure.kind === 'line' ? positions[category]![index]! : pointY + fontSize * (value < 0 ? VALUE_BELOW_EM : -VALUE_ABOVE_EM);
        return <g key={category}>
          {figure.kind === 'bar' && <rect className={styles.bar} x={pointX - valueWidth / 3} y={Math.min(zero, pointY)} width={valueWidth * 2 / 3} height={Math.abs(zero - pointY)} />}
          {figure.kind === 'line' && <line className={styles.connector} x1={pointX} x2={pointX} y1={pointY} y2={labelY + fontSize * TEXT_BASELINE_EM} />}
          <Marker index={index} x={pointX} y={pointY} />
          <text className={styles.value} x={pointX} y={labelY}>{figureValue(value)}</text>
        </g>;
      })}
    </g>)}
    {labels.map((lines, category) => <text className={styles.category} key={category} x={x(category)} y={categoryY}>{lines.map((line, index) => <tspan key={index} x={x(category)} dy={index === 0 ? 0 : labelGap}>{line}</tspan>)}</text>)}
  </svg>;
}

/** Рисунок повторяется над каждым вопросом; на компьютере материал и вопрос рядом. */
export function FigureQuestion({ figure, children }: { figure: Figure; children: ReactNode }) {
  const { shell } = useShell();
  return <div className={styles.columns} data-shell={shell} data-figure-question><DataFigure figure={figure} /><div className={styles.question}>{children}</div></div>;
}
