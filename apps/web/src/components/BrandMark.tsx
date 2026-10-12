import styles from './BrandMark.module.css';

/** Геометрия знака из каталога B; палитра и размер остаются в токенах. */
export function BrandMark() {
  return <svg className={styles.mark} viewBox="0 0 24 24" overflow="visible" aria-hidden="true" focusable="false">
    <g transform="rotate(-12 12 12)">
      <rect x="7" y="2" width="16" height="16" rx="5" fill="var(--color-exam-gre)" />
      <rect x="1" y="6" width="18" height="18" rx="6" fill="var(--color-accent)" />
    </g>
  </svg>;
}
