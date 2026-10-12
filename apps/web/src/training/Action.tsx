import styles from './Training.module.css';
import { telegramRuntime } from '../telegram/runtime';

interface ActionProps { text: string; disabled: boolean; busy?: boolean; onClick: () => void }

/** Одна кнопка сайта и мини-аппа (решение Даши 12.10.2026); хаптика доступна только в Telegram. */
function TrainingButton({ kind, text, disabled, busy = false, onClick }: ActionProps & { kind: 'main' | 'secondary' }) {
  return <button type="button" className={kind === 'main' ? styles.action : styles.secondaryAction}
    disabled={disabled || busy} aria-busy={busy} aria-label={text} onClick={() => {
      telegramRuntime()?.hapticFeedback?.impactOccurred.ifAvailable('light');
      onClick();
    }}>
    {busy && <span className={styles.spinner} role="progressbar" aria-label={text} />}
    <span>{text}</span>
  </button>;
}

export function TrainingAction(props: ActionProps) { return <TrainingButton kind="main" {...props} />; }
export function TrainingSecondaryAction(props: ActionProps) { return <TrainingButton kind="secondary" {...props} />; }

export function TrainingActions({ primary, secondary }: { primary: ActionProps; secondary?: ActionProps }) {
  return <div className={styles.actions}>
    {secondary && <TrainingSecondaryAction {...secondary} />}
    <TrainingAction {...primary} />
  </div>;
}
