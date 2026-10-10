// Сгенерировано design/tokens/build.mjs из design/tokens/src — руками не править.
// Цвета — в GPColors.xcassets (Color(.text), Color(.text2)…), внешний вид выбирает система.
// Для тонких ролей и свечения вместе с ним выбирайте GPType.light/dark и GPThemeTokens.light/dark.
import SwiftUI

/// Отступы и промежутки, pt.
public enum GPSpace {
    public static let s2: CGFloat = 2
    public static let s4: CGFloat = 4
    public static let s6: CGFloat = 6
    public static let s8: CGFloat = 8
    public static let s10: CGFloat = 10
    public static let s12: CGFloat = 12
    public static let s14: CGFloat = 14
    public static let s16: CGFloat = 16
    public static let s20: CGFloat = 20
    public static let s24: CGFloat = 24
    public static let s28: CGFloat = 28
    public static let s32: CGFloat = 32
    public static let s40: CGFloat = 40
    public static let s48: CGFloat = 48
    public static let s56: CGFloat = 56
    public static let s64: CGFloat = 64
    public static let s72: CGFloat = 72
}

/// Радиусы скругления, pt. full — капсула: используйте Capsule().
public enum GPRadius {
    /// Малые элементы: --r-s.
    public static let s: CGFloat = 10
    /// Варианты ответа и средние карточки: --r-m.
    public static let m: CGFloat = 16
    /// Карточки и сгруппированные списки: --r-l.
    public static let l: CGFloat = 24
    /// Кнопки и переключатель экзамена: пилюля.
    public static let full: CGFloat = 999
}

/// Размеры элементов, pt.
public enum GPSize {
    /// Минимум для нажатия.
    public static let tapTarget: CGFloat = 44
    /// Кнопка действия .frame .btn.
    public static let button: CGFloat = 52
    /// Переключатель экзамена.
    public static let examSwitch: CGFloat = 40
    /// Строка раздела.
    public static let sectionRow: CGFloat = 64
    /// Карточка второго плана.
    public static let sideCard: CGFloat = 60
    /// Вариант ответа.
    public static let opt: CGFloat = 52
    /// Иконка .ic.
    public static let icon: CGFloat = 22
    /// Малая иконка .ic-sm.
    public static let iconSm: CGFloat = 16
    /// Круглая кнопка с иконкой.
    public static let iconButton: CGFloat = 44
    /// Точка цвета раздела.
    public static let sectionMark: CGFloat = 10
    /// Полоса продвижения сессии.
    public static let sessionBar: CGFloat = 3
    /// Строка навигации на широком экране.
    public static let navItemWide: CGFloat = 46
    /// Разделители и тонкие рамки.
    public static let hairline: CGFloat = 1
}

/// Раскладка, pt. breakpointWide — граница компактной и широкой раскладки.
public enum GPLayout {
    /// Боковые поля .frame .main на телефоне.
    public static let gutter: CGFloat = 22
    /// Боковые поля .frame .main на компьютере.
    public static let gutterWide: CGFloat = 64
    /// Верхнее поле основного содержимого.
    public static let mainTop: CGFloat = 12
    /// Верхнее поле основного содержимого на компьютере.
    public static let mainTopWide: CGFloat = 44
    /// Место под нижнюю навигацию.
    public static let mainBottomNav: CGFloat = 96
    /// Нижнее поле навигации.
    public static let navBottom: CGFloat = 28
    /// Ширина боковой навигации.
    public static let sidebarWidth: CGFloat = 232
    /// Максимальная ширина слова и его разбора.
    public static let contentMax: CGFloat = 720
    /// Граница широкой раскладки каталога.
    public static let breakpointWide: CGFloat = 900
    /// Колонка входа на широком экране: .t-signin-buttons в каталоге.
    public static let authColumnMax: CGFloat = 400
    /// Узкая колонка поясняющего текста на экранах состояний: ошибка, «нет сети».
    public static let textMax: CGFloat = 320
    /// до перестройки сессии по R1–R20 (часть 3 редизайна)
    public static let sessionMax: CGFloat = 1040
}

/// Прозрачность состояний элементов.
public enum GPOpacity {
    public static let disabled: Double = 0.5
}

/// Типографика кнопки Google по правилам Google. Размер и разрядка — pt.
public enum GPSignInGoogle {
    public static let fontFamily = "Roboto"
    public static let fontFallbacks = ["sans-serif"]
    public static let fontSize: CGFloat = 14
    public static let fontWeight: Font.Weight = .medium
    public static let tracking: CGFloat = 0.25
    public static let lineHeight: CGFloat = 20
}

/// Типографика кнопки Apple. Семейство — системное; размер и межстрочный — pt.
public enum GPSignInApple {
    public static let fontSize: CGFloat = 17
    public static let fontWeight: Font.Weight = .medium
    public static let lineHeight: CGFloat = 20
    public static var font: Font {
        GPType.systemFont(size: fontSize, weight: fontWeight)
    }
}

/// Роль текста: размер и межстрочный — pt, трекинг — доля размера (em), relativeTo — с каким стилем Dynamic Type растёт.
public struct GPTextStyle: Sendable {
    public let size: CGFloat
    public let lineHeight: CGFloat
    public let weight: Font.Weight
    public let tracking: CGFloat
    public let relativeTo: Font.TextStyle
    public let fontFamily: String
}

/// Свечение: параметры каталога, pt. spread сохраняется отдельно для отрисовки расширенного слоя.
public struct GPShadow: Sendable {
    public let color: Color
    public let offsetX: CGFloat
    public let offsetY: CGFloat
    public let blur: CGFloat
    public let spread: CGFloat
}

/// Тематический вес и свечение: выбираются одновременно с внешним видом цветов.
public struct GPThemeTokens: Sendable {
    public let thin: Font.Weight
    public let glow: GPShadow

    public static let light = GPThemeTokens(
        thin: .light,
        glow: GPShadow(color: Color(.sRGB, red: 0.2314, green: 0.2471, blue: 0.6902, opacity: 0.4), offsetX: 0, offsetY: 10, blur: 28, spread: -8)
    )

    public static let dark = GPThemeTokens(
        thin: .ultraLight,
        glow: GPShadow(color: Color(.sRGB, red: 0.3608, green: 0.8118, blue: 1, opacity: 0.5), offsetX: 0, offsetY: 10, blur: 32, spread: -6)
    )
}

/// Роли Geologica; IPA — IBM Plex Mono. Wide — та же роль в широкой раскладке (iPad, Mac).
public struct GPType: Sendable {
    public static let fontFamily = "Geologica"
    public static let monoFontFamily = "IBM Plex Mono"
    public static let mathFontFamily = "Source Serif 4"
    public static let mathFontFallbacks = ["Georgia", "serif"]
    /// Системный шрифт: кнопка «Вход с Apple» (правила Apple) и невидимый измеритель MainButton Telegram (клиент рисует её системным шрифтом)
    public static func systemFont(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
    /// Настройка «Крупнее»: множитель размера поверх Dynamic Type.
    public static let textScaleLarge: CGFloat = 1.125
    /// Основной текст .frame.
    public let body: GPTextStyle
    /// Заголовок экрана .frame .h1.
    public let h1: GPTextStyle
    public let h1Wide: GPTextStyle
    /// Заголовок карточки .frame .h2.
    public let h2: GPTextStyle
    /// Подзаголовок .frame .h3.
    public let h3: GPTextStyle
    /// Подпись над заголовком; также legend и rel-label.
    public let eyebrow: GPTextStyle
    /// Вводный текст .lead.
    public let lead: GPTextStyle
    /// Текст кнопки .frame .btn.
    public let button: GPTextStyle
    /// Переключатель экзамена.
    public let examSwitch: GPTextStyle
    /// Заголовок карточки тренировки.
    public let startTitle: GPTextStyle
    public let startTitleWide: GPTextStyle
    /// Подписи start-meta, session-meta, q-instr.
    public let meta: GPTextStyle
    /// Название раздела.
    public let sectionName: GPTextStyle
    /// section-types, section-stat small, score-note.
    public let caption: GPTextStyle
    /// Тонкие цифры статистики раздела.
    public let sectionStat: GPTextStyle
    public let sectionStatWide: GPTextStyle
    /// Тонкий счётчик сессии.
    public let sessionCount: GPTextStyle
    public let sessionCountWide: GPTextStyle
    /// Итоговое правило .frame .q-text; базовые 19/1.55 переопределены.
    public let qText: GPTextStyle
    public let qTextWide: GPTextStyle
    /// Вариант ответа .frame .opt.
    public let opt: GPTextStyle
    /// Ответ .frame .ans.
    public let answer: GPTextStyle
    /// Текст разбора .explain-body.
    public let explainBody: GPTextStyle
    /// Ссылка на тему .topic-link; чип .chip.
    public let action: GPTextStyle
    /// Переключатель языка разбора.
    public let seg: GPTextStyle
    /// Подпись балла.
    public let scoreLabel: GPTextStyle
    /// Тонкий балл прогресса.
    public let scoreNum: GPTextStyle
    public let scoreNumWide: GPTextStyle
    /// Тонкие цифры точности и истории .acc-val, .hist-res.
    public let statValue: GPTextStyle
    /// Заголовок выбора экзамена.
    public let examTitle: GPTextStyle
    public let examTitleWide: GPTextStyle
    /// Псевдоним num-s для совместимости платформ; значения задаёт общая ступень.
    public let examName: GPTextStyle
    /// Псевдоним num-s-wide для совместимости платформ; значения задаёт общая ступень.
    public let examNameWide: GPTextStyle
    /// Псевдоним num-m для совместимости платформ; значения задаёт общая ступень.
    public let headword: GPTextStyle
    /// Псевдоним num-l-wide для совместимости платформ; значения задаёт общая ступень.
    public let headwordWide: GPTextStyle
    /// Значение слова на английском.
    public let senseEn: GPTextStyle
    /// Метаданные слова.
    public let wordMeta: GPTextStyle
    /// Пример употребления.
    public let example: GPTextStyle
    /// Подпись нижней навигации.
    public let navLabel: GPTextStyle
    public let navLabelWide: GPTextStyle
    /// Транскрипция: IBM Plex Mono.
    public let ipa: GPTextStyle
    /// Тонкий счётчик недели на компьютере.
    public let weekCount: GPTextStyle
    /// Подпись крупного результата: основной и компактный итоги тренировки.
    public let numLabel: GPTextStyle
    /// Подпись основного результата на широком экране.
    public let numLabelWide: GPTextStyle
    /// Единица счёта: число слов на старте и в итоге изучения.
    public let numUnit: GPTextStyle
    /// Заголовок задания слов: перевод в нескольких упражнениях.
    public let promptTitle: GPTextStyle
    /// Широкий заголовок задания слов — существующая роль start-title.
    public let promptTitleWide: GPTextStyle
    /// Однострочный ввод: поиск слова и ячейки Complete the Words.
    public let inputCompact: GPTextStyle
    /// Однострочный ввод на широком экране.
    public let inputCompactWide: GPTextStyle
    /// Буквы: сборка слова и сравнение введённого ответа; один размер для обоих экранов.
    public let inputLetter: GPTextStyle
    /// Ввод ответа словом: несколько упражнений W12–W14.
    public let inputDisplay: GPTextStyle
    /// Компактный заголовок прогресса: на телефоне совпадает с h1.
    public let h1Compact: GPTextStyle
    /// Компактный заголовок на широких экранах G1 и G6.
    public let h1CompactWide: GPTextStyle
    /// .frame .l-ctw-text в screens/l.css.
    public let completeWordsText: GPTextStyle
    /// .frame .l-ctw-text в screens/l.css; широкая раскладка от 900 px.
    public let completeWordsTextWide: GPTextStyle
    /// .frame .l-frame в screens/l.css.
    public let sentenceAssembly: GPTextStyle
    /// .frame .l-frame в screens/l.css; широкая раскладка от 900 px.
    public let sentenceAssemblyWide: GPTextStyle
    /// Малое крупное число или короткое слово.
    public let numS: GPTextStyle
    /// Малое крупное число или короткое слово. Широкий профиль.
    public let numSWide: GPTextStyle
    /// Среднее крупное число или слово.
    public let numM: GPTextStyle
    /// Среднее крупное число или слово. Широкий профиль.
    public let numMWide: GPTextStyle
    /// Крупная статистика, компактный итог и обратный отсчёт.
    public let numL: GPTextStyle
    /// Крупная статистика, компактный итог и обратный отсчёт. Широкий профиль.
    public let numLWide: GPTextStyle
    /// Баллы и итог изучения слов.
    public let numXl: GPTextStyle
    /// Баллы и итог изучения слов. Широкий профиль.
    public let numXlWide: GPTextStyle
    /// Основное число итогового экрана.
    public let numXxl: GPTextStyle
    /// Основное число итогового экрана. Широкий профиль.
    public let numXxlWide: GPTextStyle
    /// Промежуточное малое число, которое не попало в роли ядра.
    public let numCompact: GPTextStyle
    /// Широкий промежуточный профиль малого числа.
    public let numCompactWide: GPTextStyle
    /// Слово-заголовок, не попавшее в крупную числовую шкалу.
    public let wordTitle: GPTextStyle
    /// Широкий профиль слова-заголовка вне числовой шкалы.
    public let wordTitleWide: GPTextStyle

    public static let light = GPType(theme: .light)
    public static let dark = GPType(theme: .dark)

    private init(theme: GPThemeTokens) {
        body = GPTextStyle(size: 16, lineHeight: 23.2, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Geologica")
        h1 = GPTextStyle(size: 34, lineHeight: 39.1, weight: .semibold, tracking: -0.03, relativeTo: .largeTitle, fontFamily: "Geologica")
        h1Wide = GPTextStyle(size: 44, lineHeight: 50.6, weight: .semibold, tracking: -0.03, relativeTo: .largeTitle, fontFamily: "Geologica")
        h2 = GPTextStyle(size: 19, lineHeight: 23.75, weight: .semibold, tracking: -0.015, relativeTo: .title3, fontFamily: "Geologica")
        h3 = GPTextStyle(size: 16, lineHeight: 20.8, weight: .semibold, tracking: -0.01, relativeTo: .headline, fontFamily: "Geologica")
        eyebrow = GPTextStyle(size: 13, lineHeight: 18.85, weight: .medium, tracking: 0, relativeTo: .caption, fontFamily: "Geologica")
        lead = GPTextStyle(size: 17, lineHeight: 24.65, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Geologica")
        button = GPTextStyle(size: 16, lineHeight: 23.2, weight: .semibold, tracking: 0.005, relativeTo: .headline, fontFamily: "Geologica")
        examSwitch = GPTextStyle(size: 14, lineHeight: 20.3, weight: .semibold, tracking: 0.02, relativeTo: .subheadline, fontFamily: "Geologica")
        startTitle = GPTextStyle(size: 30, lineHeight: 34.5, weight: .semibold, tracking: -0.03, relativeTo: .largeTitle, fontFamily: "Geologica")
        startTitleWide = GPTextStyle(size: 44, lineHeight: 50.6, weight: .semibold, tracking: -0.035, relativeTo: .largeTitle, fontFamily: "Geologica")
        meta = GPTextStyle(size: 14, lineHeight: 20.3, weight: .regular, tracking: -0.005, relativeTo: .footnote, fontFamily: "Geologica")
        sectionName = GPTextStyle(size: 17, lineHeight: 24.65, weight: .semibold, tracking: -0.01, relativeTo: .headline, fontFamily: "Geologica")
        caption = GPTextStyle(size: 13, lineHeight: 18.85, weight: .regular, tracking: -0.005, relativeTo: .caption, fontFamily: "Geologica")
        sectionStat = GPTextStyle(size: 24, lineHeight: 25.2, weight: theme.thin, tracking: -0.02, relativeTo: .title2, fontFamily: "Geologica")
        sectionStatWide = GPTextStyle(size: 28, lineHeight: 29.4, weight: theme.thin, tracking: -0.02, relativeTo: .title2, fontFamily: "Geologica")
        sessionCount = GPTextStyle(size: 22, lineHeight: 31.9, weight: theme.thin, tracking: -0.02, relativeTo: .title3, fontFamily: "Geologica")
        sessionCountWide = GPTextStyle(size: 26, lineHeight: 37.7, weight: theme.thin, tracking: -0.02, relativeTo: .title3, fontFamily: "Geologica")
        qText = GPTextStyle(size: 20, lineHeight: 32, weight: .regular, tracking: -0.01, relativeTo: .body, fontFamily: "Geologica")
        qTextWide = GPTextStyle(size: 24, lineHeight: 38.4, weight: .regular, tracking: -0.01, relativeTo: .body, fontFamily: "Geologica")
        opt = GPTextStyle(size: 17, lineHeight: 24.65, weight: .medium, tracking: -0.005, relativeTo: .body, fontFamily: "Geologica")
        answer = GPTextStyle(size: 15, lineHeight: 21.75, weight: .medium, tracking: -0.005, relativeTo: .callout, fontFamily: "Geologica")
        explainBody = GPTextStyle(size: 15, lineHeight: 23.25, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Geologica")
        action = GPTextStyle(size: 15, lineHeight: 21.75, weight: .medium, tracking: -0.005, relativeTo: .callout, fontFamily: "Geologica")
        seg = GPTextStyle(size: 13, lineHeight: 18.85, weight: .semibold, tracking: -0.005, relativeTo: .caption, fontFamily: "Geologica")
        scoreLabel = GPTextStyle(size: 13, lineHeight: 18.85, weight: .medium, tracking: -0.005, relativeTo: .caption, fontFamily: "Geologica")
        scoreNum = GPTextStyle(size: 32, lineHeight: 32, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        scoreNumWide = GPTextStyle(size: 44, lineHeight: 44, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        statValue = GPTextStyle(size: 18, lineHeight: 26.1, weight: theme.thin, tracking: -0.02, relativeTo: .body, fontFamily: "Geologica")
        examTitle = GPTextStyle(size: 36, lineHeight: 41.4, weight: .semibold, tracking: -0.03, relativeTo: .largeTitle, fontFamily: "Geologica")
        examTitleWide = GPTextStyle(size: 48, lineHeight: 55.2, weight: .semibold, tracking: -0.03, relativeTo: .largeTitle, fontFamily: "Geologica")
        examName = GPTextStyle(size: 48, lineHeight: 48, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        examNameWide = GPTextStyle(size: 60, lineHeight: 60, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        headword = GPTextStyle(size: 56, lineHeight: 56, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        headwordWide = GPTextStyle(size: 88, lineHeight: 88, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        senseEn = GPTextStyle(size: 20, lineHeight: 28, weight: .regular, tracking: -0.01, relativeTo: .body, fontFamily: "Geologica")
        wordMeta = GPTextStyle(size: 15, lineHeight: 21.75, weight: .regular, tracking: -0.005, relativeTo: .callout, fontFamily: "Geologica")
        example = GPTextStyle(size: 17, lineHeight: 24.65, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Geologica")
        navLabel = GPTextStyle(size: 11, lineHeight: 15.95, weight: .medium, tracking: -0.005, relativeTo: .caption2, fontFamily: "Geologica")
        navLabelWide = GPTextStyle(size: 15, lineHeight: 21.75, weight: .medium, tracking: -0.005, relativeTo: .caption2, fontFamily: "Geologica")
        ipa = GPTextStyle(size: 14, lineHeight: 20.3, weight: .regular, tracking: -0.005, relativeTo: .footnote, fontFamily: "IBM Plex Mono")
        weekCount = GPTextStyle(size: 28, lineHeight: 40.6, weight: theme.thin, tracking: -0.03, relativeTo: .title2, fontFamily: "Geologica")
        numLabel = GPTextStyle(size: 20, lineHeight: 24, weight: .medium, tracking: -0.015, relativeTo: .title2, fontFamily: "Geologica")
        numLabelWide = GPTextStyle(size: 28, lineHeight: 33.6, weight: .medium, tracking: -0.015, relativeTo: .title2, fontFamily: "Geologica")
        numUnit = GPTextStyle(size: 22, lineHeight: 31.9, weight: .semibold, tracking: -0.015, relativeTo: .title3, fontFamily: "Geologica")
        promptTitle = GPTextStyle(size: 24, lineHeight: 30, weight: .semibold, tracking: -0.015, relativeTo: .title2, fontFamily: "Geologica")
        promptTitleWide = GPTextStyle(size: 30, lineHeight: 34.5, weight: .semibold, tracking: -0.03, relativeTo: .title2, fontFamily: "Geologica")
        inputCompact = GPTextStyle(size: 17, lineHeight: 17, weight: .medium, tracking: 0, relativeTo: .body, fontFamily: "Geologica")
        inputCompactWide = GPTextStyle(size: 19, lineHeight: 19, weight: .medium, tracking: 0, relativeTo: .body, fontFamily: "Geologica")
        inputLetter = GPTextStyle(size: 26, lineHeight: 37.7, weight: .medium, tracking: -0.0031, relativeTo: .title2, fontFamily: "Geologica")
        inputDisplay = GPTextStyle(size: 26, lineHeight: 31.2, weight: .medium, tracking: 0.01, relativeTo: .title2, fontFamily: "Geologica")
        h1Compact = GPTextStyle(size: 34, lineHeight: 39.1, weight: .semibold, tracking: -0.03, relativeTo: .largeTitle, fontFamily: "Geologica")
        h1CompactWide = GPTextStyle(size: 40, lineHeight: 46, weight: .semibold, tracking: -0.03, relativeTo: .largeTitle, fontFamily: "Geologica")
        completeWordsText = GPTextStyle(size: 18, lineHeight: 38.7, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Geologica")
        completeWordsTextWide = GPTextStyle(size: 22, lineHeight: 48.4, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Geologica")
        sentenceAssembly = GPTextStyle(size: 20, lineHeight: 46, weight: .regular, tracking: -0.004, relativeTo: .body, fontFamily: "Geologica")
        sentenceAssemblyWide = GPTextStyle(size: 24, lineHeight: 55.2, weight: .regular, tracking: -0.0033, relativeTo: .body, fontFamily: "Geologica")
        numS = GPTextStyle(size: 48, lineHeight: 48, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        numSWide = GPTextStyle(size: 60, lineHeight: 60, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        numM = GPTextStyle(size: 56, lineHeight: 56, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        numMWide = GPTextStyle(size: 72, lineHeight: 72, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        numL = GPTextStyle(size: 70, lineHeight: 70, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        numLWide = GPTextStyle(size: 88, lineHeight: 88, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        numXl = GPTextStyle(size: 88, lineHeight: 83.6, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        numXlWide = GPTextStyle(size: 120, lineHeight: 114, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        numXxl = GPTextStyle(size: 104, lineHeight: 93.6, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        numXxlWide = GPTextStyle(size: 144, lineHeight: 129.6, weight: theme.thin, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Geologica")
        numCompact = GPTextStyle(size: 36, lineHeight: 37.8, weight: theme.thin, tracking: -0.03, relativeTo: .title, fontFamily: "Geologica")
        numCompactWide = GPTextStyle(size: 52, lineHeight: 54.6, weight: theme.thin, tracking: -0.03, relativeTo: .title, fontFamily: "Geologica")
        wordTitle = GPTextStyle(size: 40, lineHeight: 44, weight: theme.thin, tracking: -0.02, relativeTo: .largeTitle, fontFamily: "Geologica")
        wordTitleWide = GPTextStyle(size: 56, lineHeight: 61.6, weight: theme.thin, tracking: -0.02, relativeTo: .largeTitle, fontFamily: "Geologica")
    }
}

/// Движение. Длительности — секунды; при «Уменьшить движение» анимации нажатия и появления выключаются.
public enum GPMotion {
    public static let press: Double = 0.16
    public static let reveal: Double = 0.24
    public static let pulse: Double = 1.6
    public static let pressScale: CGFloat = 0.98
    public static func easeOut(duration: Double) -> Animation {
        .timingCurve(0.2, 0.8, 0.2, 1, duration: duration)
    }
}
