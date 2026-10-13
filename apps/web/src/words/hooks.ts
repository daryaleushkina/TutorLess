import { getWord, getWords, type Exam } from '@greprep/api-client';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { wordPrefix } from './search';
import { useAccount } from '../session/session';

export const WORD_PAGE_SIZE = 50;
export const WORD_SEARCH_DELAY_MS = 200;

/** Пользователь, экзамен и поиск разделяют кэш; AbortSignal отменяет устаревшую выдачу. */
export function useWords(exam: Exam, q: string) {
  const owner = useAccount().id;
  const prefix = wordPrefix(q);
  return useInfiniteQuery({
    queryKey: ['words', owner, exam, prefix],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ signal, pageParam }) => getWords({ exam, q: prefix, limit: WORD_PAGE_SIZE, after: pageParam }, { signal }),
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useWord(exam: Exam, id: string) {
  const owner = useAccount().id;
  return useQuery({ queryKey: ['word', owner, exam, id], queryFn: ({ signal }) => getWord(id, { exam }, { signal }) });
}
