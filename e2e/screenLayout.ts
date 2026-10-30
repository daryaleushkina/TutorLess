/** Геометрия проверяется в браузере; функция не зависит от окружения фикстур. */
export function screenHorizontalIssues() {
  const out: string[] = [];
  const main = document.querySelector<HTMLElement>('main.app-shell');
  if (!main) return ['нет main.app-shell'];
  const label = (el: Element) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`;
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`страница шире экрана: ${document.documentElement.scrollWidth} > ${innerWidth}`);
  if (main.scrollWidth > main.clientWidth + 1) out.push(`содержимое шире экрана: ${main.scrollWidth} > ${main.clientWidth}`);
  for (const el of main.querySelectorAll('*')) {
    // Внутренняя горизонтальная прокрутка намеренно скрывает широкое содержимое.
    // Проверяем рамку, но не её скрытых потомков: они не расширяют сам экран.
    let parent = el.parentElement;
    let clipped = false;
    while (parent && parent !== main) {
      if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) { clipped = true; break; }
      parent = parent.parentElement;
    }
    if (clipped) continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.right > innerWidth + 2) {
      out.push(`вылезает вправо: ${label(el)} (${Math.round(r.right)} > ${innerWidth})`);
      break;
    }
  }
  return out;
}
