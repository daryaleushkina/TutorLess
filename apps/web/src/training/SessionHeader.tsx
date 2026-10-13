import type { TrainingSession } from '@greprep/api-client';
import { BackIcon, ChevronRightIcon } from '../components/icons';
import { useI18n } from '../i18n/i18n';
import { useShell } from '../shellContext';
import { Cross } from './QuestionContent';
import { sectionLang } from './sectionLang';
import styles from './Training.module.css';

export function SessionHeader({ section, label, position, total, remaining, busy = false, onClose, onPrevious, onNext }: {
  section: TrainingSession['section']; label: string; position: number; total: number; remaining?: number; busy?: boolean;
  onClose: () => void; onPrevious?: () => void; onNext?: () => void;
}) {
  const { t } = useI18n();
  const { shell } = useShell();
  const text = t.training;
  return <header className={styles.sessionHeader}>
    {shell === 'site' && <button className={styles.close} aria-label={text.question_close} onClick={onClose}><Cross /></button>}
    <span className={styles.sessionLabel}><i aria-hidden="true" /><span lang={sectionLang(section)}>{t.sections[section]}</span> · {label}</span>
    <div className={styles.progress} aria-label={text.question_progress_description(position + 1, total)}>{text.question_of(position + 1, total)}</div>
    {remaining !== undefined && <span role="timer" className={styles.timer} data-low={remaining <= 60} aria-label={text.timer_description(Math.floor(remaining / 60), remaining % 60, position + 1, total)}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
    {onPrevious && <button className={styles.iconButton} aria-label={text.previous_question} disabled={busy} onClick={onPrevious}><BackIcon /></button>}
    {onNext && <button className={styles.iconButton} aria-label={text.next_question} disabled={busy} onClick={onNext}><ChevronRightIcon /></button>}
    <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${(position + 1) / total * 100}%` }} /></div>
    {remaining !== undefined && <span className="visually-hidden" role="status">{text.timer_description(Math.ceil(remaining / 60), 0, position + 1, total)}</span>}
  </header>;
}
