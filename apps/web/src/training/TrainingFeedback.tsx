import { useEffect, useSyncExternalStore } from 'react';
import { useI18n } from '../i18n/i18n';
import styles from './Training.module.css';

const NOTICE_MILLIS = 3000;
let expiresAt = 0;
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
export function reportSavedFeedback() { expiresAt = Date.now() + NOTICE_MILLIS; notify(); }
export function clearReportFeedback() { expiresAt = 0; notify(); }

/** Подтверждение переживает переход из шторки на вопрос и не хранит текст жалобы. */
export function TrainingFeedback() {
  const until = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => expiresAt);
  const { t } = useI18n();
  useEffect(() => {
    if (!until) return;
    const timer = window.setTimeout(() => { expiresAt = 0; notify(); }, Math.max(0, until - Date.now()));
    return () => clearTimeout(timer);
  }, [until]);
  return until > Date.now() ? <p role="status" className={styles.feedback}>{t.training.report_toast}</p> : null;
}
