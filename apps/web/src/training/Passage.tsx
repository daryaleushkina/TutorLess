import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import type { Question } from '@greprep/api-client';
import { answerStateLabel } from './answerFormats';
import type { AnswerProps } from './QuestionContent';
import styles from './Training.module.css';

export function Passage({ question, selection = [], revealed = false, onSelect }: Pick<AnswerProps, 'question'> & Partial<AnswerProps>) {
  const { t, locale } = useI18n();
  const selectable = question.questionType === 'select_in_passage';
  return <div className={styles.passage} lang="en" data-selectable={selectable}>{question.passage?.paragraphs.map((paragraph, index) => <p key={index}>
    <span className={styles.paragraphNumber} lang={locale}>{t.training.passage_paragraph(index + 1)}</span>
    {paragraph.sentences.map((sentence, index) => {
      const checked = selection.includes(sentence.id);
      const correct = revealed && question.answer.includes(sentence.id);
      const wrong = revealed && checked && !correct;
      return selectable ? <span key={sentence.id}>{index > 0 && ' '}<button className={styles.sentence} type="button" disabled={revealed} aria-pressed={checked} aria-label={revealed ? `${sentence.text}, ${answerStateLabel(t.training, checked, correct)}` : undefined}
        data-result={correct ? checked ? 'correct' : 'missed' : wrong ? 'wrong' : undefined} onClick={() => onSelect?.(sentence.id)}>{sentence.text}
        {revealed && (correct || wrong) && <small lang={locale} className={styles.sentenceMark}>{correct ? t.training.sentence_correct_mark : t.training.sentence_yours_mark}</small>}
      </button></span> : <span key={sentence.id}>{index > 0 && ' '}{sentence.text}</span>;
    })}
  </p>)}</div>;
}

/** Панели остаются смонтированы: переключение и изменение ответа не сбрасывают место чтения. */
export function PassageQuestion({ question, first, children }: { question: Question; first: boolean; children: ReactNode }) {
  const { t } = useI18n();
  const [tab, setTab] = useState(first ? 'text' : 'question');
  const id = useId();
  const textPanel = useRef<HTMLDivElement>(null);
  const questionPanel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { setTab(first ? 'text' : 'question'); if (questionPanel.current) questionPanel.current.scrollTop = 0; }, [question.id, first]);
  const tabs = ['text', 'question'] as const;
  return <div className={styles.rc} data-tab={tab} data-passage-question>
    <div className={`${styles.segments} ${styles.rcTabs}`} role="tablist" aria-label={t.training.passage_tabs}>
      {tabs.map((value) => <button key={value} id={`${id}-${value}-tab`} role="tab" type="button" aria-selected={tab === value} aria-pressed={tab === value}
        aria-controls={`${id}-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
            event.preventDefault(); const next = event.key === 'Home' ? 'text' : event.key === 'End' ? 'question' : tab === 'text' ? 'question' : 'text';
            setTab(next); document.getElementById(`${id}-${next}-tab`)?.focus();
          }
        }}>{value === 'text' ? t.training.passage_text : t.training.passage_question}</button>)}
    </div>
    <div className={styles.rcColumns}>
      <div ref={textPanel} id={`${id}-text`} className={styles.rcText} role="tabpanel" aria-labelledby={`${id}-text-tab`} tabIndex={0} data-viewport-scroll><Passage question={question} /></div>
      <div ref={questionPanel} id={`${id}-question`} className={styles.rcQuestion} role="tabpanel" aria-labelledby={`${id}-question-tab`} tabIndex={0} data-viewport-scroll>{children}</div>
    </div>
  </div>;
}
