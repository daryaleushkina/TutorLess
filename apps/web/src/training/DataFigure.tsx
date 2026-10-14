import type { DataFigure as Figure } from '@greprep/api-client';
import type { CSSProperties, ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import { useShell } from '../shellContext';
import { figureLabel, figureLabelUnits, figureLabelPositions, figureScale, figureValue, validFigure } from './figureGeometry';
import styles from './DataFigure.module.css';

const PALETTE = ['quant', 'verbal', 'essay', 'exam', 'words'];
const DASHES = ['none', '6 3', '2 3', '8 3 2 3', '1 2'];
const seriesStyle = (index: number): CSSProperties => ({ color: `var(--color-${PALETTE[index % PALETTE.length]})`, strokeDasharray: DASHES[Math.floor(index / 4)] });

function Marker({ index, x = 0, y = 0 }: { index: number; x?: number; y?: number }) {
  const shape = index % 4;
  return <g transform={`translate(${x} ${y})`} className={styles.marker} data-marker={index}>
    {shape === 0 ? <circle r="4" /> : shape === 1 ? <rect x="-4" y="-4" width="8" height="8" /> : <path d={shape === 2 ? 'M0 -5 5 4 -5 4Z' : 'M0 -5 5 0 0 5 -5 0Z'} />}
  </g>;
}

export function DataFigure({ figure }: { figure: Figure }) {
  const { t, locale } = useI18n();
  const valid = validFigure(figure);
  const axisLabel = [figure.yLabel, figure.unit].filter((label, index, labels) => label && labels.findIndex((other) => other.toLowerCase() === label.toLowerCase()) === index).join(' · ');
  return <figure className={styles.figure} aria-label={figure.description} lang="en" data-data-figure={figure.kind}>
    <figcaption className={styles.title}>{figure.title}</figcaption>
    {!valid ? <><p lang={locale}>{t.training.figure_unavailable}</p><p>{figure.description}</p></> : <>
      {axisLabel && <p className={styles.axis}>{axisLabel}</p>}
      {figure.kind !== 'table' && <ul className={styles.legend}>{figure.series.map((series, index) => <li key={index}>
        <svg viewBox="0 0 32 16" aria-hidden="true" style={seriesStyle(index)}><line x1="0" y1="8" x2="32" y2="8" /><Marker index={index} x={16} y={8} /></svg><span>{series.label}</span>
      </li>)}</ul>}
      <div className={styles.scroll} tabIndex={0} role="region" aria-label={t.training.figure_scroll} lang={locale} data-figure-scroll>
        {figure.kind === 'table' ? <table lang="en" aria-label={figure.title}>
          <thead><tr><th scope="col" lang={figure.xLabel ? 'en' : locale}>{figure.xLabel || t.training.figure_category}</th>{figure.series.map((series, index) => <th scope="col" key={index}>{series.label}</th>)}</tr></thead>
          <tbody>{figure.categories.map((category, row) => <tr key={row}><th scope="row">{category}</th>{figure.series.map((series, index) => <td key={index}>{figureValue(series.values[row]!)}</td>)}</tr>)}</tbody>
        </table> : <Chart figure={figure} />}
      </div>
      {figure.kind !== 'table' && figure.xLabel && <p className={styles.xAxis}>{figure.xLabel}</p>}
    </>}
  </figure>;
}

function Chart({ figure }: { figure: Figure }) {
  const scale = figureScale(figure.series);
  const labels = figure.categories.map((label) => figureLabel(label));
  const valueWidth = Math.max(40, ...figure.series.flatMap((series) => series.values.map((value) => figureValue(value).length * 8 + 16)));
  const labelWidth = Math.max(...labels.flatMap((lines) => lines.map((line) => figureLabelUnits(line) * 7 + 16)));
  const step = Math.max(labelWidth, figure.kind === 'bar' ? valueWidth * figure.series.length : valueWidth);
  const left = Math.max(40, ...scale.ticks.map((tick) => figureValue(tick.value).length * 8 + 12));
  const naturalWidth = left + figure.categories.length * step + 16;
  const width = Math.max(330, naturalWidth);
  const stride = (width - left - 16) / figure.categories.length;
  const plotHeight = Math.max(180, figure.series.length * 22);
  const top = 28;
  const y = (value: number) => top + scale.ratio(value) * plotHeight;
  const zero = y(0);
  const x = (category: number) => left + stride * (category + 0.5);
  const height = top + plotHeight + 42 + Math.max(...labels.map((lines) => lines.length)) * 18;
  const positions = figure.categories.map((_, category) => figureLabelPositions(figure.series.map((series) => y(series.values[category]!) - 10), 14, top + plotHeight - 8, 18));
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} style={{ minWidth: naturalWidth > 330 ? `${width / 16}em` : undefined }} aria-hidden="true" lang="en">
    {scale.ticks.map((tick, index) => <g key={index} className={styles.grid}>
      <line x1={left} x2={width - 16} y1={top + tick.ratio * plotHeight} y2={top + tick.ratio * plotHeight} />
      <text className={styles.tick} x={left - 8} y={top + tick.ratio * plotHeight + 4}>{figureValue(tick.value)}</text>
    </g>)}
    <line className={styles.zero} x1={left} x2={width - 16} y1={zero} y2={zero} />
    {figure.series.map((series, index) => <g key={index} style={seriesStyle(index)} data-series={series.id}>
      {figure.kind === 'line' && <polyline className={styles.line} points={series.values.map((value, category) => `${x(category)},${y(value)}`).join(' ')} />}
      {series.values.map((value, category) => {
        const pointX = figure.kind === 'line' ? x(category) : x(category) + (index - (figure.series.length - 1) / 2) * valueWidth;
        const pointY = y(value);
        const labelY = figure.kind === 'line' ? positions[category]![index]! : pointY + (value < 0 ? 18 : -10);
        return <g key={category}>
          {figure.kind === 'bar' && <rect className={styles.bar} x={pointX - valueWidth / 3} y={Math.min(zero, pointY)} width={valueWidth * 2 / 3} height={Math.abs(zero - pointY)} />}
          {figure.kind === 'line' && <line className={styles.connector} x1={pointX} x2={pointX} y1={pointY} y2={labelY + 4} />}
          <Marker index={index} x={pointX} y={pointY} />
          <text className={styles.value} x={pointX} y={labelY}>{figureValue(value)}</text>
        </g>;
      })}
    </g>)}
    {labels.map((lines, category) => <text className={styles.category} key={category} x={x(category)} y={top + plotHeight + 42}>{lines.map((line, index) => <tspan key={index} x={x(category)} dy={index === 0 ? 0 : 18}>{line}</tspan>)}</text>)}
  </svg>;
}

/** Рисунок повторяется над каждым вопросом; на компьютере материал и вопрос рядом. */
export function FigureQuestion({ figure, children }: { figure: Figure; children: ReactNode }) {
  const { shell } = useShell();
  return <div className={styles.columns} data-shell={shell} data-figure-question><DataFigure figure={figure} /><div className={styles.question}>{children}</div></div>;
}
