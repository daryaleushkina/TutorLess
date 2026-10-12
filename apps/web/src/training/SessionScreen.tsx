import { sectionLang } from './sectionLang';
import type { TrainingRequest } from '@greprep/api-client';
import { isApiError } from '@greprep/api-client';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BackIcon, OfflineIcon, ChevronRightIcon } from '../components/icons';
import { StatusScreen } from '../components/StatusScreen';
import { useI18n } from '../i18n/i18n';
import { FocusLayout } from '../layout/AppLayout';
import { useShell } from '../shellContext';
import { TrainingStorageBlocked } from './ReadTraining';
import { useBackButton } from '../telegram/hooks';
import { useOnline } from '../useOnline';
import { TrainingActions } from './Action';
import { TYPE_LABELS } from './builder';
import { useStoredTraining, useTrainingStorage } from './hooks';
import type { StoredTraining } from './model';
import { trainingRepository } from './repository';
import { TrainingRules } from './rules';
import styles from './Training.module.css';
import { useTrainingSession } from './useTrainingSession';
import { BLANKS, QuestionPrompt, Options, Explanation, SessionIcon, Cross, Verdict, answerFormat } from './QuestionContent';
import { SessionFooter } from './SessionFooter';
import { TrainingSheet } from './TrainingSheet';
import { TrainingFeedback } from './TrainingFeedback';
import { SessionHeader } from './SessionHeader';

export function SessionScreen() {
  const { trainingId } = useParams({ from: '/app/training/$trainingId' });
  const { t } = useI18n();
  const { shell } = useShell();
  const navigate = useNavigate();
  const training = useStoredTraining(trainingId);
  const storage = useTrainingStorage();
  const ready = storage !== 'blocked' && storage !== 'unavailable' && !training.isPending && Boolean(training.data);
  useBackButton(shell === 'telegram' && !ready ? () => void navigate({ to: '/' }) : null);
  if (storage !== 'blocked' && storage !== 'unavailable' && !training.isPending && training.data) {
    return <ActiveSession key={trainingId} incoming={training.data} />;
  }
  return <FocusLayout training wide session>
    <div className={styles.screen}>
      {shell === 'site' && <Link to="/" className={styles.back}>{t.training.question_close}</Link>}
      {storage === 'blocked' ? <TrainingStorageBlocked /> : storage === 'unavailable' ? <StatusScreen title={t.training.training_storage_title} text={t.training.training_storage_message} /> : training.isPending ? <p role="status">{t.home.loading}</p> :
        <StatusScreen title={t.training.training_missing_title} text={t.training.training_missing_message} />}
    </div>
  </FocusLayout>;
}

function ActiveSession({ incoming }: { incoming: StoredTraining }) {
  const s = useTrainingSession(incoming);
  const online = useOnline();
  const { t, locale } = useI18n();
  const { language: chosenLanguage } = useSearch({ from: '/app/training/$trainingId' });
  const [language, setLanguage] = useState(chosenLanguage ?? locale);
  const { shell } = useShell();
  const text = t.training;
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState<'exit' | 'finish'>();
  const [pastExplanation, setPastExplanation] = useState(false);
  useEffect(() => { setPastExplanation(false); }, [s.position]);
  const close = () => { if (s.checkMode && !s.training.finish) setConfirmation('exit'); else void navigate({ to: '/' }); };
  useBackButton(shell === 'telegram' && !s.overview && !confirmation ? close : null);
  const total = s.training.session.items.length;
  const last = s.position === total - 1;
  const primary = s.browsingPast ? text.overview_back(s.returnPosition + 1) : s.overview ? text.overview_finish : s.checkMode ? last ? text.question_to_list : s.selection.length ? text.question_next(s.position + 2, total) : text.question_skip : s.revealed ? last ? text.question_result : text.question_next(s.position + 2, total) : text.question_check;
  const unanswered = s.training.session.items.filter((item) => !TrainingRules.isComplete(item.question, s.training.answers[String(item.position)]?.optionIds ?? [])).length;
  const act = () => { if (s.overview && unanswered) setConfirmation('finish'); else s.primary(); };
  const secondary = s.overview ? { text: text.overview_back(s.position + 1), onClick: () => s.setOverview(false) } : s.checkMode && s.position > 0 ? { text: text.previous_question, icon: <BackIcon />, onClick: s.previous } : s.checkMode ? undefined : !s.revealed ? { text: text.question_dont_know, onClick: s.dontKnow } : undefined;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [s.position, s.overview, s.training.finish]);
  const keyboard = useRef(s);
  useLayoutEffect(() => { keyboard.current = s; });
  useEffect(() => {
    if (shell !== 'site') return;
    const key = (event: KeyboardEvent) => {
      const s = keyboard.current;
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || s.training.finish || s.overview || document.querySelector('dialog[open]')) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], a')) return;
      // Enter всегда соответствует подсказке; пробел сохраняет нативный выбор сфокусированного варианта.
      if (/^[a-f]$/i.test(event.key) && !s.revealed) {
        event.preventDefault(); s.selectKey(event.key);
      } else if (event.key === 'Enter') { event.preventDefault(); s.primary(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); s.next(); }
      else if (event.key === 'ArrowLeft' && (s.checkMode || s.position > 0)) { event.preventDefault(); s.previous(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [shell]);
  if (s.training.finish) {
    if (s.training.finish.timedOut && !s.training.timeoutSeen) return <FocusLayout training session footer={<SessionFooter><TrainingActions primary={{ text: text.to_summary, disabled: s.busy, onClick: s.acknowledgeTimeout }} /></SessionFooter>}>
      <div className={styles.timeout}><SessionIcon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></SessionIcon><h1 className={styles.title}>{text.timeout_title}</h1><p>{text.timeout_text(total - unanswered, total)}</p>{s.failed && <p role="alert">{text.training_storage_message}</p>}</div>
    </FocusLayout>;
    return <Summary training={s.training} />;
  }
  const missing = TrainingRules.missingGroups(s.question, s.selection);
  const note = s.overview ? undefined : s.checkMode ? text.question_check_note : s.selection.length && missing.length ? s.question.groups.length > 1 ? (missing.length === 1 ? text.question_missing_blank : text.question_missing_blanks)(missing.map((i) => BLANKS[i]).join(', ')) : s.question.selectCount > 1 ? text.question_pick_one_more : undefined : undefined;
  const typeNote = s.question.groups.length === 3 ? text.type_three_blanks : s.question.groups.length === 2 ? text.type_two_blanks : s.question.selectCount === 2 ? text.type_two_answers : undefined;
  // Неполный ответ ещё требует возврата к вопросу: отметка «отвечен» — только когда заполнены все пропуски, итог считает частичный ответ неверным.
  const overviewItems = s.training.session.items.map(({ position, question }) => ({ position,
    answered: TrainingRules.isComplete(question, s.training.answers[String(position)]?.optionIds ?? []),
  }));
  const answered = overviewItems.filter((item) => item.answered).length;
  const flags = Object.values(s.training.answers).filter((answer) => answer.flagged).length;
  return <FocusLayout training wide session footer={
    <SessionFooter>
      {s.failed && <p role="alert" className={styles.note}>{text.training_storage_message}</p>}
      {note && <p role="status" className={styles.note}>{note}</p>}

      {!s.overview && <TrainingActions secondary={secondary && { ...secondary, disabled: s.busy }} primary={{ text: primary, disabled: s.busy || (!s.checkMode && !s.revealed && !s.complete), busy: s.busy, onClick: act }} />}

    </SessionFooter>
  }>
    <div className={`${styles.session} ${styles.screen}`} data-shell={shell} data-section={s.training.session.section}>
      <SessionHeader section={s.training.session.section} label={s.checkMode ? text.mode_check : TYPE_LABELS[s.question.questionType]} position={s.position} total={total} remaining={s.remaining} busy={s.busy} onClose={close} onPrevious={!s.checkMode && s.position > 0 ? s.previous : undefined} />
      <TrainingFeedback />
      {!online && <p className={styles.offlineNotice} role="status"><OfflineIcon />{text.question_offline}</p>}
      {s.overview && !confirmation && <TrainingSheet title={text.question_overview} onClose={() => s.setOverview(false)}><section className={styles.overview}>
        {s.remaining !== undefined && <span role="timer" className={styles.timer} data-low={s.remaining <= 60} aria-label={text.timer_description(Math.floor(s.remaining / 60), s.remaining % 60, s.position + 1, total)}>{Math.floor(s.remaining / 60)}:{String(s.remaining % 60).padStart(2, '0')}</span>}
        <p className={styles.note}>{text.overview_summary(answered, total, flags)}</p>
        <div className={styles.questionGrid}>{overviewItems.map(({ position, answered }) => {
          const answer = s.training.answers[String(position)];
          const state = [answered ? text.overview_answered : text.overview_empty, answer?.flagged ? text.overview_flagged : undefined].filter(Boolean).join(', ');
          return <button key={position} className={styles.overviewCell} disabled={s.busy} data-answered={answered} aria-current={position === s.position ? 'step' : undefined} aria-label={text.overview_item(position + 1, state)} onClick={() => s.go(position)}>{position + 1}{answer?.flagged && <Flag filled />}</button>;
        })}</div>
        <TrainingActions primary={{ text: text.overview_finish, disabled: s.busy, onClick: act }} />
      </section></TrainingSheet>}
      <div className={styles.questionLayout}>
        <section className={styles.question} data-revealed={s.revealed}>
          {s.browsingPast && <p className={styles.pastNotice}>{text.previous_notice(s.position + 1, s.returnPosition + 1)}</p>}
          {s.checkMode && <div className={styles.questionTools}><button className={styles.secondaryAction} aria-haspopup="dialog" onClick={() => s.setOverview(true)}><Grid />{text.question_overview}</button><button className={styles.secondaryAction} disabled={s.busy} aria-label={s.flagged ? text.question_unflag : text.question_flag} aria-pressed={s.flagged} onClick={s.flag}><Flag filled={s.flagged} />{text.question_return}</button></div>}
          {s.revealed && <Verdict question={s.question} chosen={s.answer?.optionIds ?? []} dontKnow={s.answer?.dontKnow} language={language} />}
          <h1 ref={heading} tabIndex={-1} className={styles.questionType}>{TYPE_LABELS[s.question.questionType]}{typeNote && ` · ${typeNote}`}</h1>
          {!s.revealed && <p className={styles.note} role={s.selectionLimit ? 'status' : undefined}>{answerFormat(s.question)?.instruction(s.question, text)}</p>}
          <QuestionPrompt question={s.question} selection={s.revealed ? s.question.answer : s.selection} revealed={s.revealed} />
          <Options question={s.question} selection={s.selection} revealed={s.revealed} compact={s.browsingPast} onSelect={s.select} />
        </section>
        {s.browsingPast && !pastExplanation && <button className={styles.textButton} onClick={() => setPastExplanation(true)}>{text.show_explanation}</button>}
        {s.revealed && (!s.browsingPast || pastExplanation) && <Explanation question={s.question} chosen={s.answer?.optionIds ?? []} language={language} onLanguage={(language) => { setLanguage(language); void navigate({ to: '/training/$trainingId', params: { trainingId: s.training.session.id }, search: { language }, replace: true }); }} />}
      </div>
      <Link to="/training/$trainingId/report/$position" params={{ trainingId: s.training.session.id, position: s.position }} search={{ returnTo: 'session', language }} className={styles.reportLink}><Flag />{text.question_report}</Link>
      {confirmation && <TrainingSheet title={confirmation === 'finish' ? text.finish_confirm(unanswered) : s.checkMode ? text.exit_check : text.exit_practice} onClose={() => setConfirmation(undefined)}>
        {confirmation === 'exit' && <p>{text.exit_save}</p>}
        <TrainingActions secondary={{ text: text.continue_check, disabled: s.busy, onClick: () => setConfirmation(undefined) }} primary={{ text: confirmation === 'finish' ? text.overview_finish : text.exit_action, disabled: s.busy, onClick: () => { if (confirmation === 'finish') s.primary(); else void navigate({ to: '/' }); setConfirmation(undefined); } }} />
      </TrainingSheet>}
    </div>
  </FocusLayout>;
}

function Summary({ training }: { training: StoredTraining }) {
  const { t, locale } = useI18n();
  const { shell } = useShell();
  const navigate = useNavigate();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const starting = useRef(false);
  const result = TrainingRules.result(training);
  const text = t.training;
  const count = TrainingRules.repeatCount(result.review.reduce((sum, topic) => sum + topic.mistakes, 0));
  const time = TrainingRules.summaryMinutes(result.durationSeconds, training.session.mode === 'check' ? training.session.timeLimitSeconds : undefined);
  const duration = t.home.minutes(time.minutes).replaceAll(' ', '\u00a0');
  const section = <span lang={sectionLang(training.session.section)}>{t.sections[training.session.section]}</span>;
  const line = time.limitMinutes === undefined
    ? <>{section}{' · '}{[...training.session.questionTypes.map((type) => TYPE_LABELS[type]), duration].join(' · ')}</>
    : <>{text.mode_check}{' · '}{section}{' · '}{text.summary_of_limit(duration, time.limitMinutes)}</>;
  const close = () => void navigate({ to: '/' });
  const repeat = async () => {
    if (starting.current || !online) return;
    starting.current = true; setBusy(true); setProblem(undefined);
    const request: TrainingRequest = { exam: training.session.exam ?? 'gre', section: training.session.section, questionTypes: training.session.questionTypes, count, mode: 'practice', topicIds: result.review.map((topic) => topic.topicId) };
    try {
      const trainingId = await trainingRepository.start(request);
      await navigate({ to: '/training/$trainingId', params: { trainingId } });
    } catch (error) { setProblem(isApiError(error) && error.kind === 'network' ? text.builder_start_offline : isApiError(error) && error.code === 'no_questions' ? text.builder_no_questions : text.builder_start_failed); }
    finally { starting.current = false; setBusy(false); }
  };
  return <FocusLayout training session footer={
    <SessionFooter>
      {(problem || !online && result.review.length > 0) && <p role="status" className={styles.note}>{problem ?? text.builder_start_offline}</p>}
      <div className={styles.summaryActions}><TrainingActions secondary={result.review.length > 0 ? { text: text.summary_done, disabled: busy, onClick: close } : undefined} primary={{ text: result.review.length ? text.summary_repeat(text.questionsCount(count)) : text.summary_done, disabled: busy || Boolean(result.review.length && !online), busy, onClick: result.review.length ? () => void repeat() : close }} /></div>
    </SessionFooter>
  }>
    <div className={`${styles.screen} ${styles.session} ${styles.summary}`} data-shell={shell} data-section={training.session.section}>
      {shell === 'site' && <Link to="/" className={styles.close} aria-label={text.summary_done}><BackIcon /></Link>}
      <section className={styles.summaryCard}>
        <p className={styles.note}>{line}</p>
        <h1 className={styles.score} aria-label={text.summary_correct_of(result.correct, result.total)}><span>{result.correct}</span><small><span>{text.summary_of(result.total)}</span><span>{text.review_correct}</span></small></h1>
        <ol className={styles.marks} aria-label={text.summary_all_answers}>{training.session.items.map((item) => {
          const correct = TrainingRules.isCorrect(item.question, training.answers[String(item.position)]?.optionIds ?? []);
          return <li key={item.position} data-correct={correct}><span className="visually-hidden">{text.review_question(item.position + 1)}: {correct ? text.review_correct : text.review_wrong}</span>{correct ? <SessionIcon><path d="m5 12 4 4 10-10" /></SessionIcon> : <Cross />}</li>;
        })}</ol>
      </section>
      <Link to="/training/$trainingId/review" params={{ trainingId: training.session.id }} className={styles.allAnswers}><Grid /><span>{text.summary_all_answers}</span><ChevronRightIcon /></Link>
      {training.finish?.timedOut && <p className={styles.note}>{text.summary_timed_out}</p>}
      {training.finish?.timedOut && result.unanswered > 0 && <p>{text.summary_ran_out(text.questionsCount(result.unanswered))}</p>}
      {result.review.length ? <section className={styles.reviewTopics}>
        <h2>{text.summary_review}</h2>
        {result.review.map((topic) => {
          const numbers = topic.positions.map((position) => String(position + 1));
          const list = numbers.length === 1 ? numbers[0]! : `${numbers.slice(0, -1).join(', ')} ${text.summary_and} ${numbers.at(-1)}`;
          return <div key={topic.topicId} className={styles.reviewTopic}><i aria-hidden="true" /><div><h3>{topic.title[locale]}</h3><p className={styles.note}>{text.summary_mistakes(topic.mistakes)} · {(numbers.length === 1 ? text.summary_question : text.summary_questions)(list)}</p></div></div>;
        })}
      </section> : !result.unanswered && <p>{text.summary_perfect}</p>}
    </div>
  </FocusLayout>;
}

function Flag({ filled = false }: { filled?: boolean }) { return <SessionIcon><path d="M5 21V3m0 1c5-3 9 3 14 0v10c-5 3-9-3-14 0" fill={filled ? 'currentColor' : 'none'} /></SessionIcon>; }
function Grid() { return <SessionIcon>{[4, 14].flatMap((x) => [4, 14].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" rx="1" />))}</SessionIcon>; }
