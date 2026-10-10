import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useShell } from '../shellContext';
import styles from './Training.module.css';

/** Область прокрутки сайта заканчивается над действиями даже при переносе подсказок и появлении «Назад». */
export function SessionFooter({ children }: { children: ReactNode }) {
  const { shell } = useShell();
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const footer = ref.current;
    const main = footer?.closest<HTMLElement>('main.app-shell');
    const frame = main?.parentElement;
    if (shell !== 'site' || !footer || !main || !frame) return;
    const update = () => {
      const inset = Math.max(0, frame.getBoundingClientRect().bottom - footer.getBoundingClientRect().top);
      main.style.setProperty('--session-footer-inset', `${inset}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(footer);
    observer.observe(frame);
    return () => {
      observer.disconnect();
      main.style.removeProperty('--session-footer-inset');
    };
  }, [shell]);
  return <footer ref={ref} className={styles.sessionFooter}>{children}</footer>;
}
