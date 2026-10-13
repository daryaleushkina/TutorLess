import { useI18n } from '../../i18n/i18n';
import styles from '../screens.module.css';
export function ProgressScreen() {
  const { t } = useI18n();
  return <section className={styles.screen}><h1 className={styles.title}>{t.tabs.progress}</h1><p className={styles.lead}>{t.progress.emptyText}</p></section>;
}
