import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/i18n';
import { useShell } from '../../shellContext';
import { numericInputError } from '../answerFormats';
import { Cross, SessionIcon } from '../QuestionContent';
import { calculatorAnswer, pressCalculator } from './engine';
import { saveSessionCalculator, sessionCalculator, type Position } from './store';
import styles from './Calculator.module.css';

export function CalculatorButton({ open, onClick, buttonRef }: { open: boolean; onClick: () => void; buttonRef: RefObject<HTMLButtonElement | null> }) {
  const { t } = useI18n();
  return <button ref={buttonRef} type="button" className={styles.trigger} aria-label={t.training.calculator} aria-expanded={open} aria-haspopup="dialog" onClick={onClick}>
    <SessionIcon><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 3h1m6 0h1" /></SessionIcon>
  </button>;
}

const KEYS = ['MR', 'MC', 'M+', '(', ')', '7', '8', '9', '÷', '√', '4', '5', '6', '×', '±', '1', '2', '3', '−', 'C', '0', '.', '=', '+', 'CE'] as const;
const localNumber = (value: string, locale: string) => locale === 'ru' ? value.replaceAll('.', ',') : value;

export function Calculator({ sessionId, open, onClose, onTransfer }: { sessionId: string; open: boolean; onClose: () => void; onTransfer?: (value: string) => void }) {
  const { t, locale } = useI18n();
  const text = t.training;
  const { shell } = useShell();
  // 900 — layout.breakpoint-wide; matchMedia не принимает CSS-переменные.
  const [wide, setWide] = useState(() => matchMedia('(min-width: 900px)').matches);
  const windowMode = shell === 'site' && wide;
  const [stored, setStored] = useState(() => sessionCalculator(sessionId));
  const [moving, setMoving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ pointer: number; offset: Position } | null>(null);
  const positionRef = useRef(stored.position);
  const reasonId = useId();
  const state = stored.calculator;
  const displayed = state.error ? text.calculator_errors[state.error] : localNumber(state.display, locale);
  const announced = useRef('');
  const lastAnnouncement = useRef(state.announcement);
  if (lastAnnouncement.current !== state.announcement) { lastAnnouncement.current = state.announcement; announced.current = displayed; }
  const answer = calculatorAnswer(state);
  const reason = state.error ? text.calculator_invalid : answer === undefined ? text.calculator_empty : numericInputError([answer], false) ? text.calculator_long : undefined;
  const press = (key: string) => setStored((previous) => {
    const next = { ...previous, calculator: pressCalculator(previous.calculator, key) };
    saveSessionCalculator(sessionId, next); return next;
  });
  useEffect(() => {
    const media = matchMedia('(min-width: 900px)');
    const changed = () => setWide(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const moveTo = (desired?: Position) => {
    const element = dialog.current!;
    const tokens = getComputedStyle(element);
    const gutter = parseFloat(tokens.getPropertyValue('--space-16'));
    const top = Math.max(gutter, parseFloat(tokens.getPropertyValue('--app-inset-top')) || 0);
    const bounds = element.getBoundingClientRect();
    const header = document.querySelector('main header')?.getBoundingClientRect();
    const right = Math.min(innerWidth - gutter, header?.right ?? innerWidth - gutter);
    let x = Math.max(gutter, Math.min(desired?.x ?? right - bounds.width, innerWidth - bounds.width - gutter));
    let y = Math.max(top, Math.min(desired?.y ?? (header?.bottom ?? top) + gutter, innerHeight - bounds.height - gutter));
    const field = document.querySelector('main input')?.getBoundingClientRect();
    if (field && x < field.right && x + bounds.width > field.left && y < field.bottom && y + bounds.height > field.top) {
      // При повороте или возврате в вопрос сохранённое окно не прячет редактируемый ответ.
      if (field.right + gutter + bounds.width <= innerWidth - gutter) x = field.right + gutter;
      else if (field.left - gutter - bounds.width >= gutter) x = field.left - gutter - bounds.width;
      else if (field.top - gutter - bounds.height >= top) y = field.top - gutter - bounds.height;
      else y = Math.min(innerHeight - bounds.height - gutter, field.bottom + gutter);
    }
    const position = { x, y };
    element.style.left = `${x}px`; element.style.top = `${y}px`;
    positionRef.current = position;
    setStored((previous) => {
      if (previous.position?.x === x && previous.position.y === y) return previous;
      const next = { ...previous, position }; saveSessionCalculator(sessionId, next); return next;
    });
  };
  const layout = useRef(moveTo);
  useLayoutEffect(() => { layout.current = moveTo; });
  useLayoutEffect(() => {
    if (!open) return;
    dialog.current?.focus({ preventScroll: true });
    if (!windowMode) { dialog.current?.style.removeProperty('left'); dialog.current?.style.removeProperty('top'); return; }
    const fit = () => layout.current(positionRef.current);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(dialog.current!);
    window.addEventListener('resize', fit);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); };
  }, [open, windowMode]);
  useEffect(() => { if (!open) { drag.current = null; setDragging(false); setMoving(false); } }, [open]);
  return createPortal(<dialog ref={dialog} open={open} role="dialog" aria-label={text.calculator} tabIndex={-1} className={`${styles.dialog} ${windowMode ? styles.window : ''}`} data-calculator data-mode={windowMode ? 'window' : 'sheet'}
    onKeyDown={(event) => {
      // Событие не доходит до горячих клавиш сессии, включая буквы вариантов и Enter.
      event.stopPropagation();
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      else if (/^[0-9.,+−\-*/×÷()]$/.test(event.key) || ['Enter', 'Backspace', 'Delete'].includes(event.key)) {
        event.preventDefault(); press(event.key === 'Enter' ? '=' : event.key === 'Backspace' ? 'CE' : event.key === 'Delete' ? 'C' : event.key);
      }
    }}>
    <div className={styles.heading} data-dragging={dragging} onPointerDown={(event) => {
      if (!windowMode || !event.isPrimary || event.button !== 0 || drag.current || event.target instanceof Element && event.target.closest('button')) return;
      const bounds = dialog.current!.getBoundingClientRect();
      drag.current = { pointer: event.pointerId, offset: { x: event.clientX - bounds.left, y: event.clientY - bounds.top } };
      event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
    }} onPointerMove={(event) => {
      const active = drag.current;
      if (active?.pointer === event.pointerId) moveTo({ x: event.clientX - active.offset.x, y: event.clientY - active.offset.y });
    }} onPointerUp={(event) => {
      if (drag.current?.pointer !== event.pointerId) return;
      drag.current = null; setDragging(false); event.currentTarget.releasePointerCapture(event.pointerId);
    }} onLostPointerCapture={() => { drag.current = null; setDragging(false); }}>
      <h2>{text.calculator}{windowMode && <small>{text.calculator_drag}</small>}</h2>
      <button type="button" className={styles.close} aria-label={text.calculator_close} onClick={onClose}><Cross /></button>
    </div>
    <div className={styles.display}>
      <small className={styles.expression}>{state.memory.n !== 0n && <span aria-label={text.calculator_memory}>M · </span>}{localNumber(state.expression, locale)}</small>
      <span className={styles.result} data-error={Boolean(state.error)} data-testid="calculator-display">{displayed || '\u00a0'}</span>
    </div>
    <span className="visually-hidden" aria-live="polite" aria-atomic="true">{announced.current && `${text.calculator_result}: ${announced.current}`}</span>
    <div className={styles.keys}>{KEYS.map((key) => <button key={key} type="button" className={styles.key} data-function={!/^[0-9.=]$/.test(key)} data-equals={key === '='}
      aria-label={key in text.calculator_keys ? text.calculator_keys[key as keyof typeof text.calculator_keys] : key} onClick={() => press(key)}>{key === '.' && locale === 'ru' ? ',' : key}</button>)}</div>
    {onTransfer && <><button type="button" className={styles.transfer} disabled={Boolean(reason)} aria-describedby={reason ? reasonId : undefined} onClick={() => { if (answer !== undefined && !reason) onTransfer(localNumber(answer, locale)); }}>{text.calculator_transfer}</button>
      {reason && <p className={styles.reason} id={reasonId}>{reason}</p>}</>}
    {windowMode && <div className={styles.positionActions}>
      <button type="button" aria-expanded={moving} onClick={() => setMoving(!moving)}>{text.calculator_move}</button>
      {moving && <button type="button" onClick={() => moveTo()}>{text.calculator_reset_position}</button>}
    </div>}
  </dialog>, document.body);
}
