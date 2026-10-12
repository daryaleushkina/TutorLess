import { useEffect, useRef, type ReactNode } from 'react';
import { StatusScreen } from '../components/StatusScreen';
import { useI18n } from '../i18n/i18n';
import { FocusLayout } from '../layout/AppLayout';
import { useShell } from '../shellContext';
import { useBackButton } from '../telegram/hooks';
import { useStoredTraining, useTrainingStorage } from './hooks';
import { trainingRepository } from './repository';
import type { StoredTraining } from './model';
import styles from './Training.module.css';
import { TrainingFeedback } from './TrainingFeedback';

/** Глубокая ссылка не обходит состояние сессии: разбор доступен только после её окончания. */
export function ReadTraining({ id, finishedOnly = false, wide = false, backButton = true, backInContent = false, back, onBack, children }: {
  id: string; finishedOnly?: boolean; wide?: boolean; backButton?: boolean | 'fallback'; backInContent?: boolean; back: ReactNode; onBack: () => void; children: (training: StoredTraining) => ReactNode;
}) {
  const { t } = useI18n();
  const { shell } = useShell();
  const training = useStoredTraining(id);
  const storage = useTrainingStorage();
  const ready = storage === 'ready' && !training.isPending && Boolean(training.data && (!finishedOnly || training.data.finish));
  useBackButton(shell === 'telegram' && (backButton === true || backButton === 'fallback' && !ready) ? onBack : null);
  return <FocusLayout training wide={wide} session>
    <div className={`${styles.screen} ${styles.readTraining}`} data-shell={shell} data-wide={wide} data-section={training.data?.session.section}>
      {shell === 'site' && (!backInContent || !ready) && back}
      <TrainingFeedback />
      {storage === 'blocked' ? <TrainingStorageBlocked /> : storage === 'unavailable' ? <StatusScreen title={t.training.training_storage_title} text={t.training.training_storage_message} /> :
        training.isPending ? <p role="status">{t.home.loading}</p> : !training.data || finishedOnly && !training.data.finish ?
          <StatusScreen title={t.training.training_missing_title} text={t.training.training_missing_message} /> : children(training.data)}
    </div>
  </FocusLayout>;
}

export function TrainingHeading({ children, className = styles.title }: { children: ReactNode; className?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { document.querySelector('main')?.scrollTo({ top: 0 }); heading.current?.focus({ preventScroll: true }); }, []);
  return <h1 ref={heading} tabIndex={-1} className={className}>{children}</h1>;
}


export function TrainingStorageBlocked({ heading = 'h1' }: { heading?: 'h1' | 'h2' }) {
  const { t } = useI18n();
  return <StatusScreen live heading={heading} title={t.training.training_updating_title} text={t.training.training_updating_message}
    action={{ label: t.training.training_retry, onClick: trainingRepository.retryStorage }} />;
}
