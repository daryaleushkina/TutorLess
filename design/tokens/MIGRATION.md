# Перевод токенов на «Ночную студию»

Источник значений — `design/night-studio/core.css` (решение Даши 10.10.2026).
В таблицах указаны пути DTCG. Цвет `color.text-2` выходит в CSS как
`--color-text-2`, в Apple — `Color(.text2)`, в Compose — `colors.text2`,
в ресурсах Android — `gp_text_2`. Размер `radius.m` — `--radius-m`,
`GPRadius.m`, `GpRadius.m`.

## Цвета и материал

| Старый токен | Новый токен или удаление |
| --- | --- |
| `color.text-secondary` | `color.text-2`; более тихие подписи — `color.text-3` |
| `color.verbal-tint` | `color.verbal-soft` |
| `color.quant-tint` | `color.quant-soft` |
| `color.essay-tint` | `color.essay-soft` |
| `color.words-tint` | `color.words-soft` |
| `color.wrong-tint` | `color.wrong-soft` |
| `color.fill` | Удалён; поверхность сегментов задаёт `color.surface-2` |
| `color.tab-selected` | Удалён; выбранную навигацию описывают `color.accent` и `color.accent-soft` |
| `color.glow.{verbal,quant,essay,words,exam}.{strong,soft}` | Все десять удалены; `shadow.glow` — отдельное свечение главной кнопки |
| `color.glass.edge`, `color.glass.rim` | Удалены |
| `glass-fill.regular`, `glass-fill.strong` | Удалены; поверхности — `color.surface`, `color.surface-2` |
| `glass.blur`, `glass.saturate` | Удалены |
| `shadow.glass`, `shadow.segment-on` | Удалены |
| `sign-in.telegram.bg`, `sign-in.telegram.text` | Удалены, вход только Apple и Google (issue #42) |
| `color.bg`, `color.surface`, `color.text`, `color.line` | Имена сохранены, значения заменены палитрой каталога |
| `color.accent`, `color.on-accent`, `color.focus`, `color.wrong` | Имена сохранены, значения заменены палитрой каталога |
| `color.verbal`, `color.quant`, `color.essay`, `color.words`, `color.exam` | Имена сохранены, значения заменены палитрой каталога |
| `sign-in.apple.*`, `sign-in.google.*` | Сохранены без изменения |

Добавлены `color.surface-2`, `color.text-3`, `color.line-strong`,
`color.accent-soft`, `color.right`, `color.right-soft`, `color.exam-soft`,
`color.nav-bg`, `shadow.glow`.

Разделы TOEFL из `core.css` (решение Даши 09.10.2026) добавлены в обеих темах:

| Новый токен | Назначение |
| --- | --- |
| `color.reading`, `color.reading-soft` | Reading и его мягкая подложка |
| `color.listening`, `color.listening-soft` | Listening и его мягкая подложка |
| `color.writing`, `color.writing-soft` | Writing и его мягкая подложка |
| `color.speaking`, `color.speaking-soft` | Speaking и его мягкая подложка |

Например, `color.reading-soft` выходит как `--color-reading-soft`,
`Color(.readingSoft)`, `colors.readingSoft` и ресурс `gp_reading_soft`.
Все значения перенесены из каталога без изменения.

## Шрифты и роли текста

| Старый токен | Новый токен или удаление |
| --- | --- |
| `font.family.text` | Имя сохранено; Geologica, Onest, system-ui, sans-serif |
| `font.family.system` | Удалён; семейство для текста — `font.family.text` |
| `font.weight.{regular,medium,semibold}` | Сохранены: 400/500/600 |
| `font.text-scale-large` | Сохранён: 1,125 |
| `type.display`, `type.display-wide` | Удалены; размер итоговых чисел определяется экраном каталога |
| `type.score` | `type.score-num`; широкая версия — `type.score-num-wide` |
| `type.title-1`, `type.title-1-wide` | `type.h1`, `type.h1-wide` |
| `type.title-2`, `type.title-2-wide` | Удалены; заголовок тренировки — `type.start-title[-wide]`, выбора экзамена — `type.exam-title[-wide]` |
| `type.title-3` | `type.h2`; малый подзаголовок — `type.h3` |
| `type.title-3-wide` | Удалён; `type.h2` и `type.h3` сохраняют размер на компьютере |
| `type.timer`, `type.timer-wide` | Удалены; счётчик сессии — `type.session-count[-wide]`; таймер определяется экраном |
| `type.prompt`, `type.prompt-wide` | `type.q-text`, `type.q-text-wide` |
| `type.headline` | Для имени раздела — `type.section-name`, для заголовка карточки — `type.h2` |
| `type.body` | Имя сохранено; 16/1,45, трекинг −0,005em |
| `type.body-long` | `type.explain-body` для разбора; `type.sense-en` для значения слова |
| `type.callout` | Удалён; текст кнопки — `type.button`, варианта ответа — `type.opt`, ссылки — `type.action` |
| `type.subhead` | Удалён; вводный текст — `type.lead`, метаданные — `type.meta` |
| `type.footnote` | Удалён; метаданные — `type.meta`, подпись над заголовком — `type.eyebrow` |
| `type.caption` | Имя сохранено; 13/1,45, трекинг −0,005em |
| `type.key` | Удалён: в ядре каталога такой роли нет |
| `type.tab-label` | `type.nav-label`; широкая версия — `type.nav-label-wide` |
| `type.headword`, `type.headword-wide` | Имена сохранены; 56/88, вес `thin`, интерлиньяж 1, трекинг −0,04em |

Добавлены `font.family.mono` (IBM Plex Mono, ui-monospace, Menlo, monospace),
`font.weight.thin`, `type.ipa`, `type.exam-switch`, `type.section-stat[-wide]`,
`type.answer`, `type.seg`, `type.score-label`, `type.stat-value`,
`type.exam-name[-wide]`, `type.word-meta`, `type.example`, `type.week-count`.
`week-count` используется только на широком экране.

Добавлено семейство формул Quant `font.family.math`: Source Serif 4,
Georgia, serif, как в `.math` каталога. На вебе — `--font-family-math`,
на Apple — `GPType.mathFontFamily` и `GPType.mathFontFallbacks`,
в Compose — `GpTypography.MATH_FONT_FAMILY` и `MATH_FONT_FALLBACKS`.
В YAML-шапке семейства перечислены в `fontFamilies`. Это семейство без
новой роли текста; файлы шрифта добавляются при переводе приложений.

У `q-text` итоговое правило `.frame .q-text` — **20/1,6**; базовые 19/1,55
переопределены ниже в `core.css`. На широком экране — 24/1,6.
Межстрочные расстояния в Swift и Compose сохраняются без округления до целых.

## Радиусы, размеры и раскладка

| Старый токен | Новый токен или удаление |
| --- | --- |
| `radius.xs` | Удалён |
| `radius.sm` | `radius.s`: 10 |
| `radius.md`, `radius.lg` | `radius.m`: 16 |
| `radius.xl`, `radius.xxl` | `radius.l`: 24 |
| `radius.full` | Имя сохранено; 999 |
| `size.button` | Имя сохранено; 52 |
| `size.button-compact`, `size.main-button` | Удалены; каталог задаёт `size.button`, для иконки — `size.icon-button` |
| `size.row` | `size.section-row`: 64 |
| `size.row-tall` | `size.opt`: 52 для варианта ответа; другие строки определяются экраном |
| `size.step-node`, `size.step-node-current`, `size.step-line`, `size.step-ring`, `size.step-end` | Удалены |
| `size.tab-bar-height`, `size.tab-bar-width`, `size.tab-bar-bottom` | Удалены; навигация занимает низ экрана, нижнее поле — `layout.nav-bottom`: 28 |
| `size.header-button` | `size.icon-button`: 44 |
| `size.fade`, `size.brand-mark`, `size.brand-glyph` | Удалены |
| `size.tap-target`, `size.hairline` | Сохранены: 44 и 1 |
| `layout.gutter` | Имя сохранено; 22, широкая версия — `layout.gutter-wide`: 64 |
| `layout.gutter-bar`, `layout.top-inset` | Удалены; верхнее поле содержимого — `layout.main-top`: 12 и `layout.main-top-wide`: 44 |
| `layout.sidebar-min`, `layout.sidebar-max` | `layout.sidebar-width`: 232 |
| `layout.breakpoint-narrow` | Удалён; ядро каталога задаёт только широкую границу 900 |
| `layout.auth-column-max`, `layout.tagline-max` | Удалены; таких ролей в ядре каталога нет |
| `layout.content-max`, `layout.breakpoint-wide` | Сохранены: 720 и 900 |
| `motion.easing.out` | Имя сохранено; кривая каталога `[0.2, 0.8, 0.2, 1]` |
| `space.*`, `opacity.disabled`, остальные `motion.*` | Сохранены без изменения |

Добавлены `size.exam-switch` (40), `size.side-card` (60), `size.icon` (22),
`size.icon-sm` (16), `size.section-mark` (10), `size.session-bar` (3),
`size.nav-item-wide` (46), `layout.main-bottom-nav` (96).

## Выбор темы на платформах

Веб: `data-theme="light"` / `"dark"` на `<html>`. Тонкие роли используют
`var(--font-weight-thin)`, свечение — `var(--shadow-glow)`; оба значения
переключаются вместе с цветами. Без атрибута применяется системная тема.

Apple: цвета выбирает каталог `GPColors.xcassets`. С тем же внешним видом
выбирать `GPThemeTokens.light` / `.dark` и `GPType.light` / `.dark`.
`GPType` теперь набор ролей, а не перечисление статических стилей.
В каждой `GPTextStyle` есть `fontFamily`: Geologica или IBM Plex Mono.
В светлой теме `thin` — `.light` (300), в тёмной — `.ultraLight` (200).

Compose: вместе с `GpLightColors` / `GpDarkColors` выбирать
`GpLightTheme` / `GpDarkTheme` и `GpTypography.light(family, monoFamily)` /
`.dark(family, monoFamily)`. Фабрики связывают тонкие роли с нужным весом.
Файлы шрифтов добавляются при переводе приложений.

`glow` на обеих нативных платформах хранит цвет, смещения, радиус размытия
и `spread`. Последний нужен для расширения слоя перед размытием; его нельзя
потерять при переносе в механизм теней платформы.
