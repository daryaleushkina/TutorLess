// Раздел, которого в каркасе ещё нет (Слова, Экзамен): честно говорит, что здесь будет — те же слова, что в
// приложении Apple (MainView.swift, SectionPlaceholderView).
import { type ReactNode } from 'react';
import { useActiveExam } from '../../training/exam';
import { useI18n } from '../../i18n/i18n';
import styles from '../screens.module.css';

export function WordsScreen(): ReactNode { return <SectionPlaceholder section="words" />; }
export function ExamScreen(): ReactNode { return <SectionPlaceholder section="exam" />; }

export function SectionPlaceholder({ section }: { section: 'words' | 'exam' }): ReactNode {
  const { t } = useI18n();
  const exam = useActiveExam();
  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{t.tabs[section]}</h1>
      <p className={styles.lead}>{t.placeholder[section === 'exam' && exam === 'toefl' ? 'toefl' : section]}</p>
    </div>
  );
}
