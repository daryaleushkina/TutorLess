import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { trainingNumericSolution } from '@greprep/api-client';
import { useI18n } from '../i18n/i18n';
import { useShell } from '../shellContext';
import { answerFormat, draftAnswer, numericInputError } from './answerFormats';
import type { AnswerProps } from './QuestionContent';
import styles from './Training.module.css';

/** Управляемое поле: калькулятор может передать значение тем же путём, что клавиатура. */
export function NumericInput({ value, onChange, externalValue, integer = false, label, invalid = false, describedBy, onSubmit, unitBefore, unitAfter, enterKeyHint = 'done' }: {
  value: string; onChange: (value: string) => void; externalValue?: string; integer?: boolean;
  label: string; invalid?: boolean; describedBy?: string; onSubmit?: () => void;
  unitBefore?: string; unitAfter?: string; enterKeyHint?: 'next' | 'done';
}) {
  const { shell, launch } = useShell();
  // Полная клавиатура на iPhone и iPad даёт минус, которого нет в decimal/numeric (решение Даши 13.10.2026).
  // Telegram сообщает платформу сам; iPadOS на сайте может представляться компьютером.
  const ios = shell === 'telegram' ? launch?.platform === 'ios' : /iPhone|iPad|iPod/.test(navigator.userAgent) || /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  const unitId = useId();
  const hasUnits = Boolean(unitBefore || unitAfter);
  const latestChange = useRef(onChange);
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { latestChange.current = onChange; });
  useEffect(() => { if (externalValue !== undefined) latestChange.current(externalValue); }, [externalValue]);
  useEffect(() => {
    const field = input.current!;
    const before = (event: InputEvent) => {
      if (event.isComposing || event.inputType !== 'insertText' || !event.data) return;
      const next = field.value.slice(0, field.selectionStart ?? 0) + event.data + field.value.slice(field.selectionEnd ?? 0);
      if (!(integer ? /^-?\d*$/ : /^-?\d*[.,]?\d*$/).test(next)) event.preventDefault();
    };
    field.addEventListener('beforeinput', before);
    return () => field.removeEventListener('beforeinput', before);
  }, [integer, hasUnits]);
  const description = [describedBy, unitBefore && `${unitId}-before`, unitAfter && `${unitId}-after`].filter(Boolean).join(' ') || undefined;
  const field = <input ref={input} type="text" inputMode={ios ? 'text' : integer ? 'numeric' : 'decimal'} enterKeyHint={enterKeyHint}
    autoComplete="off" spellCheck={false} aria-label={label} aria-invalid={invalid} aria-describedby={description}
    className={styles.numericInput} value={value} onChange={(event) => onChange(event.target.value)}
    onKeyDown={(event) => { if (event.key === 'Enter' && onSubmit) { event.preventDefault(); onSubmit(); } }} />;
  // Подписи придут из договора в задаче #45; без явных значений поле сохраняет прежнюю разметку.
  return hasUnits ? <div className={styles.numericField}>
    {unitBefore && <span id={`${unitId}-before`} className={styles.numericUnit}>{unitBefore}</span>}
    {field}
    {unitAfter && <span id={`${unitId}-after`} className={styles.numericUnit}>{unitAfter}</span>}
  </div> : field;
}

export function NumericAnswer({ question, selection, revealed, onChange, onSubmit }: AnswerProps) {
  const { t, locale } = useI18n();
  const text = t.training;
  const errorId = useId();
  const fraction = question.numericEntry?.format === 'fraction';
  const complete = answerFormat(question)?.isComplete(question, draftAnswer(question, selection));
  const denominator = selection[1] ?? '';
  const error = numericInputError(selection, fraction);
  const invalid = error !== undefined;
  const change = (index: number, value: string) => {
    const next = fraction ? [selection[0] ?? '', selection[1] ?? ''] : [selection[0] ?? ''];
    next[index] = value; onChange?.(next);
  };
  if (revealed) {
    const correct = answerFormat(question)?.isCorrect(question, draftAnswer(question, selection)) ?? false;
    const display = (value: string[]) => value.length === 2 ? `${value[0]} / ${value[1]}` : locale === 'ru' ? (value[0] ?? '').replaceAll('.', ',') : (value[0] ?? '').replaceAll(',', '.');
    const key = trainingNumericSolution(question);
    const expected = key?.number !== undefined ? [key.number] : [key?.numerator ?? '', key?.denominator ?? ''];
    return <div className={styles.answerTable}>
      {selection.some(Boolean) && <div className={styles.answerRow}><div><span>{text.answer_yours}</span><span className={styles.answerPill} data-result={correct ? 'correct' : 'wrong'}>{display(selection)}</span></div></div>}
      {!correct && <div className={styles.answerRow}><div><span>{text.answer_correct}</span><span className={styles.answerPill} data-result="correct">{display(expected)}</span></div></div>}
    </div>;
  }
  return <div className={styles.numericAnswer}>
    <div className={fraction ? styles.fractionWrap : styles.numericEntry}>
      <div className={fraction ? styles.fraction : undefined}>
        <NumericInput value={selection[0] ?? ''} onChange={(value) => change(0, value)} label={fraction ? text.numeric_numerator : text.numeric_answer}
          integer={fraction} enterKeyHint={fraction ? 'next' : 'done'} invalid={Boolean(invalid)} describedBy={invalid ? errorId : undefined} onSubmit={fraction ? () => document.getElementById(`${errorId}-denominator`)?.querySelector('input')?.focus() : complete ? onSubmit : undefined} />
        {fraction && <><span className={styles.fractionLine} aria-hidden="true" /><div id={`${errorId}-denominator`}><NumericInput value={denominator} onChange={(value) => change(1, value)} label={text.numeric_denominator}
          integer invalid={Boolean(invalid)} describedBy={invalid ? errorId : undefined} onSubmit={complete ? onSubmit : undefined} /></div></>}
      </div>
      {fraction && <small className={styles.note}>{text.numeric_fraction_hint}</small>}
    </div>
    {invalid && <p id={errorId} role="alert" className={styles.numericError}>{error === 'too_long' ? text.numeric_too_long : error === 'zero' ? text.numeric_zero : fraction ? text.numeric_integer_error : text.numeric_error}</p>}
  </div>;
}
