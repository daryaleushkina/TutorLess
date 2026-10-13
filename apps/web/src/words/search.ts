import { z } from 'zod';

/** Адрес — внешний ввод; повреждённый q открывает полный список. Сам ввод сохраняется для возврата. */
export const wordSearch = z.object({ q: z.string().max(128).optional().catch(undefined) });

/** Эквивалентные поиски разделяют страницы кэша, как и курсор сервера. Знаки % и _ остаются буквальными. */
export function wordPrefix(q: string): string { return q.trim().toLowerCase(); }

/** Пустой поиск — адрес раздела без висящего параметра q. */
export function wordSearchParams(q: string): { q?: string } { return q ? { q } : {}; }
