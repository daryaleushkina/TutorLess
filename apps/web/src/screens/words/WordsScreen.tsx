import { isApiError } from '@greprep/api-client';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { AlertIcon, ChevronRightIcon, OfflineIcon, SearchIcon } from '../../components/icons';
import { StatusScreen } from '../../components/StatusScreen';
import { useI18n } from '../../i18n/i18n';
import { useActiveExam } from '../../training/exam';
import { useOnline } from '../../useOnline';
import { useWords, WORD_SEARCH_DELAY_MS } from '../../words/hooks';
import { wordSearchParams } from '../../words/search';
import common from '../screens.module.css';
import styles from '../screens.module.css';

export function WordsScreen() {
  const { t } = useI18n();
  const exam = useActiveExam();
  const { q = '' } = useSearch({ from: '/app/tabs/words' });
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  const ownSearch = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Своя задержанная навигация подтверждает прежний ввод, но не откатывает новые символы.
    const own = ownSearch.current === q;
    ownSearch.current = undefined;
    if (!own) setInput(q);
  }, [q]);
  useEffect(() => {
    if (input === q) return;
    const timer = setTimeout(() => {
      ownSearch.current = input;
      void navigate({ to: '/words', search: wordSearchParams(input), replace: true, resetScroll: false });
    }, WORD_SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input, q, navigate]);
  const query = useWords(exam, q);
  const online = useOnline();
  const error = query.error ?? query.failureReason;
  const offline = !online || query.fetchStatus === 'paused' || isApiError(error) && error.kind === 'network';
  const words = query.data?.pages.flatMap((page) => page.words);
  // hasNextPage относится к новому ключу; курсор видимых страниц сохраняет кнопку у placeholderData.
  const hasMore = Boolean(query.data?.pages.at(-1)?.nextCursor);
  const updating = input !== q || query.isFetching || query.isPlaceholderData;
  return <div className={common.screen}>
    <h1 className={common.title}>{t.tabs.words}</h1>
    <label className={styles.wordsSearch}>
      <SearchIcon />
      <span className={styles.wordsSrOnly}>{t.words.search}</span>
      <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.words.search}
        maxLength={128} autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="search" />
    </label>
    {!words ? offline ? <StatusScreen heading="h2" live icon={<OfflineIcon />} title={t.home.offlineTitle} text={t.words.offline}
      action={{ label: t.home.retry, onClick: () => void query.refetch() }} />
      : query.isError ? <StatusScreen heading="h2" live icon={<AlertIcon />} title={t.words.failed}
        action={{ label: t.home.retry, onClick: () => void query.refetch() }} />
        : <p role="status" className={styles.wordsNotice}>{t.words.loading}</p>
          : <>
            <div aria-busy={updating}>
              {words.length ? <ul className={styles.wordsList} aria-label={t.tabs.words}>
                {words.map((word) => <li key={word.id}><Link to="/words/$wordId" params={{ wordId: word.id }} search={wordSearchParams(q)} aria-label={word.partOfSpeech ? `${word.lemma}, ${word.partOfSpeech}` : word.lemma} className={styles.wordsRow}>
                  <span className={styles.wordsRowBody}><span className={styles.wordsLemma} lang="en">{word.lemma}</span>
                    {word.partOfSpeech && <small lang="en">{word.partOfSpeech}</small>}</span><ChevronRightIcon />
                </Link></li>)}
              </ul> : <StatusScreen heading="h2" live title={q ? t.words.notFound : t.words.empty} text={q ? t.words.searchHint : undefined} />}
            </div>
            {query.isFetchNextPageError ? <p role="status" className={styles.wordsNotice}>{t.words.moreFailed}</p>
              : offline ? <p role="status" className={styles.wordsNotice}>{t.home.staleOffline}</p>
                : query.isRefetchError && <p role="status" className={styles.wordsNotice}>{t.home.staleFailed}</p>}
            {hasMore && <button type="button" className={styles.wordsMore} disabled={query.isFetching || query.isPlaceholderData || input !== q}
              onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? t.words.loading : query.isFetchNextPageError ? t.home.retry : t.words.more}</button>}
            {query.isRefetchError && <button type="button" className={styles.wordsMore} disabled={query.isFetching}
              onClick={() => void query.refetch()}>{t.home.retry}</button>}
          </>}
  </div>;
}
