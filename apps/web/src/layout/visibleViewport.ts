/** Safari при клавиатуре меняет visualViewport, сохраняя высоту layout viewport и stableHeight Telegram. */
export function bindVisibleViewport(): () => void {
  const visible = window.visualViewport;
  if (!visible) return () => {};
  const html = document.documentElement;
  const update = () => {
    // Масштабирование страницы не должно уменьшать раскладку и вызывать повторный zoom.
    if (visible.scale !== 1) return;
    html.style.setProperty('--app-visible-height', `${visible.height}px`);
    html.style.setProperty('--app-visible-top', `${visible.offsetTop}px`);
    const field = document.activeElement;
    if (!field || !(field instanceof HTMLElement)) return;
    const main = field.closest<HTMLElement>('main.app-shell, [data-viewport-scroll]');
    if (!main) return;
    // Фокус мог прокрутить поле до появления клавиатуры: после уменьшения области возвращаем его в видимую часть.
    const bounds = main.getBoundingClientRect(), input = field.getBoundingClientRect();
    if (input.bottom > bounds.bottom) main.scrollTop += Math.ceil(input.bottom - bounds.bottom);
    else if (input.top < bounds.top) main.scrollTop += Math.floor(input.top - bounds.top);
  };
  update();
  visible.addEventListener('resize', update);
  visible.addEventListener('scroll', update);
  return () => {
    visible.removeEventListener('resize', update);
    visible.removeEventListener('scroll', update);
    html.style.removeProperty('--app-visible-height');
    html.style.removeProperty('--app-visible-top');
  };
}
