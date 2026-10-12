import { isApiError, schemas, type TrainingOptions } from '@greprep/api-client';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { BackIcon, ChevronRightIcon } from '../components/icons';
import { StatusScreen } from '../components/StatusScreen';
import { useI18n } from '../i18n/i18n';
import { FocusFooter, FocusLayout } from '../layout/AppLayout';
import { useTabDraft } from '../layout/TabsContext';
import { useActiveExam } from './exam';
import { useShell } from '../shellContext';
import { useSession } from '../session/session';
import { useBackButton } from '../telegram/hooks';
import { useOnline } from '../useOnline';
import { TrainingStorageBlocked } from './ReadTraining';
import { TrainingAction } from './Action';
import { SessionFooter } from './SessionFooter';
import { TrainingSheet } from './TrainingSheet';
import { CheckIcon } from '../components/icons';
import { TYPE_LABELS, available, defaultForm, initialBuilder, minutes, requestOf, toggleTopic, topicsOf, updateOptions, type BuilderForm } from './builder';
import { useTrainingStorage } from './hooks';
import { trainingRepository } from './repository';
import styles from './Training.module.css';

export function BuilderScreen() {
  const { session } = useSession();
  const exam = useActiveExam();
  const online = useOnline();
  const options = useQuery({ queryKey: ['training-options', session.status === 'signedIn' ? session.user.id : null, exam],
    queryFn: ({ signal }) => trainingRepository.options(exam, signal), enabled: session.status === 'signedIn',
    // Последняя сборка меняется после старта: новый вход получает свежий каталог, редактирование его не перезагружает.
    staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false, refetchOnReconnect: false });
  const offline = !online || options.fetchStatus === 'paused' || (isApiError(options.error) && options.error.kind === 'network');
  if (options.data && options.isFetchedAfterMount) return <ReadyBuilder key={session.status === 'signedIn' ? session.user.id : 'signedOut'} options={options.data} />;
  return <BuilderStatus offline={offline} unavailable={options.isError} retry={() => void options.refetch()} />;
}

/** Отдельный владелец BackButton: загрузка и готовый конструктор никогда не подписаны одновременно. */
function BuilderStatus({ offline, unavailable, retry }: { offline: boolean; unavailable: boolean; retry: () => void }) {
  const { t } = useI18n();
  const { shell } = useShell();
  const navigate = useNavigate();
  useBackButton(shell === 'telegram' ? () => void navigate({ to: '/' }) : null);
  return <FocusLayout tabs><div className={styles.screen}>
    {shell === 'site' && <Link to="/" className={styles.back}><BackIcon />{t.back}</Link>}
    <h1 className={styles.title}>{t.training.training_new}</h1>
    {unavailable || offline ? <StatusScreen heading="h2" live title={offline ? t.training.training_offline_title : t.training.training_failed_title}
      text={offline ? t.training.training_offline_message : t.training.training_failed_message}
      action={{ label: t.training.training_retry, onClick: retry }} /> : <p role="status">{t.training.training_loading}</p>}
  </div></FocusLayout>;
}

function ReadyBuilder({ options }: { options: TrainingOptions }) {
  const { t, locale } = useI18n();
  const text = t.training;
  const { shell } = useShell();
  const navigate = useNavigate();
  const search = useSearch({ from: '/app/training/new' });
  const [savedState, setState, discardForm] = useTabDraft('builder-form', () => initialBuilder(options, search.section, search.type));
  const state = updateOptions(savedState, options);
  if (state !== savedState) setState(state);
  const [topics, setTopics, discardTopics] = useTabDraft('builder-topics', () => false);
  const exam = useActiveExam();
  const [busy, setBusy] = useState(false);
  const starting = useRef(false);
  const [problem, setProblem] = useState<'offline' | 'failed' | 'noQuestions' | null>(null);
  const online = useOnline();
  const storage = useTrainingStorage();
  const { form } = state;
  const [typesOpen, setTypesOpen] = useState(false);
  const multipleTypes = form.mode === 'check' && form.mixed;
  const selectedTopics = topicsOf(state);
  const request = requestOf(state, exam);
  const totalAvailable = available(state);
  const displayRequest = request && { ...request, count: Math.min(request.count, totalAvailable) };
  const countLabel = text.questionsCount(displayRequest?.count ?? totalAvailable);
  const edit = (change: (form: BuilderForm) => BuilderForm) => {
    setState((previous) => ({ ...previous, form: change(previous.form), preset: undefined }));
    setProblem(null);
  };
  const back = () => { if (topics) { setTopics(false); return; } discardForm(); discardTopics(); void navigate({ to: '/' }); };
  useBackButton(shell === 'telegram' && !typesOpen ? back : null);

  const start = async () => {
    // Два нажатия могут прийти до следующего рендера: состояние ещё не выключило кнопку.
    if (starting.current || !request || storage !== 'ready') return;
    if (!online) { setProblem('offline'); return; }
    starting.current = true;
    setBusy(true); setProblem(null);
    try {
      const trainingId = await trainingRepository.start(request);
      discardForm(); discardTopics();
      await navigate({ to: '/training/$trainingId', params: { trainingId } });
    } catch (error) {
      setProblem(isApiError(error) && error.kind === 'network' ? 'offline' : isApiError(error) && error.code === 'no_questions' ? 'noQuestions' : 'failed');
    } finally { starting.current = false; setBusy(false); }
  };

  const topicCount = form.topicIds?.length ?? selectedTopics.length;
  return <FocusLayout tabs={!topics} training><div className={styles.screen} data-shell={shell} data-builder>
    {shell === 'site' && <button type="button" className={styles.back} onClick={back}><BackIcon />{t.back}</button>}
    <h1 className={styles.title}>{topics ? text.builder_topics : text.training_new}</h1>
    {topics ? <>
      <p className={styles.note}><span lang="en">{t.sections[form.section]} · {TYPE_LABELS[form.type]}</span> · {text.topics_available(totalAvailable, totalAvailable < Number(form.countText))}</p>
      <div className={styles.listHeading}><h2>{text.topics_title}</h2><button className={styles.textButton} onClick={() => edit((f) => ({ ...f, topicIds: topicCount ? [] : undefined }))}>{topicCount ? text.topics_clear : text.topics_select}</button></div>
      <div className={`${styles.group} ${styles.solid}`}>
        {selectedTopics.map((topic) => <button className={styles.row} key={topic.id} role="checkbox" aria-checked={form.topicIds === undefined || form.topicIds.includes(topic.id)}
          onClick={() => edit(() => toggleTopic(state, topic.id))}>
          <span className={styles.choiceIndicator} data-many aria-hidden="true"><CheckIcon /></span><span className={styles.grow}>{topic.title[locale]}</span>
          <span className={styles.note}>{form.difficulty ? topic.available[form.difficulty] : topic.available.easy + topic.available.medium + topic.available.hard}</span>
        </button>)}
      </div>
      <fieldset className={styles.difficulty}><legend>{text.topics_difficulty}</legend><div className={styles.segments}>
        <button type="button" aria-pressed={form.difficulty === undefined} onClick={() => edit((f) => ({ ...f, difficulty: undefined }))}>{text.difficulty_any}</button>
        {schemas.Difficulty.options.map((difficulty) => <button type="button" key={difficulty} aria-pressed={form.difficulty === difficulty} onClick={() => edit((f) => ({ ...f, difficulty }))}>{text[`difficulty_${difficulty}`]}</button>)}
      </div></fieldset>
      {!topicCount && <p role="status" className={styles.note}>{text.topics_empty}</p>}
      <FocusFooter><SessionFooter><TrainingAction text={text.topics_done_count(topicCount, selectedTopics.length)} disabled={topicCount === 0 || totalAvailable === 0} onClick={() => setTopics(false)} /></SessionFooter></FocusFooter>
    </> : <>
      <div className={styles.builder}><div className={`${styles.group} ${styles.solid}`}>
        <div className={styles.row}><span>{text.builder_section}</span><div role="group" aria-label={text.builder_section} className={styles.segments}>
          {[...new Set(options.types.map((type) => type.section))].map((section) => <button type="button" key={section} aria-pressed={form.section === section} disabled={busy}
            onClick={() => edit((f) => f.section === section ? f : { ...defaultForm(options, section), countText: f.countText, mode: f.mode })}>{t.sections[section]}</button>)}
        </div></div>
        <button className={`${styles.row} ${styles.typeRow}`} aria-haspopup="dialog" disabled={busy} onClick={() => setTypesOpen(true)}><span>{text.builder_type}</span><span className={styles.value}><span lang={multipleTypes ? locale : 'en'}>{multipleTypes ? text.types_mixed : TYPE_LABELS[form.type]}</span><ChevronRightIcon /></span></button>
        {form.mode === 'practice' && <div className={styles.row}><span>{text.builder_count}</span><div className={styles.segments} role="group" aria-label={text.builder_count}>
          {QUESTION_COUNTS.map((count) => <button key={count} disabled={busy} aria-pressed={form.countText === String(count)} onClick={() => edit((f) => ({ ...f, countText: String(count) }))}>{count}</button>)}
        </div></div>}
        <div className={styles.modeRow}><div className={styles.row}><span>{text.builder_mode}</span><div role="group" aria-label={text.builder_mode} className={styles.segments}>
          {schemas.TrainingMode.options.map((mode) => <button type="button" key={mode} disabled={busy} aria-pressed={form.mode === mode} onClick={() => edit((f) => ({ ...f, mode, mixed: mode === 'check' ? f.mixed : false }))}>{text[`mode_${mode}`]}</button>)}
        </div></div><p className={styles.note}>{form.mode === 'check' && request ? text.check_hint(countLabel, minutes(options, displayRequest!)) : text.mode_practice_hint}</p></div>
        <button type="button" className={styles.row} disabled={busy || selectedTopics.length === 0 || multipleTypes} onClick={() => setTopics(true)}><span>{text.builder_topics}</span><span className={styles.value}><span className={styles.note}>{form.topicIds === undefined ? text.builder_topics_all : text.builder_topics_some(topicCount, selectedTopics.length)} · {form.difficulty ? text[`difficulty_${form.difficulty}`].toLocaleLowerCase(locale) : text.difficulty_any.toLocaleLowerCase(locale)}</span><ChevronRightIcon /></span></button>
      </div></div>
      {(!online || problem) && <p role="alert" className={styles.note}>{!online || problem === 'offline' ? text.builder_start_offline : problem === 'noQuestions' ? text.builder_no_questions : text.builder_start_failed}</p>}
      {storage === 'blocked' && <TrainingStorageBlocked heading="h2" />}
      {storage === 'unavailable' && <p role="alert" className={styles.note}>{text.training_storage_title}</p>}
      {!request && <p role="status" className={styles.note}>{text.builder_nothing}</p>}
      <FocusFooter inlineOnWide><SessionFooter><TrainingAction text={busy ? text.builder_starting : request ? text.builder_start(countLabel, minutes(options, displayRequest!)) : text.builder_nothing} disabled={!request || !online || storage !== 'ready'} busy={busy} onClick={() => void start()} /></SessionFooter></FocusFooter>
    </>}
    {typesOpen && <TrainingSheet title={text.builder_type} onClose={() => setTypesOpen(false)}><div role="radiogroup" aria-label={text.builder_type} className={styles.options}>
      {options.types.filter((type) => type.section === form.section).map((type) => <button key={type.questionType} role="radio" aria-checked={!multipleTypes && form.type === type.questionType} className={styles.option} disabled={type.topics.length === 0} onClick={() => { edit((f) => ({ ...f, type: type.questionType, topicIds: undefined, mixed: false })); setTypesOpen(false); }}><span className={styles.choiceIndicator} aria-hidden="true" /><span lang="en">{TYPE_LABELS[type.questionType]}</span></button>)}
      {form.mode === 'check' && <button role="radio" className={styles.option} aria-checked={Boolean(multipleTypes)} onClick={() => { edit((f) => ({ ...f, mixed: true, topicIds: undefined, difficulty: undefined })); setTypesOpen(false); }}><span className={styles.choiceIndicator} aria-hidden="true" />{text.types_mixed}</button>}
    </div></TrainingSheet>}
  </div></FocusLayout>;
}

const QUESTION_COUNTS = [5, 10, 15, 20];
