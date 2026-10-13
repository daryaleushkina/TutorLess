// Слово с дефисом не рвётся на строки («по-» в конце строки читается плохо). Сохраняем исходный дефис:
// замена на U+2011 может потребовать запасной шрифт и изменить ширину слова.
import { Fragment, type ReactNode } from 'react';
import styles from './KeepHyphenated.module.css';

export function KeepHyphenated({ text }: { text: string }): ReactNode {
  return text.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className={styles.nowrap}>
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
