import { isApiError } from '@greprep/api-client';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { AlertIcon, BackIcon, OfflineIcon } from '../../components/icons';
import { StatusScreen } from '../../components/StatusScreen';
import { useI18n } from '../../i18n/i18n';
import { useShell } from '../../shellContext';
import { useBackButton } from '../../telegram/hooks';
import { useActiveExam } from '../../training/exam';
import { useOnline } from '../../useOnline';
import { useWord } from '../../words/hooks';
import { wordSearchParams } from '../../words/search';
import styles from '../screens.module.css';

export function WordScreen() {
  const { t } = useI18n();
  const { shell } = useShell();
  const { wordId } = useParams({ from: '/app/tabs/words/$wordId' });
  const { q = '' } = useSearch({ from: '/app/tabs/words/$wordId' });
  const navigate = useNavigate();
  useBackButton(shell === 'telegram' ? () => { void navigate({ to: '/words', search: wordSearchParams(q) }); } : null);
  const query = useWord(useActiveExam(), wordId);
  const online = useOnline();
  const error = query.error ?? query.failureReason;
  const offline = !online || query.fetchStatus === 'paused' || isApiError(error) && error.kind === 'network';
  const missing = isApiError(error) && error.status === 404;
  const word = query.data;
  return <div className={styles.wordsCard}>
    {shell === 'site' && <Link to="/words" search={wordSearchParams(q)} className={styles.wordsBack}><BackIcon />{t.back}</Link>}
    {offline ? <StatusScreen live icon={<OfflineIcon />} title={t.home.offlineTitle} text={t.words.offline} action={{ label: t.home.retry, onClick: () => void query.refetch() }} />
      : query.isError ? <StatusScreen live icon={<AlertIcon />} title={missing ? t.words.missing : t.words.cardFailed}
        {...(!missing && { action: { label: t.home.retry, onClick: () => void query.refetch() } })} />
        : !word ? <p role="status" className={styles.wordsNotice}>{t.words.loading}</p>
          : <>
            <header><h1 className={styles.wordsHeadword} lang="en">{word.lemma}</h1>
              {(word.partOfSpeech || word.ipa) && <p className={styles.wordsMeta} lang="en">{word.partOfSpeech && <span>{word.partOfSpeech}</span>}{word.ipa && <span className={styles.wordsIpa}>{word.ipa}</span>}</p>}
            </header>
            {word.senses.map((sense, index) => <section className={styles.wordsSense} key={index} aria-label={`${t.words.meaning} ${index + 1}`}>
              <p className={styles.wordsTranslation} lang="ru">{sense.translation}</p>
              <p className={styles.wordsDefinition} lang="en">{sense.definition}</p>
              {(sense.example || sense.exampleTranslation) && <blockquote className={styles.wordsExample}>
                {sense.example && <p lang="en">{sense.example}</p>}{sense.exampleTranslation && <p lang="ru">{sense.exampleTranslation}</p>}
              </blockquote>}
            </section>)}
            {(['synonyms', 'antonyms'] as const).map((kind) => word[kind].length > 0 && <section className={styles.wordsRelations} key={kind}>
              <h2>{t.words[kind]}</h2><ul lang="en">{word[kind].map((lemma, index) => <li key={index}>{lemma}</li>)}</ul>
            </section>)}
          </>}
  </div>;
}
