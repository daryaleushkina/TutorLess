import { isApiError, getHome, useGetExams, type TrainingRequest } from '@greprep/api-client';
import { TRAINING_HEADERS } from '../../training/capabilities';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ChevronRightIcon, OfflineIcon, SlidersIcon, AlertIcon, RepeatIcon, TargetIcon, ResumeIcon } from '../../components/icons';
import { useI18n } from '../../i18n/i18n';
import { useAccount } from '../../session/session';
import { useOnline } from '../../useOnline';
import { TYPE_LABELS, minutes } from '../../training/builder';
import { useActiveExam } from '../../training/exam';
import { useTrainingStorage } from '../../training/hooks';
import { SUPPORTED_TYPES, trainingRepository } from '../../training/repository';
import { homeActive, homeSections, homeStart, SECTION_DESCRIPTIONS } from './home';
import styles from './Home.module.css';

export function HomeScreen() {
  const { t, locale } = useI18n();
  const account = useAccount();
  const exam = useActiveExam();
  const navigate = useNavigate();
  const online = useOnline();
  const storage = useTrainingStorage();
  const owner = account.id;
  const options = useQuery({ queryKey: ['training-options', owner, exam], queryFn: ({ signal }) => trainingRepository.options(exam, signal), staleTime: 0 });
  const home = useQuery({ queryKey: ['home', owner, exam], queryFn: ({ signal }) => getHome({ exam, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, types: SUPPORTED_TYPES }, { signal, headers: TRAINING_HEADERS }), staleTime: 0 });
  const exams = useGetExams();
  const stored = useQuery({ queryKey: ['training', owner, 'active', exam], queryFn: async () => homeActive(await trainingRepository.list(), Date.now(), exam) ?? null, enabled: storage === 'ready', networkMode: 'always' });
  const active = storage === 'ready' ? stored.data : null;
  const offline = !online || options.fetchStatus === 'paused' || home.fetchStatus === 'paused' || [options.error ?? options.failureReason, home.error ?? home.failureReason, exams.error ?? exams.failureReason].some((error) => isApiError(error) && error.kind === 'network');
  const unavailable = options.isError || home.isError || exams.isError;
  const [problem, setProblem] = useState<'offline' | 'failed' | 'noQuestions' | null>(null);
  const [busy, setBusy] = useState(false);
  const starting = useRef(false);
  useEffect(() => { if (online) setProblem((previous) => previous === 'offline' ? null : previous); }, [online]);
  const data = options.data && home.data && exams.data ? { options: options.data, home: home.data, exam: exams.data.exams.find((entry) => entry.id === exam) } : undefined;
  const start = data ? homeStart(data.options, exam, data.home.lastTraining) : undefined;
  const availableTypes = data ? homeSections(data.options) : [];
  const stats = data?.home;
  const extras = Boolean(stats && (stats.mistakes > 0 || stats.weakSpot || stats.week.answers > 0));
  const begin = async (request: TrainingRequest) => {
    if (starting.current || storage !== 'ready') return;
    if (offline) { setProblem('offline'); return; }
    starting.current = true; setBusy(true); setProblem(null);
    try {
      const candidates = request.source === 'mistakes' ? [...new Set(availableTypes.map((type) => type.section))].map((section) => ({
        ...request, section, questionTypes: availableTypes.filter((type) => type.section === section).map((type) => type.questionType),
      })) : [request];
      // /home считает ошибки всего экзамена, а запуск принимает один раздел. Пустой раздел пропускаем:
      // математические ошибки не должны зависеть от наличия ошибок Verbal.
      const tryStart = async (index: number): Promise<string> => {
        try { return await trainingRepository.start(candidates[index]!); }
        catch (error) {
          if (isApiError(error) && error.code === 'no_questions' && index + 1 < candidates.length) return tryStart(index + 1);
          throw error;
        }
      };
      const trainingId = await tryStart(0);
      await navigate({ to: '/training/$trainingId', params: { trainingId } });
    } catch (error) {
      setProblem(isApiError(error) && error.kind === 'network' ? 'offline' : isApiError(error) && error.code === 'no_questions' ? 'noQuestions' : 'failed');
    } finally { starting.current = false; setBusy(false); }
  };
  const startProblem = problem && <p role="alert" className={styles.notice}>{problem === 'offline' ? <OfflineIcon /> : <AlertIcon />}{problem === 'offline' ? t.home.needNetwork : problem === 'noQuestions' ? t.training.builder_no_questions : t.training.builder_start_failed}</p>;
  const mistakes = stats && availableTypes.length ? { exam, source: 'mistakes' as const, section: availableTypes[0]!.section, questionTypes: availableTypes.filter((type) => type.section === availableTypes[0]!.section).map((type) => type.questionType), count: Math.min(stats.mistakes, options.data!.maxQuestions), mode: 'practice' as const } : undefined;
  return <section className={styles.screen} aria-busy={!data && !offline && !unavailable || busy}>
    <h1 className={styles.title}>{t.tabs.train}</h1>
    {data && (offline || unavailable) && <p role="status" className={styles.notice}>{offline ? <OfflineIcon /> : <AlertIcon />}{offline ? t.home.staleOffline : t.home.staleFailed}</p>}
    {data ? <div className={styles.grid} data-extras={extras || undefined}><div className={styles.primaryColumn}>
      {active && <Link to="/training/$trainingId" params={{ trainingId: active.session.id }} className={styles.row}><span className={styles.rowIcon}><ResumeIcon /></span><span className={styles.rowBody}><b>{t.training.training_continue}</b><small>{t.training.question_progress_description(active.position + 1, active.session.items.length).replaceAll(' ', '\u00a0')} · {active.session.questionTypes.map((type) => TYPE_LABELS[type]).join(' · ')}</small></span><ChevronRightIcon /></Link>}
      {start ? <article className={styles.startCard} data-section={start.request.section}>
        <h2 className={styles.startTitle} lang="en">{start.request.questionTypes.map((type) => TYPE_LABELS[type]).join(' · ')}</h2>
        <p className={styles.meta}><span className={styles.dot} aria-hidden="true" /><span>{t.sections[start.request.section]} · {t.training.questionsCount(start.request.count)} · {start.previous && `${start.request.mode === 'practice' ? t.training.mode_practice : t.training.mode_check} · `}{t.home.approxShort(minutes(data.options, start.request))}</span></p>
        <p className={styles.note}>{start.previous ? t.training.builder_preset_last : t.home.firstNote}</p>
        <div className={styles.actions}><button type="button" className={styles.startButton} disabled={busy || storage !== 'ready'} onClick={() => void begin(start.request)}>{busy ? t.home.starting : t.home.start}</button>
          <Link to="/training/new" search={start.previous ? {} : { section: start.request.section, type: start.request.questionTypes[0] }} aria-label={t.home.configure} className={styles.configure}><SlidersIcon /></Link></div>
        {startProblem}
      </article> : <p className={styles.lead}>{exam === 'toefl' ? t.home.toeflEmpty : t.home.empty}</p>}
      {!start && startProblem}
      {(storage === 'unavailable' || storage === 'blocked') && <p role="alert" className={styles.notice}>{t.training.training_storage_message}</p>}
      <h2 className={styles.subtitle}>{t.home.chooseSection}</h2><ul className={styles.list}>
        {data.exam?.sections.map((section) => {
          const types = availableTypes.filter((type) => type.section === section);
          const available = types.length > 0;
          const stat = stats?.sections.find((entry) => entry.section === section);
          const body = <><span className={styles.dot} aria-hidden="true" /><span className={styles.rowBody}><b lang={section === 'essay' && locale === 'ru' ? 'ru' : 'en'}>{t.sections[section]}</b><small>{available && exam === 'toefl' ? types.map((type) => TYPE_LABELS[type.questionType]).join(' · ') : SECTION_DESCRIPTIONS[section][locale]}</small></span>{stat && stat.total > 0 && <span className={styles.stat}><b>{Math.round(stat.correct / stat.total * 100)} %</b><small>{t.home.correct}</small></span>}{available && <ChevronRightIcon />}</>;
          return <li key={section} data-section={section}>{available ? <Link to="/training/new" search={{ section }} className={styles.row}>{body}</Link> : <div className={`${styles.row} ${styles.disabled}`} aria-disabled="true">{body}</div>}</li>;
        })}
      </ul>
    </div>{stats && extras && <aside className={styles.sideColumn}>
      {(stats.mistakes > 0 || stats.weakSpot) && <ul className={styles.list}>
        {stats.mistakes > 0 && mistakes && <li><button type="button" className={styles.row} disabled={busy || storage !== 'ready'} onClick={() => void begin(mistakes)}><span className={styles.rowIcon}><RepeatIcon /></span><span className={styles.rowBody}><b>{t.home.mistakes}</b><small>{t.home.mistakeCount(stats.mistakes)}</small></span><ChevronRightIcon /></button></li>}
        {stats.weakSpot && <li><Link className={styles.row} to="/training/new" search={{ section: stats.weakSpot.section, type: stats.weakSpot.questionType }}><span className={styles.rowIcon}><TargetIcon /></span><span className={styles.rowBody}><b>{t.home.weakSpot}: {TYPE_LABELS[stats.weakSpot.questionType]}</b><small>{t.sections[stats.weakSpot.section]} · {Math.round(stats.weakSpot.accuracy)} % {t.home.correct}</small></span><ChevronRightIcon /></Link></li>}
      </ul>}
      {stats.week.answers > 0 && <section className={styles.week}><p>{t.home.week}</p><b>{t.home.days(stats.week.days)} · {t.home.duration(stats.week.minutes)}</b><small>{t.home.answers(stats.week.answers)}</small></section>}
    </aside>}</div> : offline || unavailable ? <div className={styles.state} role="status"><span className={styles.stateIcon}>{offline ? <OfflineIcon /> : <AlertIcon />}</span><h2>{offline ? t.home.offlineTitle : t.home.failedTitle}</h2><p>{offline ? t.home.offlineText : t.home.failedText}</p><button className={styles.retry} type="button" onClick={() => { void options.refetch(); void home.refetch(); void exams.refetch(); }}>{t.home.retry}</button></div> : <HomeSkeleton sections={exams.data?.exams.find((entry) => entry.id === exam)?.sections.length ?? (exam === 'toefl' ? 4 : 3)} />}
  </section>;
}

function HomeSkeleton({ sections }: { sections: number }) {
  const { t } = useI18n();
  return <><p role="status" className="visually-hidden">{t.home.loading}</p><div className={styles.grid}><div className={styles.primaryColumn}><article className={`${styles.startCard} ${styles.skeletonCard}`} aria-hidden="true"><span className={`${styles.sk} ${styles.skTitle}`} /><span className={`${styles.sk} ${styles.skMeta}`} /><div className={styles.skNote}><p className={styles.note}>{t.home.firstNote}</p><span className={`${styles.sk} ${styles.skMeta}`} /><span className={`${styles.sk} ${styles.skMeta}`} /></div><div className={styles.actions}><span className={`${styles.sk} ${styles.skButton}`} /><span className={`${styles.sk} ${styles.skSquare}`} /></div></article><h2 className={styles.subtitle}>{t.home.chooseSection}</h2><ul className={styles.list} aria-hidden="true">{Array.from({ length: sections }, (_, index) => index).map((index) => <li key={index} className={styles.row}><span className={`${styles.sk} ${styles.skDot}`} /><span className={styles.rowBody}><span className={`${styles.sk} ${styles.skName}`} /><span className={`${styles.sk} ${styles.skMeta}`} /></span></li>)}</ul></div></div></>;
}
