import { sectionLang } from './sectionLang';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { BackIcon, CheckIcon, ChevronRightIcon } from '../components/icons';
import { StatusScreen } from '../components/StatusScreen';
import { useI18n } from '../i18n/i18n';
import { TYPE_LABELS } from './builder';
import type { StoredTraining } from './model';
import { Cross, Explanation, Options, QuestionPrompt, SessionIcon, Verdict } from './QuestionContent';
import { ReadTraining, TrainingHeading } from './ReadTraining';
import { TrainingRules } from './rules';
import styles from './Training.module.css';
import { FocusFooter } from '../layout/AppLayout';
import { SessionFooter } from './SessionFooter';
import { TrainingActions } from './Action';
import { useRef } from 'react';
import { SessionHeader } from './SessionHeader';
import { useShell } from '../shellContext';

export function ReviewScreen() {
  const { trainingId } = useParams({ from: '/app/training/$trainingId/review' });
  const navigate = useNavigate();
  const { t } = useI18n();
  return <ReadTraining id={trainingId} finishedOnly back={<Link to="/training/$trainingId" params={{ trainingId }} className={styles.back}><BackIcon />{t.back}</Link>}
    onBack={() => void navigate({ to: '/training/$trainingId', params: { trainingId } })}>
    {(training) => <ReviewList training={training} />}
  </ReadTraining>;
}

function ReviewList({ training }: { training: StoredTraining }) {
  const { t, locale } = useI18n();
  const { filter = 'all', language: selectedLanguage } = useSearch({ from: '/app/training/$trainingId/review' });
  const navigate = useNavigate();
  const setFilter = (filter: 'all' | 'mistakes' | 'flagged') => void navigate({ to: '/training/$trainingId/review', params: { trainingId: training.session.id }, search: { filter, language: selectedLanguage }, replace: true });
  const text = t.training;
  const result = TrainingRules.result(training);
  const time = TrainingRules.summaryMinutes(result.durationSeconds, training.session.mode === 'check' ? training.session.timeLimitSeconds : undefined);
  const duration = t.home.minutes(time.minutes);
  const outcome = (position: number) => {
    const item = training.session.items[position]!;
    const chosen = training.answers[String(position)]?.optionIds ?? [];
    return chosen.length === 0 ? 'unanswered' : TrainingRules.isCorrect(item.question, chosen) ? 'correct' : 'wrong';
  };
  const mistakes = training.session.items.filter((item) => outcome(item.position) !== 'correct');
  const flagged = training.session.items.filter((item) => training.answers[String(item.position)]?.flagged);
  const shown = filter === 'mistakes' ? mistakes : filter === 'flagged' ? flagged : training.session.items;
  return <>
    <div className={styles.reviewHeading}><TrainingHeading>{training.session.mode === 'check' ? text.review_title_check : text.review_title_practice}</TrainingHeading><span>{text.summary_all_answers}</span></div>
    <section className={styles.miniSummary}>
      <p className={styles.note}><span lang={sectionLang(training.session.section)}>{t.sections[training.session.section]}</span> · {training.session.mode === 'check' ? text.mode_check : text.mode_practice} · {time.limitMinutes === undefined ? duration : text.summary_of_limit(duration, time.limitMinutes)}</p>
      <p className={styles.miniScore} aria-label={text.summary_correct_of(result.correct, result.total)}><strong>{result.correct}</strong><span>{text.summary_of(result.total)} {text.review_correct}</span></p>
    </section>
    <div className={`${styles.segments} ${styles.reviewFilters}`} role="group" aria-label={text.review_filter}>
      <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{text.review_all(result.total)}</button>
      <button aria-pressed={filter === 'mistakes'} onClick={() => setFilter('mistakes')}>{text.review_mistakes(mistakes.length)}</button>
      <button aria-pressed={filter === 'flagged'} onClick={() => setFilter('flagged')}>{text.review_flagged(flagged.length)}</button>
    </div>
    {shown.length === 0 ? <p>{filter === 'flagged' ? text.review_no_flagged : text.review_no_mistakes}</p> : <ul className={styles.reviewList}>{shown.map(({ position, question }) => {
      const state = outcome(position);
      const description = state === 'correct' ? text.review_correct : state === 'wrong' ? text.review_wrong : text.review_unanswered;
      return <li key={position}><Link to="/training/$trainingId/review/$position" params={{ trainingId: training.session.id, position }} search={{ filter, language: selectedLanguage }} className={styles.reviewRow} aria-label={`${text.review_question(position + 1)}, ${description}, ${TYPE_LABELS[question.questionType]}, ${question.topicTitle[locale]}`}>
        <span className={styles.reviewNumber}>{position + 1}</span>
        <span className={styles.grow}><span lang="en">{TYPE_LABELS[question.questionType]}</span><span className={styles.note}>{description}{training.answers[String(position)]?.flagged && ` · ${text.overview_flagged}`}</span></span>
        <span className={styles.reviewOutcome} data-outcome={state} aria-hidden="true">{state === 'correct' ? <CheckIcon /> : state === 'wrong' ? <Cross /> : <SessionIcon><path d="M7 12h10" /></SessionIcon>}</span>
        <span className={styles.reviewTime}>{formatTime(training.answers[String(position)]?.elapsedMs ?? 0)}</span><ChevronRightIcon />
      </Link></li>;
    })}</ul>}
  </>;
}

export function ReviewItemScreen() {
  const { trainingId, position } = useParams({ from: '/app/training/$trainingId/review/$position' });
  const { filter = 'all', language: selectedLanguage } = useSearch({ from: '/app/training/$trainingId/review/$position' });
  const navigate = useNavigate();
  const { t } = useI18n();
  return <ReadTraining id={trainingId} finishedOnly wide backInContent back={<Link to="/training/$trainingId/review" params={{ trainingId }} search={{ filter, language: selectedLanguage }} className={styles.back}><BackIcon />{t.back}</Link>}
    onBack={() => void navigate({ to: '/training/$trainingId/review', params: { trainingId }, search: { filter, language: selectedLanguage } })}>
    {(training) => <ReviewItem key={`${trainingId}/${position}`} training={training} position={position} />}
  </ReadTraining>;
}

function ReviewItem({ training, position }: { training: StoredTraining; position: number | null }) {
  const { t, locale } = useI18n();
  const { shell } = useShell();
  const navigate = useNavigate();
  const { filter = 'all', language: selectedLanguage } = useSearch({ from: '/app/training/$trainingId/review/$position' });
  const [language, setLanguage] = useState(selectedLanguage ?? locale);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = position;
  const item = index === null ? undefined : training.session.items[index];
  if (!item || index === null) return <>
    {shell === 'site' && <Link to="/training/$trainingId/review" params={{ trainingId: training.session.id }} search={{ filter, language: selectedLanguage }} className={styles.back}><BackIcon />{t.back}</Link>}
    <StatusScreen title={t.training.training_missing_title} text={t.training.training_missing_message} />
  </>;
  const chosen = training.answers[String(index)]?.optionIds ?? [];
  const filtered = training.session.items.filter((row) => filter === 'flagged' ? training.answers[String(row.position)]?.flagged : filter === 'mistakes' ? !TrainingRules.isCorrect(row.question, training.answers[String(row.position)]?.optionIds ?? []) : true);
  const at = filtered.findIndex((row) => row.position === index);
  const previous = filtered[at - 1]; const next = filtered[at + 1];
  const go = (position: number) => void navigate({ to: '/training/$trainingId/review/$position', params: { trainingId: training.session.id, position }, search: { filter, language } });
  const summary = () => void navigate({ to: '/training/$trainingId', params: { trainingId: training.session.id } });
  const elapsed = training.answers[String(index)]?.elapsedMs ?? 0;
  const average = Object.values(training.answers).reduce((sum, answer) => sum + answer.elapsedMs, 0) / Math.max(1, Object.keys(training.answers).length);
  return <>
    <SessionHeader section={training.session.section} label={t.training.explanation_title} position={index} total={training.session.items.length} onClose={() => void navigate({ to: '/training/$trainingId/review', params: { trainingId: training.session.id }, search: { filter, language } })} onPrevious={previous ? () => go(previous.position) : undefined} onNext={next ? () => go(next.position) : undefined} />
    <TrainingHeading className={styles.questionType}>{t.training.review_question(index + 1)}</TrainingHeading>
    <div className={`${styles.questionLayout} ${styles.reviewQuestionLayout}`}
      onTouchStart={(event) => { const point = event.touches[0]; if (point) touch.current = { x: point.clientX, y: point.clientY }; }}
      onTouchEnd={(event) => { const point = event.changedTouches[0]; const start = touch.current; touch.current = null; if (!start || !point || Math.abs(point.clientY - start.y) > SWIPE_DISTANCE) return; const delta = point.clientX - start.x; if (delta < -SWIPE_DISTANCE && next) go(next.position); if (delta > SWIPE_DISTANCE && previous) go(previous.position); }}>
      <section className={styles.question} data-revealed="true" aria-label={t.training.review_question(index + 1)}>
        <Verdict question={item.question} chosen={chosen} dontKnow={training.answers[String(index)]?.dontKnow} language={language} />
        {training.session.mode === 'check' && <p className={styles.note}>{t.training.review_time}: {formatTime(elapsed)}{elapsed > average && ` — ${t.training.review_slow}`}</p>}
        <QuestionPrompt question={item.question} selection={item.question.answer} revealed />
        <Options question={item.question} selection={chosen} revealed compact onSelect={() => {}} />
      </section>
      <Explanation question={item.question} chosen={chosen} language={language} onLanguage={(language) => { setLanguage(language); void navigate({ to: '/training/$trainingId/review/$position', params: { trainingId: training.session.id, position: index }, search: { filter, language }, replace: true }); }} />
    </div>
    <Link to="/training/$trainingId/report/$position" params={{ trainingId: training.session.id, position }} search={{ returnTo: 'review', language, filter }} className={styles.reportLink}>{t.training.question_report}</Link>
    <FocusFooter><SessionFooter><TrainingActions secondary={next ? { text: t.training.to_summary, disabled: false, onClick: summary } : undefined} primary={{ text: next ? t.training.review_next : t.training.to_summary, disabled: false, onClick: next ? () => go(next.position) : summary }} /></SessionFooter></FocusFooter>
  </>;
}

const SWIPE_DISTANCE = 60;
function formatTime(milliseconds: number) { const seconds = Math.floor(milliseconds / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
