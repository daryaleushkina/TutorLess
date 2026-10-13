import { BrandMark } from '../components/BrandMark';
// Оболочка экранов после входа.
//   • AppGate — пускает только вошедших: сайт без сессии уводит на вход; мини-апп, который не смог войти по
//     initData, показывает причину и «Повторить».
//   • TabsLayout — нижние вкладки на телефоне, боковая панель на широком сайте.
import { isApiError } from '@greprep/api-client';
import { Link, Navigate, Outlet, useMatch, useMatchRoute, useRouter, useRouterState } from '@tanstack/react-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ExamProvider, ExamSelection, ExamSwitch } from '../screens/exams/ExamSelection';
import { BRAND_NAME } from '../config';
import { returnToSearch } from '../auth/returnTo';
import { BackIcon, ExamIcon, ProgressIcon, TrainIcon, WordsIcon } from '../components/icons';
import { FullScreenStatus } from '../components/FullScreenStatus';
import { useOnline } from '../useOnline';
import { useI18n } from '../i18n/i18n';
import { useSession } from '../session/session';
import { useShell } from '../shellContext';
import { loadSections } from '../sections';
import { useTrainingSwipes } from '../telegram/hooks';
import { useStoredTraining } from '../training/hooks';
import styles from './AppLayout.module.css';
import { TabHistoryProvider, useTabHistory } from './TabsContext';
import { tabForPath } from './tabHistory';

export function AppGate(): ReactNode {
  const { session } = useSession();
  const { t } = useI18n();
  const { shell } = useShell();
  const online = useOnline();
  const href = useRouterState({ select: (state) => state.location.href });
  const returnTo = useRef(href);
  // Navigate меняет адрес раньше, чем уходит AppGate: не заменяем исходный экран адресом самого входа.
  if (session.status !== 'signedOut') returnTo.current = href;
  useEffect(() => {
    if (session.status !== 'signedIn') return;
    const preload = () => {
      if (navigator.onLine) {
        // Необязательный фон: при отказе переход покажет «Нет сети» с повтором; online попробует догрузить.
        void loadSections().catch(() => {});
      }
    };
    // Даём первому экрану кадр, прежде чем догружать вкладки.
    const frame = requestAnimationFrame(preload);
    window.addEventListener('online', preload);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('online', preload); };
  }, [session.status]);
  // Сверяем id маршрута: сопоставление одного пути приняло бы /training/new за id тренировки.
  const questionId = useMatch({ from: '/app/training/$trainingId', shouldThrow: false, select: (match) => match.params.trainingId });
  const report = useMatch({ from: '/app/training/$trainingId/report/$position', shouldThrow: false, select: () => true });
  const training = useStoredTraining(questionId ?? '', shell === 'telegram' && Boolean(questionId));
  // Один владелец свайпа переживает переход вопрос ↔ жалоба, включая загрузку ленивого маршрута.
  useTrainingSwipes(shell === 'telegram' && session.status === 'signedIn' &&
    (Boolean(report) || Boolean(questionId && (training.isPending || training.data && !training.data.finish))));
  if (session.status === 'signedOut') {
    return <Navigate to="/signin" search={{ ...(!session.signedOutByUser && returnToSearch(returnTo.current)), ...(session.expired && { reason: 'expired' }) }} replace />;
  }
  if (session.status === 'error') {
    const offline = isApiError(session.error) && session.error.kind === 'network';
    const tooMany = isApiError(session.error) && session.error.code === 'too_many_requests';
    return (
      <FullScreenStatus
        live
        title={offline ? t.home.offlineTitle : t.signIn.failedTitle}
        text={offline ? t.signIn.offline : tooMany ? t.signIn.tooMany : t.home.failedText}
        action={{ label: t.home.retry, onClick: session.retry }}
      />
    );
  }
  if (session.status === 'loading') return <FullScreenStatus live title={online ? t.tabs.train : t.home.offlineTitle} text={online ? t.home.loading : t.home.offlineText} />;
  return <ExamProvider><TabHistoryProvider key={`${session.user.id}:${session.user.activeExam}`}>{session.user.activeExam === null ? <ExamSelection /> : <Outlet />}</TabHistoryProvider></ExamProvider>;
}

const TABS = [
  { to: '/', key: 'train', Icon: TrainIcon },
  { to: '/words', key: 'words', Icon: WordsIcon },
  { to: '/exam', key: 'exam', Icon: ExamIcon },
  { to: '/progress', key: 'progress', Icon: ProgressIcon },
] as const;

export function TabsLayout(): ReactNode {
  const matchRoute = useMatchRoute();
  const nested = Boolean(matchRoute({ to: '/settings' }) || matchRoute({ to: '/words/$wordId' }));
  return <ShellFrame nested={nested}><Outlet /></ShellFrame>;
}

function ShellFrame({ children, nested = false, wide = false, training = false, footer }: { children: ReactNode; nested?: boolean; wide?: boolean; training?: boolean; footer?: ReactNode }) {
  const { shell } = useShell();
  return <div className={styles.frame} data-shell={shell} data-tabs data-nested={nested || undefined} data-wide={wide || undefined} data-training={training || undefined}>
    {shell === 'site' && <SiteNav />}
    <main className={`app-shell ${styles.main}`} id="main"><div className={styles.column}>
      {!nested && !training && <SectionHeader />}
      {children}
    </div></main>
    {footer}<TabBar />
  </div>;
}

function TabLink({ tab, className }: { tab: typeof TABS[number]; className: string | undefined }) {
  const { t } = useI18n();
  const history = useTabHistory();
  const router = useRouter();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { shell } = useShell();
  const localPath = shell === 'telegram' ? path.replace(/^\/tg(?=\/)/, '') : path;
  const active = localPath === '/settings' ? undefined : tabForPath(localPath) ?? history.active;
  return <Link to={tab.to} className={className} aria-current={active === tab.key ? 'page' : undefined}
    onClick={(e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      void router.navigate({ href: history.destination(tab.key) });
    }}>
    <tab.Icon /><span>{t.tabs[tab.key]}</span>
  </Link>;
}

function TabBar(): ReactNode {
  const { t } = useI18n();
  return <nav aria-label={t.tabs.sections} className={`tabbar ${styles.tabBar}`}>
    {TABS.map((tab) => <TabLink key={tab.key} tab={tab} className={styles.tab} />)}
  </nav>;
}

function ProfileLink({ compact = false }: { compact?: boolean }): ReactNode {
  const { t } = useI18n();
  const { session } = useSession();
  const name = session.status === 'signedIn' ? session.user.name : '';
  return <Link to="/settings" aria-label={compact ? t.navigation.profile : undefined} className={compact ? styles.topAvatar : styles.profile}
    activeProps={{ 'aria-current': 'page' }}>
    <span className={styles.avatar} aria-hidden="true">{Array.from(name.trim())[0]?.toLocaleUpperCase() ?? ''}</span>
    {!compact && <span className={styles.profileText}><b title={name}>{name}</b><small>{t.navigation.profile}</small></span>}
  </Link>;
}

function SectionHeader(): ReactNode {
  return <header className={styles.sectionHeader}><ExamSwitch /><ProfileLink compact /></header>;
}

function SiteNav(): ReactNode {
  const { t } = useI18n();
  return <aside className={styles.sideWrap}><nav aria-label={t.tabs.sections} className={styles.side}>
    <span className={styles.brand}><BrandMark />{BRAND_NAME}</span>
    <ExamSwitch />
    {TABS.map((tab) => <TabLink key={tab.key} tab={tab} className={styles.navItem} />)}
    <ProfileLink />
  </nav></aside>;
}

/**
 * Экран сессии без вкладок (шаг ленты): режим фокуса — без панели и капсулы, та же колонка
 * (DESIGN.md, «Navigation»: «сессии — режим фокуса без панели»).
 */
const FooterHost = createContext<HTMLElement | null>(null);

/** Форма владеет состоянием действия, а панель остаётся вне прокрутки общей оболочки. */
export function FocusFooter({ children, inlineOnWide = false }: { children: ReactNode; inlineOnWide?: boolean }): ReactNode {
  const host = useContext(FooterHost);
  const { shell } = useShell();
  // Граница layout.breakpoint-wide; CSS media и matchMedia не принимают var().
  const [wide, setWide] = useState(() => matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    if (!inlineOnWide || shell !== 'site') return;
    const media = matchMedia('(min-width: 900px)');
    const changed = () => setWide(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, [inlineOnWide, shell]);
  return inlineOnWide && shell === 'site' && wide ? children : host && createPortal(children, host);
}

export function FocusLayout({ children, footer, training = false, wide = false, session = false, tabs = false }: { children: ReactNode; footer?: ReactNode; training?: boolean; wide?: boolean; session?: boolean; tabs?: boolean }): ReactNode {
  const { shell } = useShell();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  if (tabs) return <FooterHost.Provider value={host}><ShellFrame training wide={wide} footer={<div className={styles.footerHost} ref={setHost} />}>{children}</ShellFrame></FooterHost.Provider>;
  return (
    <FooterHost.Provider value={host}><div className={styles.frame} data-shell={shell} data-nested data-training={training || undefined} data-wide={wide || undefined} data-session={session || undefined} data-footer={Boolean(footer) || undefined}>
      <main className={`app-shell ${styles.main}`} id="main">
        <div className={styles.column}>{children}</div>
      </main>
      {footer}
      <div className={styles.footerHost} ref={setHost} />
    </div></FooterHost.Provider>
  );
}

/**
 * «Назад» на сайте для вложенных экранов (в мини-аппе — кнопка «назад» Telegram). narrowOnly — только уже 600 px:
 * шире у того же экрана есть панель разделов.
 */
export function BackLink({ fallback, narrowOnly = false }: { fallback: '/' | '/progress'; narrowOnly?: boolean }): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Link
      to={fallback}
      className={narrowOnly ? `${styles.back} ${styles.narrowOnly}` : styles.back}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        // Пришли изнутри приложения — назад по истории (сохраняется прокрутка); открыли по ссылке — в раздел.
        if (router.history.canGoBack()) {
          e.preventDefault();
          router.history.back();
        }
      }}
    >
      <BackIcon />
      {t.back}
    </Link>
  );
}
