# Миграция токенов

Текущий источник значений — `design/app-b/index.html` (решение Даши 12.10.2026).
Предыдущая миграция использовала `design/night-studio/core.css`.
В таблицах указаны пути DTCG. Цвет `color.text-2` выходит в CSS как
`--color-text-2`, в Apple — `Color(.text2)`, в Compose — `colors.text2`,
в ресурсах Android — `gp_text_2`. Размер `radius.m` — `--radius-m`,
`GPRadius.m`, `GpRadius.m`.

## Стиль B

Источник текущих значений — `design/app-b/index.html`: спокойное приложение
с палитрой лендинга B (решение Даши 12.10.2026). Правила ниже этого раздела
описывают предыдущую миграцию на «Ночную студию»; для актуальных значений
используется стиль B.

- Светлая тема: фон `#FBF3EA`, поверхности `#FFFDF9` / `#F3EADF` / `#EADFD2`;
  тёмная: `#140F1C`, поверхности `#1E1828` / `#282133` / `#342B41`.
- `text` / `text-2` / `text-3` соответствуют `ink` / `ink-2` / `ink-3`,
  `line-strong` — `line-2`. `nav-bg` равен `bg`; `focus` — контрастному
  оттенку томата с порогом 3:1 на всех четырёх поверхностях.
  Томату `#FF5B3A` соответствует тёмная подпись `on-accent` `#1C1424`.
  `accent-soft` — томат с прозрачностью 0,14, как у `wrong-soft`.
- Новые токены: `color.surface-3`, `color.highlight` (маркер `hl`),
  `color.exam-gre[-soft]`, `color.exam-toefl[-soft]`, `color.exam-sat[-soft]`,
  `color.exam-gmat[-soft]`. GRE — манго, TOEFL — мята, SAT — лиловый,
  GMAT — голубой. На цветных плитках макет использует тёмный текст.
  Для всех 13 цветов разделов и экзаменов добавлены отдельные `color.<имя>-ink`.
- Мягкие подложки разделов и экзаменов: прозрачность 0,10 в светлой теме
  и 0,14 в тёмной. `right-soft`, `wrong-soft` и маркер перенесены точно.
- TOEFL: Reading — голубой `#82CBFF`, Listening — мята `#43D6A3`,
  Writing — манго `#FFC53D`, Speaking — розовый `#FF9ECD`.
  Базовые цвета одинаковы в темах; текстовые оттенки вынесены в `*-ink`.
- Основное семейство — Onest Variable 400–800, запасные шрифты — как в макете.
  IBM Plex Mono для IPA, Source Serif 4 для формул и системные шрифты входа
  сохранены. Добавлены веса `bold` 700, `extrabold` 800, `demibold` 650.
  SwiftUI отображает 650 ближайшим именованным `.semibold`; 800 — `.heavy`.
  Compose сохраняет точный промежуточный `FontWeight(650)`.
- Имена всех прежних профилей текста сохранены. Профили, показанные в B,
  сверяются с его CSS: `num-m` 52/0,98/−0,045em (слово), `num-l`
  64/0,9/−0,05em (слова сегодня), `num-xl` 68/0,95/−0,05em (балл),
  `num-xxl` 120/0,8/−0,055em (итог), `score-num` 30/1,05/−0,04em.
  У этих чисел в макете нет широкого переопределения: парные профили совпадают.
  `headword[-wide]` — ссылки на `num-m[-wide]`, `exam-name[-wide]` —
  текст плитки 16/800/−0,02em. `session-count[-wide]` получает 800 по заданию.
  Отсутствующие в десяти экранах роли сохраняют прежние размеры и интервалы;
  крупные профили используют 800 и плотный трекинг.
- Радиусы `s/m/l` — 12/18/24, кнопка и вариант ответа — 54,
  поля основного экрана — 20/56, нижний резерв навигации — 112,
  боковая панель — 248. Кривая нажатия — (0,23, 1, 0,32, 1),
  сжатие — 0,97, длительность — 140 мс.
- Устарел `font.weight.thin`: ссылка на `font.weight.extrabold`, общий вес 800;
  ни одна роль текста больше не использует `thin`, тема вес не меняет.
  Свойства `GPThemeTokens.thin` / `GpThemeTokens.thin` оставлены для сборки платформ.
- Устарел `shadow.glow`: все размеры и непрозрачность равны нулю,
  в CSS — `none`. API тени сохранён; главная кнопка в шапке `DESIGN.md`
  больше не ссылается на свечение.
- `gp_bg_dark` и `bgDark` всегда равны новому тёмному фону `#140F1C`,
  независимо от темы ОС. Поведение выбора темы приложения не менялось.

### Контраст и правила использования

**Текст цветом раздела/экзамена — только `*-ink`**
(решение Даши 12.10.2026). Это касается и крупных цифр балла, результата,
количества слов. Например, `color.verbal-ink` выходит как `--color-verbal-ink`,
`Color(.verbalInk)`, `colors.verbalInk` и ресурс `gp_verbal_ink`.
Применение этого правила в коде приложений — задача лидов платформ.

Базовые цвета `verbal`, `quant`, `essay`, `words`, `exam`, разделов TOEFL
и четырёх экзаменов сохраняют палитру B. Они допустимы для точек рядом
с названием раздела (T1), плиток с подписью экзамена (T7), линий и точек
графика с легендой Verbal/Quant и текстовым описанием данных (G1), полос
точности рядом с названием упражнения и числовым процентом (G1).
В десяти экранах B нет значимой графики этими цветами без соседней подписи:
проверка базовых цветов на 3:1 поэтому не применяется. Новая значимая графика
без подписи требует отдельной проверки выбранного базового цвета к `surface`
на 3:1; декоративные цвета не заменяют контрастные подписи и индикатор фокуса.

Каждый `*-ink` проходит 4,5:1 на `bg`, `surface`, `surface-2`, `surface-3`
и своём `*-soft` поверх `surface` в обеих темах. `focus` проходит 3:1
на всех четырёх поверхностях. `right` / `wrong` проходят 4,5:1 на четырёх
поверхностях и своих подложках поверх `bg`, `surface`, `surface-2`.
`accent` остаётся заливкой томатной кнопки; её текст — `on-accent`, 5,7958:1.
Предыдущие проверки обычного текста, навигации и кнопок входа сохранены.

Подбор выполняется в OKLCH по [матрицам CSS Color 4](https://www.w3.org/TR/css-color-4/#color-conversion-code):
hue фиксирован, меняется только lightness; если цвет выходит за sRGB,
chroma уменьшается до границы гамута при неизменном hue. Двоичный поиск
выбирает ближайшую к базе светлоту, проходящую AA после округления всех
трёх выходов. Hex ограничен 8 битами на канал: итоговый hue отличается
от базы менее чем на 0,5°, а минимальный контраст может быть чуть выше
порога на один шаг округления. Произвольного дополнительного затемнения нет.
Тёмные `*-ink` — ссылки на базовые цвета: повышение светлоты не понадобилось.
Тёмные `focus`, `right`, `wrong` сохранены.

Ниже — значения и минимальный контраст по всем фонам соответствующей роли,
с учётом форматов CSS, Apple (4 знака после запятой) и Android (8-битный ARGB).

| Токен | Светлая: значение / минимум | Тёмная: значение / минимум |
| --- | --- | --- |
| verbal-ink | #6747DF / 4.5108:1 | #B9A6FF / 6.2426:1 |
| quant-ink | #00724D / 4.5477:1 | #43D6A3 / 7.1052:1 |
| essay-ink | #875B00 / 4.5319:1 | #FFC53D / 7.9777:1 |
| words-ink | #B82374 / 4.5266:1 | #FF9ECD / 6.8047:1 |
| exam-ink | #0066B2 / 4.5108:1 | #82CBFF / 7.2742:1 |
| reading-ink | #1C6998 / 4.5358:1 | #82CBFF / 7.2742:1 |
| listening-ink | #007252 / 4.5288:1 | #43D6A3 / 7.1052:1 |
| writing-ink | #805E00 / 4.5423:1 | #FFC53D / 7.9777:1 |
| speaking-ink | #9D4573 / 4.5246:1 | #FF9ECD / 6.8047:1 |
| exam-gre-ink | #805E00 / 4.5423:1 | #FFC53D / 7.9777:1 |
| exam-toefl-ink | #007252 / 4.5288:1 | #43D6A3 / 7.1052:1 |
| exam-sat-ink | #6B56A8 / 4.5382:1 | #B9A6FF / 6.2426:1 |
| exam-gmat-ink | #1C6998 / 4.5358:1 | #82CBFF / 7.2742:1 |
| focus | #E84523 / 3.0119:1 | #FF5B3A / 4.3431:1 |
| right | #00724A / 4.5444:1 | #5FE3AE / 7.2564:1 |
| wrong | #BA2C11 / 4.5002:1 | #FF8D75 / 5.5839:1 |

Явная пересборка производных цветов: `pnpm derive:ink` из `design/tokens`.
Проверка воспроизводимости без записи: `pnpm check:ink`; она также входит
в тесты. Обычный `pnpm build` не меняет источники автоматически.

Сверка базовой палитры, радиусов, типографики и трёх выходов:
`node --test test/catalog.test.mjs`. Свежесть выходов: `pnpm check`;
все проверки, включая AA реальных выходов: `pnpm test`.
Прежние имена проверяются по `test/fixtures/compatible-paths.json`.

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
| `sign-in.apple.{bg,text}`, `sign-in.google.{bg,stroke,text}` | Цвета сохранены без изменения |

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
| `font.family.system` | Сохранён: системный шрифт для кнопки Apple и измерителя MainButton Telegram |
| `font.weight.{regular,medium,semibold}` | Сохранены: 400/500/600 |
| `font.text-scale-large` | Сохранён: 1,125 |
| `type.display`, `type.display-wide` | Удалены; итог тренировки — `type.num-xxl[-wide]`, компактный итог — `type.num-l` / `type.num-m-wide`, баллы и слова — `type.num-xl[-wide]` |
| `type.score` | `type.score-num`; широкая версия — `type.score-num-wide` |
| `type.title-1`, `type.title-1-wide` | `type.h1`, `type.h1-wide` |
| `type.title-2`, `type.title-2-wide` | Удалены; заголовок тренировки — `type.start-title[-wide]`, выбора экзамена — `type.exam-title[-wide]` |
| `type.title-3` | `type.h2`; малый подзаголовок — `type.h3` |
| `type.title-3-wide` | Удалён; `type.h2` и `type.h3` сохраняют размер на компьютере |
| `type.timer`, `type.timer-wide` | Удалены; таймер пробника — фиксированный `type.score-num` 32/1, счётчик сессии — `type.session-count[-wide]` |
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
| `type.headword`, `type.headword-wide` | Сохранены как ссылки на `type.num-m` / `type.num-l-wide`: 56/88, вес `thin`, интерлиньяж 1, трекинг −0,04em |

Добавлены `font.family.mono` (IBM Plex Mono, ui-monospace, Menlo, monospace),
`font.weight.thin`, `type.ipa`, `type.exam-switch`, `type.section-stat[-wide]`,
`type.answer`, `type.seg`, `type.score-label`, `type.stat-value`,
`type.exam-name[-wide]`, `type.word-meta`, `type.example`, `type.week-count`.
`week-count` — фиксированный профиль 28 для малых чисел; доступен в обеих раскладках.

### Шкала тонких чисел и слов

Пять крупных ступеней заменяют роли отдельных экранов. Размеры —
компактный / широкий профиль, граница — 900 px. Все ступени используют
Geologica и тематический `thin`: 300 в светлой теме, 200 в тёмной.
Трекинг всех крупных ступеней — −0,04em, интерлиньяж один на ступень.
Размеры каталога округлены к ближайшему профилю с пределом сдвига 10%.
При равном расстоянии выбрана ступень, подходящая парному широкому значению.

| Ступень | Размеры, px/pt/sp | Интерлиньяж | Назначение |
| --- | --- | --- | --- |
| `type.num-s[-wide]` | 48 / 60 | 1 | Малое крупное число, короткое слово |
| `type.num-m[-wide]` | 56 / 72 | 1 | Среднее число, слово |
| `type.num-l[-wide]` | 70 / 88 | 1 | Крупная статистика, компактный итог, отсчёт |
| `type.num-xl[-wide]` | 88 / 120 | 0,95 | Баллы и итоги слов |
| `type.num-xxl[-wide]` | 104 / 144 | 0,9 | Основной итог |

Малые числа сначала используют существующие роли:
`session-count` 22/26, `section-stat` 24/28, `stat-value` 18,
`score-num` 32/44, `week-count` 28. Дополнен один общий промежуточный
профиль `num-compact[-wide]` 36/52, интерлиньяж 1,05, трекинг −0,03em:
для 36/38 и широкого 52 существующие малые роли не укладывались в 10%.
`week-count` теперь используется и для малых подписей/количества на телефоне.

Словарные заголовки входят в крупную шкалу, кроме одного общего профиля
`word-title[-wide]` 40/56, интерлиньяж 1,1, трекинг −0,02em.
Значение 40 не попадает в крупную шкалу при допуске 10%.
У калькулятора высота поля 64 задаётся раскладкой, не интерлиньяжем;
цифра использует общий `num-compact` и центрируется в поле.

| Прежняя роль | Текущая роль: компактный / широкий профиль |
| --- | --- |
| `score-hero[-wide]` | `num-xxl` / `num-xxl-wide` |
| `score-hero-sm` | `num-l` / `num-m-wide` (70 / 72) |
| `speaking-score[-wide]`, `word-score[-wide]`, `word-learning-score[-wide]`, `essay-score[-wide]` | `num-xl` / `num-xl-wide` |
| `countdown[-wide]`, `stat-hero[-wide]` | `num-l` / `num-l-wide` |
| `word-prompt[-wide]`, `word-learning-title[-wide]` | `num-m` / `num-m-wide` |
| `word-card[-wide]` | `num-s` / `num-s-wide` |
| `word-prompt-sm[-wide]` | `word-title` / `word-title-wide` |
| `score-range[-wide]` | `score-num` / `num-compact-wide` |
| `section-score[-wide]` | `num-compact` / `score-num-wide` |
| `quantity[-wide]` | `score-num` / `score-num-wide` |
| `timer[-wide]` | Фиксированный `score-num` (32) в обоих режимах |
| `count-sm`, `count-inline` | Фиксированный `session-count` (22) |
| `count-lg` | Фиксированный `week-count` (28) |
| `review-num` | Фиксированный `section-stat` (24) |
| `headword` / `headword-wide` | Ссылки на `num-m` / `num-l-wide` (56 / 88), для совместимости платформ |
| `exam-name` / `exam-name-wide` | Ссылки на `num-s` / `num-s-wide` (48 / 60), для совместимости платформ |

Роли экранов из левого столбца удалены, кроме псевдонимов ядра `headword`
и `exam-name`. Псевдонимы — ссылки DTCG, не копии чисел. Сборка прослеживает
цепочку ссылок: `thin` и mono наследуются, размеры/интервалы по-прежнему
обязаны совпадать в обеих темах. Проверки — `test/numeric-scale.test.mjs`.

В CSS `--font-<роль>` / `--tracking-<роль>` автоматически переключаются
на широкий профиль от 900 px. Для точного выбора, как в нативных API,
парные роли также дают фиксированные `--font-<роль>-base` и
`--font-<роль>-wide` (и соответствующий tracking). Так таймер с профилем
32 остаётся 32 на компьютере: `--font-score-num-base`. Крупный профиль
можно выбрать на телефоне явно: `--font-score-num-wide` (44).
У непарных ролей обычная переменная уже фиксированная.
Swift и Compose сохраняют отдельные свойства `role` / `roleWide`.
Два режима устройства могут использовать разные ступени согласно таблице.

Итог: 48 базовых имён (45 самостоятельных и 3 псевдонима),
71 профиль с широкими версиями (65 самостоятельных и 6 псевдонимов).
Из них крупная числовая шкала — ровно 5 ступеней / 10 профилей;
дополнительный малый профиль — один, слово-заголовок вне шкалы — одно.

### Общие роли обычного текста

Разовые роли экранов удалены. Размеры приведены к существующим ролям
ядра при допуске 2 px и 0,1 по интерлиньяжу, с сохранением веса.
`passage` → `explain-body` / `q-text`, `sentence` → `q-text[-wide]`,
`condition` → `lead` / `sense-en`, `label` и `question-label` → `opt`,
`intro` → `lead`, `q-text-sm` → `q-text[-wide]`, `meta-strong` → `eyebrow`
или `action`, `opt-sm` → `answer`, `stat-caption` → `section-name`,
`text-entry` → `explain-body` / `lead`, `word-phrase` и `math-value`
на телефоне → `sense-en`. У последних двух одиночных широких профилей
26/1,4 и 28/1,4 общих ролей нет: они остаются локальными правилами каталога.

Общие исключения используются в нескольких упражнениях или экранах;
строки с полями допускают отдельный большой интерлиньяж. Семейство —
Geologica, веса — regular/medium/semibold; эти роли не зависят от темы.
Ссылки `h1-compact` → `h1` и `prompt-title-wide` → `start-title`
сохраняют один источник совпадающих профилей.

| Роль | Размер / вес / интерлиньяж; разрядка | Назначение |
| --- | --- | --- |
| `type.num-label` | 20 / medium / 1.2; -0.015em | Подпись крупного результата: основной и компактный итоги тренировки. |
| `type.num-label-wide` | 28 / medium / 1.2; -0.015em | Подпись основного результата на широком экране. |
| `type.num-unit` | 22 / semibold / 1.45; -0.015em | Единица счёта: число слов на старте и в итоге изучения. |
| `type.prompt-title` | 24 / semibold / 1.25; -0.015em | Заголовок задания слов: перевод в нескольких упражнениях. |
| `type.prompt-title-wide` | 30 / semibold / 1.15; -0.03em | Широкий заголовок задания слов — существующая роль start-title. |
| `type.input-compact` | 17 / medium / 1; 0em | Однострочный ввод: поиск слова и ячейки Complete the Words. |
| `type.input-compact-wide` | 19 / medium / 1; 0em | Однострочный ввод на широком экране. |
| `type.input-letter` | 26 / medium / 1.45; -0.08px | Буквы: сборка слова и сравнение введённого ответа; один размер для обоих экранов. |
| `type.input-display` | 26 / medium / 1.2; 0.01em | Ввод ответа словом: несколько упражнений W12–W14. |
| `type.h1-compact` | 34 / semibold / 1.15; -0.03em | Компактный заголовок прогресса: на телефоне совпадает с h1. |
| `type.h1-compact-wide` | 40 / semibold / 1.15; -0.03em | Компактный заголовок на широких экранах G1 и G6. |
| `type.complete-words-text` | 18 / regular / 2.15; -0.005em | .frame .l-ctw-text в screens/l.css. |
| `type.complete-words-text-wide` | 22 / regular / 2.2; -0.005em | .frame .l-ctw-text в screens/l.css; широкая раскладка от 900 px. |
| `type.sentence-assembly` | 20 / regular / 2.3; -0.08px | .frame .l-frame в screens/l.css. |
| `type.sentence-assembly-wide` | 24 / regular / 2.3; -0.08px | .frame .l-frame в screens/l.css; широкая раскладка от 900 px. |

На вебе — `--font-<роль>` и `--tracking-<роль>`, на Apple — свойства
`GPType.light/dark`, в Compose — `GpTypography.light/dark` (camelCase).
Профили каталога и пределы сдвига проверяются `test/text-scale.test.mjs`.

Добавлено семейство формул Quant `font.family.math`: Source Serif 4,
Georgia, serif, как в `.math` каталога. На вебе — `--font-family-math`,
на Apple — `GPType.mathFontFamily` и `GPType.mathFontFallbacks`,
в Compose — `GpTypography.MATH_FONT_FAMILY` и `MATH_FONT_FALLBACKS`.
В YAML-шапке семейства перечислены в `fontFamilies`. Это семейство без
новой роли текста; файлы шрифта добавляются при переводе приложений.

Для `font.family.system` сохранён стек `-apple-system`, `BlinkMacSystemFont`,
`SF Pro Text`, `system-ui`, `sans-serif`. На вебе — `--font-family-system`,
на Apple — `GPType.systemFont(size:weight:)`, в Compose —
`GpTypography.SYSTEM_FONT_FAMILY` (`FontFamily.Default`). Нативные платформы
выбирают системный шрифт своим API: имена браузерного стека не передаются
в загрузчик вшитых шрифтов.

Типографика кнопок входа — общая для обеих тем:

| Новый токен | Значение |
| --- | --- |
| `sign-in.apple.font-family` | Ссылка на `{font.family.system}`: системный шрифт платформы, на Android — Roboto |
| `sign-in.apple.font-size` | 17 px |
| `sign-in.apple.font-weight` | 500 (Medium) |
| `sign-in.apple.line-height` | 20 px |
| `sign-in.google.font-family` | Roboto, sans-serif |
| `sign-in.google.font-size` | 14 px |
| `sign-in.google.font-weight` | 500 (Medium) |
| `sign-in.google.tracking` | 0,25 px |
| `sign-in.google.line-height` | 20 px |

CSS — `--sign-in-google-font-family`, `--sign-in-google-font-size`,
`--sign-in-google-font-weight`, `--sign-in-google-tracking`,
`--sign-in-google-line-height`; для Apple — `--sign-in-apple-font-family`,
`--sign-in-apple-font-size`, `--sign-in-apple-font-weight`, `--sign-in-apple-line-height`.
Apple — `GPSignInGoogle.fontFamily`, `.fontFallbacks`, `.fontSize`,
`.fontWeight`, `.tracking`, `.lineHeight`: размеры текста в pt.
У `GPSignInApple` — `.fontSize`, `.fontWeight`, `.lineHeight` и `.font`,
который использует системное семейство через `GPType.systemFont`.
Compose — `GpSignInGoogle.FONT_FAMILY`, `.FONT_FALLBACKS`, `.fontSize`,
`.fontWeight`, `.tracking`, `.lineHeight`; `GpSignInApple.fontFamily`,
`.fontSize`, `.fontWeight`, `.lineHeight`: размеры текста в sp.
В YAML-шапке — `signIn.apple` и `signIn.google`. Эти токены не являются цветами и не меняются
при переключении темы.

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
| `size.button-compact` | `size.tap-target`: 44, для сегментов |
| `size.main-button` | Удалён; каталог задаёт `size.button`, для иконки — `size.icon-button` |
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
| `layout.auth-column-max` | Сохранён: 400, колонка входа на широком экране |
| `layout.tagline-max` | `layout.text-max`: 320, узкая колонка поясняющего текста на экранах состояний |
| `layout.content-max`, `layout.breakpoint-wide` | Сохранены: 720 и 900 |
| `motion.easing.out` | Имя сохранено; кривая каталога `[0.2, 0.8, 0.2, 1]` |
| `space.*`, `opacity.disabled`, остальные `motion.*` | Сохранены без изменения |

Добавлены `size.exam-switch` (40), `size.side-card` (60), `size.icon` (22),
`size.icon-sm` (16), `size.section-mark` (10), `size.session-bar` (3),
`size.nav-item-wide` (46), `layout.main-bottom-nav` (96).

`layout.session-max` (1040) ограничивает шапку и действия сессии на широком
экране до перестройки сессии по R1–R20 (часть 3 редизайна).
Ширины применяются по своей роли: `auth-column-max` — вход, `text-max` —
пояснения ошибок и «нет сети», `session-max` — сессия. `content-max` (720)
остаётся шириной слова и его разбора.
CSS — `--layout-auth-column-max`, `--layout-text-max`, `--layout-session-max`;
Apple — `GPLayout.authColumnMax`, `.textMax`, `.sessionMax`;
Compose — `GpLayout.authColumnMax`, `.textMax`, `.sessionMax`.
В YAML-шапке — раздел `layout`.

## Выбор темы на платформах

Веб: `data-theme="light"` / `"dark"` на `<html>`. Тонкие роли используют
`var(--font-weight-thin)`, свечение — `var(--shadow-glow)`; оба значения
переключаются вместе с цветами. Без атрибута применяется системная тема.

Apple: цвета выбирает каталог `GPColors.xcassets`. С тем же внешним видом
выбирать `GPThemeTokens.light` / `.dark` и `GPType.light` / `.dark`.
`GPType` теперь набор ролей, а не перечисление статических стилей.
В каждой `GPTextStyle` есть `fontFamily`: Geologica или IBM Plex Mono.
В светлой теме `thin` — `.light` (300), в тёмной — `.ultraLight` (200).

Для системной заставки Android генератор выпускает `gp_bg_dark` только в
`res/values/gp_colors.xml`, без ночного квалификатора; для `UILaunchScreen`
Apple — набор `bgDark` в `GPColors.xcassets` с одним значением, без вариантов
внешнего вида. Оба ресурса берут существующий `color.bg` тёмной темы. ОС рисует
заставку до запуска процесса, а приложение по умолчанию тёмное
(решение Даши 10.10.2026): эти ресурсы предотвращают светлую вспышку при
светлой теме системы. Новых значений палитры нет.

Compose: вместе с `GpLightColors` / `GpDarkColors` выбирать
`GpLightTheme` / `GpDarkTheme` и `GpTypography.light(family, monoFamily)` /
`.dark(family, monoFamily)`. Фабрики связывают тонкие роли с нужным весом.
Файлы шрифтов добавляются при переводе приложений.

`glow` на обеих нативных платформах хранит цвет, смещения, радиус размытия
и `spread`. Последний нужен для расширения слоя перед размытием; его нельзя
потерять при переносе в механизм теней платформы.
