import { BrandMark } from '../../components/BrandMark';
import { isApiError, setActiveExam, useGetExams, type Exam, type ExamInfo } from '@greprep/api-client';
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@tanstack/react-router';
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, OfflineIcon, AlertIcon } from '../../components/icons';
import { BRAND_NAME } from '../../config';
import { useI18n } from '../../i18n/i18n';
import { useActiveExam } from '../../training/exam';
import { useAccount, useSession } from '../../session/session';
import { useShell } from '../../shellContext';
import { useBackButton } from '../../telegram/hooks';
import { useOnline } from '../../useOnline';
import shellStyles from '../../layout/AppLayout.module.css';
import styles from './ExamSelection.module.css';

const ExamsContext = createContext<{ open: (anchor: HTMLElement) => void } | null>(null);

export function ExamProvider({ children }: { children: ReactNode }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return <ExamsContext value={{ open: setAnchor }}>{children}{anchor && <ExamSelection anchor={anchor} close={() => setAnchor(null)} />}</ExamsContext>;
}

export function ExamSwitch() {
  const context = use(ExamsContext);
  const { t } = useI18n();
  const exam = useActiveExam();
  return <button type="button" className={shellStyles.examSwitch} aria-haspopup="dialog" aria-label={t.navigation.examSwitch(exam.toUpperCase())}
    onClick={(event) => context?.open(event.currentTarget)}><span className={shellStyles.examChip} data-exam={exam} aria-hidden="true" />{exam.toUpperCase()}<ChevronDownIcon /></button>;
}

export function ExamSelection({ anchor, close }: { anchor?: HTMLElement; close?: () => void }) {
  const { t } = useI18n();
  const { signedIn } = useSession();
  const account = useAccount();
  const { shell, launch } = useShell();
  const router = useRouter();
  const exams = useGetExams();
  const online = useOnline();
  const [busy, setBusy] = useState<Exam | null>(null);
  const saving = useRef(false);
  const [problem, setProblem] = useState<'offline' | 'failed' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const wide = shell === 'site' && matchMedia('(min-width: 900px)').matches;
  const selected = account.activeExam;
  const choose = useCallback(async (exam: Exam) => {
    if (saving.current) return;
    if (exam === selected) { close?.(); return; }
    if (!online) { setProblem('offline'); return; }
    saving.current = true; setBusy(exam); setProblem(null);
    try {
      const user = await setActiveExam({ exam });
      await signedIn(user);
      close?.();
      // Форма другого экзамена не остаётся активной после смены.
      if (anchor) await router.navigate({ to: '/', replace: true });
    } catch (error) {
      setProblem(isApiError(error) && error.kind === 'network' ? 'offline' : 'failed');
    } finally { saving.current = false; setBusy(null); }
  }, [selected, close, online, signedIn, router, anchor]);
  useBackButton(anchor && shell === 'telegram' ? () => close?.() : null);
  useEffect(() => {
    if (!anchor || !dialog.current) return;
    const el = dialog.current;
    if (wide) el.show(); else el.showModal();
    el.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (wide && event.target instanceof Node && !el.contains(event.target) && !anchor.contains(event.target)) close?.();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close?.(); };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); el.close(); anchor.focus(); };
  }, [anchor, close, wide]);
  // Метка ссылки выбирается через тот же серверный путь; неизвестная метка не принимается.
  const startParam = launch?.startParam ?? new URLSearchParams(router.state.location.searchStr).get('exam');
  useEffect(() => {
    if (!anchor && selected === null && (startParam === 'gre' || startParam === 'toefl') && exams.data?.exams.some((exam) => exam.id === startParam)) void choose(startParam);
  }, [anchor, selected, startParam, exams.data, choose]);
  const failed = problem ?? (exams.isError ? isApiError(exams.error) && exams.error.kind === 'network' ? 'offline' : 'failed' : null);
  const content = <>
    <div className={styles.head}><h1 className={anchor ? styles.sheetTitle : styles.title}>{anchor ? t.navigation.exam : t.exams.title}</h1>
    {!anchor && <p className={styles.lead}>{t.exams.lead}</p>}</div>
    {exams.data ? <div className={styles.list} role={anchor ? 'group' : undefined} aria-label={t.navigation.exam} data-picker={!anchor || undefined}>
      {exams.data.exams.map((exam) => <ExamCard key={exam.id} exam={exam} picker={!anchor} selected={exam.id === selected} busy={busy === exam.id} disabled={busy !== null} choose={() => void choose(exam.id)} />)}
    </div> : <p role="status">{t.home.loading}</p>}
    {failed && <p role="alert" className={styles.notice}>{failed === 'offline' ? <OfflineIcon /> : <AlertIcon />}<span>{failed === 'offline' ? t.exams.offline : anchor ? t.exams.changeFailed : t.exams.chooseFailed}</span>{exams.isError && <button onClick={() => void exams.refetch()}>{t.home.retry}</button>}</p>}
    {anchor && <p className={styles.note}>{t.exams.note}</p>}
  </>;
  const touchStart = useRef<number | null>(null);
  if (anchor) return createPortal(<dialog ref={dialog} className={styles.dialog} data-wide={wide || undefined} aria-label={t.navigation.exam} onCancel={(event) => { event.preventDefault(); close?.(); }} onClick={(event) => { if (event.target === event.currentTarget) close?.(); }}>
    <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
      {!wide && <div className={styles.grabberArea} data-grabber onPointerDown={(event) => { touchStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={(event) => { if (touchStart.current !== null && event.clientY - touchStart.current > event.currentTarget.clientHeight) close?.(); touchStart.current = null; }}><span className={styles.grabber} /></div>}
      {content}
    </div>
  </dialog>, document.body);
  return <main className={`app-shell ${styles.page}`}><span className={styles.brand}><BrandMark />{BRAND_NAME}</span><section className={styles.choose}>{content}</section></main>;
}

function ExamCard({ exam, picker, selected, busy, disabled, choose }: { exam: ExamInfo; picker: boolean; selected: boolean; busy: boolean; disabled: boolean; choose: () => void }) {
  const { t } = useI18n();
  return <button className={styles.row} type="button" aria-pressed={picker ? undefined : selected} aria-busy={busy} disabled={disabled} onClick={choose}>
    <span className={styles.tile} data-exam={exam.id}>{exam.id.toUpperCase()}</span><span className={styles.body}><b>{t.exams[exam.id]}</b><small>{exam.sections.map((section) => t.sections[section]).join(' · ')}</small></span>
    {busy ? <span className={styles.spinner} aria-hidden="true" /> : picker ? <ChevronRightIcon /> : selected ? <CheckIcon /> : null}
  </button>;
}
