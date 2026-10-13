export const TAB_ROOTS = { train: '/', words: '/words', exam: '/exam', progress: '/progress' } as const;
export type Tab = keyof typeof TAB_ROOTS;

export function tabForPath(path: string): Tab | undefined {
  if (path === '/' || path.startsWith('/training/')) return 'train';
  for (const tab of ['words', 'exam', 'progress'] as const) {
    if (path === TAB_ROOTS[tab] || path.startsWith(`${TAB_ROOTS[tab]}/`)) return tab;
  }
  return undefined;
}

/** Последний адрес каждой вкладки живёт в оболочке аккаунта, включая поиск и якорь. */
export class TabHistory {
  private addresses: Record<Tab, string> = { ...TAB_ROOTS };
  active: Tab = 'train';
  profileBack = '/';
  visit(href: string): void {
    const tab = tabForPath(href.split(/[?#]/)[0]!);
    if (!tab) return;
    this.active = tab;
    this.addresses[tab] = href;
    this.profileBack = href;
  }
  destination(tab: Tab): string { return this.addresses[tab]; }
}
