import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBackButton } from '../telegram/hooks';
import { useShell } from '../shellContext';
import { useI18n } from '../i18n/i18n';
import { Cross } from './QuestionContent';
import styles from './Training.module.css';

/** Нативный dialog удерживает фокус и закрывает фон для клавиатуры и диктора. */
export function TrainingSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { shell } = useShell();
  const { t } = useI18n();
  useBackButton(shell === 'telegram' ? onClose : null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return createPortal(<dialog ref={dialog} className={styles.sheetDialog} aria-label={title}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.sheetBody}>
      <div className={styles.sheetHeading}><h2>{title}</h2><button className={styles.iconButton} aria-label={t.back} onClick={onClose}><Cross /></button></div>
      {children}
    </div>
  </dialog>, document.body);
}
