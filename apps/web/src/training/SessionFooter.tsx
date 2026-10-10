import type { ReactNode } from 'react';
import { useShell } from '../shellContext';
import styles from './Training.module.css';

/** На сайте панель — строка раскладки после main; её фон закрывает и нижний safe area. */
export function SessionFooter({ children }: { children: ReactNode }) {
  const { shell } = useShell();
  return <footer className={styles.sessionFooter} data-shell={shell}><div className={styles.footerContent}>{children}</div></footer>;
}
