import { afterEach, expect, test, vi } from 'vitest';
import { bindVisibleViewport } from './visibleViewport';

afterEach(() => vi.unstubAllGlobals());

test('нет visualViewport — остаются запасные CSS-размеры', () => {
  vi.stubGlobal('window', {});
  expect(() => bindVisibleViewport()()).not.toThrow();
});

test('клавиатура меняет высоту и сдвиг; zoom не перестраивает страницу; cleanup снимает подписки', () => {
  const visible = Object.assign(new EventTarget(), { scale: 1, height: 844, offsetTop: 0 });
  const properties = new Map<string, string>();
  vi.stubGlobal('window', { visualViewport: visible });
  vi.stubGlobal('document', { documentElement: { style: {
    setProperty: (name: string, value: string) => properties.set(name, value),
    removeProperty: (name: string) => properties.delete(name),
  } } });
  const stop = bindVisibleViewport();
  expect(properties.get('--app-visible-height')).toBe('844px');
  visible.height = 360; visible.offsetTop = 80;
  visible.dispatchEvent(new Event('resize')); visible.dispatchEvent(new Event('scroll'));
  expect(properties.get('--app-visible-height')).toBe('360px');
  expect(properties.get('--app-visible-top')).toBe('80px');
  visible.scale = 2; visible.height = 180; visible.dispatchEvent(new Event('resize'));
  expect(properties.get('--app-visible-height')).toBe('360px');
  stop(); visible.scale = 1; visible.dispatchEvent(new Event('resize')); visible.dispatchEvent(new Event('scroll'));
  expect(properties.size).toBe(0);
});

test('поле с фокусом возвращается в прокрутку после изменения видимой области', () => {
  const visible = Object.assign(new EventTarget(), { scale: 1, height: 440, offsetTop: 0 });
  const main = { scrollTop: 0, getBoundingClientRect: () => ({ top: 100, bottom: 300 }) };
  let bounds = { top: 320, bottom: 448.96875 };
  let inside = true;
  class Field {
    closest() { return inside ? main : null; }
    getBoundingClientRect() { return bounds; }
  }
  vi.stubGlobal('HTMLElement', Field);
  vi.stubGlobal('window', { visualViewport: visible });
  vi.stubGlobal('document', { activeElement: new Field(), documentElement: { style: { setProperty() {}, removeProperty() {} } } });
  const stop = bindVisibleViewport(); expect(main.scrollTop).toBe(149);
  bounds = { top: 50, bottom: 178 }; visible.dispatchEvent(new Event('resize'));
  expect(main.scrollTop).toBe(99);
  bounds = { top: 120, bottom: 248 }; visible.dispatchEvent(new Event('resize'));
  expect(main.scrollTop).toBe(99);
  inside = false; visible.dispatchEvent(new Event('scroll')); expect(main.scrollTop).toBe(99);
  stop();
});
