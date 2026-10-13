import type { GivenAnswer, Question } from '@greprep/api-client';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { CheckIcon } from '../components/icons';
import { dictionaries } from '../i18n/dict';
import { useI18n } from '../i18n/i18n';
import type { Locale } from '../i18n/locale';
import { answerFormat, answerStateLabel } from './answerFormats';
import styles from './Training.module.css';
import { NumericAnswer } from './NumericAnswer';
import { Passage } from './Passage';

export const BLANKS = ['(i)', '(ii)', '(iii)'];

export function QuestionPrompt({ question: q, selection, revealed = false }: { question: Question; selection: string[]; revealed?: boolean }) {
  const { t } = useI18n();
  if (q.questionType === 'quantitative_comparison') return <div className={styles.quantities}>
    {q.condition && <p lang="en" className={styles.prompt}><MathText text={q.condition} /></p>}
    <div className={styles.quantityRow}>{[['Quantity A', q.quantityA], ['Quantity B', q.quantityB]].map(([label, value]) => <div key={label} className={styles.quantity}><span lang="en" className={styles.note}>{label}</span><strong lang="en"><MathText text={value ?? ''} /></strong></div>)}</div>
  </div>;
  return <p lang="en" className={styles.prompt}>{q.prompt.split('___').map((part, index) => {
    if (index === 0) return <span key={index}>{part}</span>;
    const chosen = q.groups[index - 1]?.options.filter((option) => selection.includes(option.id)) ?? [];
    const punctuation = part.match(/^[,.;:!?…%)\]}»”’]+/)?.[0] ?? '';
    // WebKit иначе ставит запятую в начале новой строки. Длинный ответ переносится внутри blank.
    return <span key={index}><span className={styles.blankWithPunctuation}>
      <span className={styles.blank} data-result={revealed ? chosen.every((option) => q.answer.includes(option.id)) ? 'correct' : 'wrong' : undefined} role="img" aria-label={`${t.training.question_blank} ${BLANKS[index - 1] ?? ''}${chosen.length ? ': ' + chosen.map((option) => option.text).join(', ') : ''}`}>
        {chosen.map((option) => option.text).join(' / ') || '　　'}{q.groups.length > 1 && <small>{BLANKS[index - 1]}</small>}
      </span>{punctuation}
    </span>{part.slice(punctuation.length)}</span>;
  })}</p>;
}

export interface AnswerProps { question: Question; selection: string[]; revealed: boolean; onSelect: (id: string) => void; onChange?: (value: string[]) => void; onSubmit?: () => void; compact?: boolean }

export { answerFormat, draftAnswer } from './answerFormats';
const ANSWER_COMPONENTS = { choice: ChoiceAnswer, numeric: NumericAnswer, passage: Passage };

export function Options(props: AnswerProps) {
  const component = answerFormat(props.question)?.component;
  const Answer = component && ANSWER_COMPONENTS[component];
  return Answer ? <Answer {...props} /> : null;
}

function ChoiceAnswer({ question: q, selection, revealed, onSelect, compact = false }: AnswerProps) {
  const { t, locale } = useI18n();
  const [all, setAll] = useState(false);
  const many = q.groups.length > 1;
  const multiple = q.questionType === 'multiple_choice_multi' || q.selectCount > 1;
  if (revealed && q.questionType === 'text_completion' && !all) return <div className={styles.answerTable}>
    {q.groups.map((group, index) => {
      const yours = group.options.filter((o) => selection.includes(o.id));
      const correct = group.options.filter((o) => q.answer.includes(o.id));
      const right = yours.length > 0 && yours.every((o) => q.answer.includes(o.id));
      return <div key={index} className={styles.answerRow}>
        {many && <p className={styles.note}>{t.training.question_blank} {BLANKS[index]}</p>}
        {yours.length > 0 && <div><span>{t.training.answer_yours}</span><span className={styles.answerPill} data-result={right ? 'correct' : 'wrong'}>{right ? <CheckIcon /> : <Cross />}<span lang="en">{yours.map((o) => o.text).join(' / ')}</span></span></div>}
        {!right && <div><span>{t.training.answer_correct}</span><span className={styles.answerPill} data-result="correct"><CheckIcon /><span lang="en">{correct.map((o) => o.text).join(' / ')}</span></span></div>}
      </div>;
    })}
    {compact && <button className={styles.textButton} onClick={() => setAll(true)}>{t.training.all_options}</button>}
  </div>;
  return <div className={styles.options}>{q.groups.map((group, index) => <div key={index} className={styles.optionGroup}
    role={revealed ? undefined : q.selectCount === 1 ? 'radiogroup' : 'group'} aria-label={many ? `${t.training.question_blank} ${BLANKS[index]}` : t.training.builder_type}>
    {many && <p className={styles.note}>{t.training.question_blank} {BLANKS[index]}</p>}
    <div className={styles.options}>
      {group.options.filter((option) => !revealed || !compact || all || selection.includes(option.id) || q.answer.includes(option.id)).map((option) => {
        const checked = selection.includes(option.id);
        const correct = revealed && q.answer.includes(option.id);
        const wrong = revealed && checked && !correct;
        const content = <><span className={styles.choiceIndicator} data-many={q.selectCount !== 1} aria-hidden="true">{q.selectCount !== 1 && <CheckIcon />}</span><span lang="en" className={styles.optionText}>{option.text}</span>{revealed && multiple && <span lang={locale} className="visually-hidden">{answerStateLabel(t.training, checked, correct)}</span>}{revealed && (correct || wrong) && <span lang={locale} aria-hidden={multiple || undefined} className={styles.optionMark}>{correct ? t.training.question_correct_mark : t.training.question_yours_mark}</span>}</>;
        return <button key={option.id} className={styles.option} type="button" role={q.selectCount === 1 ? 'radio' : 'checkbox'}
          disabled={revealed} aria-checked={checked} data-result={correct ? checked ? 'correct' : 'missed' : wrong ? 'wrong' : undefined}
          onClick={() => onSelect(option.id)}>{content}</button>;
      })}
    </div>
  </div>)}{revealed && compact && <button className={styles.textButton} onClick={() => setAll(!all)}>{all ? t.training.hide_options : t.training.all_options}</button>}</div>;
}

export function Verdict({ question, answer, language }: { question: Question; answer?: GivenAnswer; language?: Locale }) {
  const { t } = useI18n();
  const text = language ? dictionaries[language].training : t.training;
  const correct = answerFormat(question)?.isCorrect(question, answer) ?? false;
  const dontKnow = answer?.dontKnow ?? false;
  const hasValue = answer && answerFormat(question)?.decode(answer).some(Boolean);
  return <div className={styles.verdict} data-correct={correct} data-dont-know={dontKnow} role="status">
    <span className={styles.verdictDot} data-correct={correct} data-dont-know={dontKnow} aria-hidden="true">{dontKnow ? <SessionIcon><path d="M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4zM12 6v15" /></SessionIcon> : correct ? <CheckIcon /> : <Cross />}</span>
    <div><strong>{dontKnow ? text.verdict_dont_know : hasValue ? correct ? text.verdict_correct : text.verdict_wrong : t.training.review_unanswered}</strong>{dontKnow && <p className={styles.note}>{t.training.dont_know_note}</p>}</div>
  </div>;
}

function RichText({ text }: { text: string }) {
  return <>{text.split(/(\*[^*]+\*)/).map((part, index) => part.startsWith('*') && part.endsWith('*') ? <mark key={index}>{part.slice(1, -1)}</mark> : <span key={index}>{part}</span>)}</>;
}

export function Explanation({ question: q, chosen, language, onLanguage }: { question: Question; chosen: string[]; language: Locale; onLanguage: (language: Locale) => void }) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const whyNotId = useId();
  useEffect(() => { setOpen(false); }, [q.id]);
  const text = dictionaries[language].training;
  const wrong = q.explanation.options.filter((item) => chosen.includes(item.optionId) && !q.answer.includes(item.optionId));
  const options = q.groups.flatMap((group) => group.options);
  const wrongLabel = options.filter((option) => wrong.some((item) => item.optionId === option.id)).map((option) => option.text).join(', ');
  return <section lang={language} className={styles.explanation} data-testid="explanation">
    <div className={styles.explanationBody}>
      <div className={styles.explainHeading}><h2>{text.explanation_title}</h2><div className={styles.segments} role="group" aria-label={dictionaries[locale].training.explanation_language}>{(['ru', 'en'] as const).map((lang) => <button key={lang} type="button" aria-pressed={language === lang} onClick={() => onLanguage(lang)}>{lang.toUpperCase()}</button>)}</div></div>
      <p className={styles.solution}><RichText text={q.explanation.solution[language]} /></p>
      <div className={styles.explanationTools}>
        {wrong.length > 0 && <button className={styles.whyNot} aria-expanded={open} aria-controls={whyNotId} onClick={() => setOpen(!open)}>{text.why_not(wrongLabel)}</button>}

      </div>
      {open && <div id={whyNotId} className={styles.whyNotBody}>{wrong.map((item) => <p key={item.optionId} data-testid="explanation-option"><RichText text={item.text[language]} /></p>)}</div>}
    </div>
  </section>;
}

export function SessionIcon({ children }: { children: ReactNode }) { return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>; }
export function Cross() { return <SessionIcon><path d="m8 8 8 8m0-8-8 8" /></SessionIcon>; }

function MathText({ text }: { text: string }) {
  return <>{text.split(/(\b[A-Za-z]\b)/).map((part, index) => /^[A-Za-z]$/.test(part) ? <i key={index}>{part}</i> : <span key={index}>{part}</span>)}</>;
}
