import { useRouterState } from '@tanstack/react-router';
import { createContext, use, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useShell } from '../shellContext';
import { TELEGRAM_BASE } from '../shell';
import { TabHistory } from './tabHistory';

const HistoryContext = createContext<{ history: TabHistory; drafts: Map<string, unknown> } | null>(null);

export function TabHistoryProvider({ children }: { children: ReactNode }) {
  const [value] = useState(() => ({ history: new TabHistory(), drafts: new Map<string, unknown>() }));
  const { shell } = useShell();
  const href = useRouterState({ select: (state) => state.location.href });
  const local = shell === 'telegram' && href.startsWith(`${TELEGRAM_BASE}/`) ? href.slice(TELEGRAM_BASE.length) : href;
  useLayoutEffect(() => value.history.visit(local), [value, local]);
  return <HistoryContext value={value}>{children}</HistoryContext>;
}

export function useTabHistory() {
  const value = use(HistoryContext);
  if (!value) throw new Error('useTabHistory outside TabHistoryProvider');
  return value.history;
}

/** Форма не исчезает при смене вкладки; память очищается со сменой аккаунта, на диск не пишется. */
export function useTabDraft<T>(key: string, initial: () => T) {
  const value = use(HistoryContext);
  if (!value) throw new Error('useTabDraft outside TabHistoryProvider');
  const href = useRouterState({ select: (state) => state.location.href });
  const [draftKey] = useState(() => `${href}:${key}`);
  const saving = useRef(true);
  // Значения кладёт только этот хук с тем же ключом и типом; внешнего ввода в Map нет.
  const [state, setState] = useState<T>(() => value.drafts.has(draftKey) ? value.drafts.get(draftKey) as T : initial());
  useLayoutEffect(() => { if (saving.current) value.drafts.set(draftKey, state); }, [value, draftKey, state]);
  const discard = () => { saving.current = false; value.drafts.delete(draftKey); };
  return [state, setState, discard] as const;
}
