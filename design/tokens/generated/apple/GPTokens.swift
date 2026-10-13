// Сгенерировано design/tokens/build.mjs из design/tokens/src — руками не править.
// Цвета — в GPColors.xcassets (Color(.text), Color(.text2)…), внешний вид выбирает система.
// GPType.light/dark и GPThemeTokens.light/dark сохранены для совместимости; веса совпадают, свечение нулевое.
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
    public static let s: CGFloat = 12
    /// Варианты ответа и средние карточки: --r-m.
    public static let m: CGFloat = 18
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
    public static let button: CGFloat = 54
    /// Переключатель экзамена.
    public static let examSwitch: CGFloat = 40
    /// Строка раздела.
    public static let sectionRow: CGFloat = 64
    /// Карточка второго плана.
    public static let sideCard: CGFloat = 60
    /// Вариант ответа.
    public static let opt: CGFloat = 54
    /// Иконка .ic.
    public static let icon: CGFloat = 22
    /// Малая иконка .ic-sm.
    public static let iconSm: CGFloat = 18
    /// Круглая кнопка с иконкой.
    public static let iconButton: CGFloat = 44
    /// Точка цвета раздела.
    public static let sectionMark: CGFloat = 9
    /// Полоса продвижения сессии.
    public static let sessionBar: CGFloat = 4
    /// Строка навигации на широком экране.
    public static let navItemWide: CGFloat = 46
    /// Разделители и тонкие рамки.
    public static let hairline: CGFloat = 1
}

/// Раскладка, pt. breakpointWide — граница компактной и широкой раскладки.
public enum GPLayout {
    /// Боковые поля .frame .main на телефоне.
    public static let gutter: CGFloat = 20
    /// Боковые поля .frame .main на компьютере.
    public static let gutterWide: CGFloat = 56
    /// Верхнее поле основного содержимого.
    public static let mainTop: CGFloat = 0
    /// Верхнее поле основного содержимого на компьютере.
    public static let mainTopWide: CGFloat = 44
    /// Место под нижнюю навигацию.
    public static let mainBottomNav: CGFloat = 112
    /// Нижнее поле навигации.
    public static let navBottom: CGFloat = 30
    /// Ширина боковой навигации.
    public static let sidebarWidth: CGFloat = 248
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

/// Параметры тени, pt. В стиле B glow прозрачен и имеет нулевые размеры.
public struct GPShadow: Sendable {
    public let color: Color
    public let offsetX: CGFloat
    public let offsetY: CGFloat
    public let blur: CGFloat
    public let spread: CGFloat
}

/// Совместимость с прежними темами: thin устарел и равен 800, glow устарел и нулевой.
public struct GPThemeTokens: Sendable {
    public let thin: Font.Weight
    public let glow: GPShadow

    public static let light = GPThemeTokens(
        thin: .heavy,
        glow: GPShadow(color: Color(.sRGB, red: 0, green: 0, blue: 0, opacity: 0), offsetX: 0, offsetY: 0, blur: 0, spread: 0)
    )

    public static let dark = GPThemeTokens(
        thin: .heavy,
        glow: GPShadow(color: Color(.sRGB, red: 0, green: 0, blue: 0, opacity: 0), offsetX: 0, offsetY: 0, blur: 0, spread: 0)
    )
}

/// Роли Onest; IPA — IBM Plex Mono. Wide — та же роль в широкой раскладке (iPad, Mac).
public struct GPType: Sendable {
    public static let fontFamily = "Onest"
    public static let monoFontFamily = "IBM Plex Mono"
    public static let mathFontFamily = "Source Serif 4"
    public static let mathFontFallbacks = ["Georgia", "serif"]
    /// Системный шрифт: кнопка «Вход с Apple» (правила Apple) и невидимый измеритель MainButton Telegram (клиент рисует её системным шрифтом)
    public static func systemFont(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
    /// Настройка «Крупнее»: множитель размера поверх Dynamic Type.
    public static let textScaleLarge: CGFloat = 1.125
    /// Профиль .frame из design/app-b/index.html.
    public let body: GPTextStyle
    /// Профиль .h1 из design/app-b/index.html.
    public let h1: GPTextStyle
    /// Профиль .h1 из design/app-b/index.html.
    public let h1Wide: GPTextStyle
    /// Профиль .h2 из design/app-b/index.html.
    public let h2: GPTextStyle
    /// Профиль .h3 из design/app-b/index.html.
    public let h3: GPTextStyle
    /// Подпись над заголовком; также legend и rel-label.
    public let eyebrow: GPTextStyle
    /// Вводный текст .lead.
    public let lead: GPTextStyle
    /// Профиль .btn из design/app-b/index.html.
    public let button: GPTextStyle
    /// Профиль .exam-switch из design/app-b/index.html.
    public let examSwitch: GPTextStyle
    /// Профиль .start-title из design/app-b/index.html.
    public let startTitle: GPTextStyle
    /// Профиль .start-title из design/app-b/index.html.
    public let startTitleWide: GPTextStyle
    /// Подписи start-meta, session-meta, q-instr.
    public let meta: GPTextStyle
    /// Профиль .row-body b из design/app-b/index.html.
    public let sectionName: GPTextStyle
    /// section-types, section-stat small, score-note.
    public let caption: GPTextStyle
    /// Профиль .stat b из design/app-b/index.html.
    public let sectionStat: GPTextStyle
    /// Профиль .stat b из design/app-b/index.html.
    public let sectionStatWide: GPTextStyle
    /// Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ.
    public let sessionCount: GPTextStyle
    /// Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ.
    public let sessionCountWide: GPTextStyle
    /// Профиль .q-text из design/app-b/index.html.
    public let qText: GPTextStyle
    /// Профиль .q-text из design/app-b/index.html.
    public let qTextWide: GPTextStyle
    /// Профиль .opt из design/app-b/index.html.
    public let opt: GPTextStyle
    /// Профиль .ans из design/app-b/index.html.
    public let answer: GPTextStyle
    /// Профиль .explain-body из design/app-b/index.html.
    public let explainBody: GPTextStyle
    /// Профиль .link-row из design/app-b/index.html.
    public let action: GPTextStyle
    /// Профиль .seg button из design/app-b/index.html.
    public let seg: GPTextStyle
    /// Профиль .x-label из design/app-b/index.html.
    public let scoreLabel: GPTextStyle
    /// Профиль .metric-num из design/app-b/index.html.
    public let scoreNum: GPTextStyle
    /// Профиль .metric-num из design/app-b/index.html.
    public let scoreNumWide: GPTextStyle
    /// Профиль .stat b из design/app-b/index.html.
    public let statValue: GPTextStyle
    /// Профиль .h2 из design/app-b/index.html.
    public let examTitle: GPTextStyle
    /// Профиль .h2 из design/app-b/index.html.
    public let examTitleWide: GPTextStyle
    /// Профиль .exam-tile из design/app-b/index.html.
    public let examName: GPTextStyle
    /// Профиль .exam-tile из design/app-b/index.html.
    public let examNameWide: GPTextStyle
    /// Псевдоним num-m для совместимости платформ; значения задаёт общая ступень.
    public let headword: GPTextStyle
    /// Псевдоним num-l-wide для совместимости платформ; значения задаёт общая ступень.
    public let headwordWide: GPTextStyle
    /// Профиль .sense-en из design/app-b/index.html.
    public let senseEn: GPTextStyle
    /// Профиль .word-meta из design/app-b/index.html.
    public let wordMeta: GPTextStyle
    /// Профиль .example из design/app-b/index.html.
    public let example: GPTextStyle
    /// Профиль .nav-item из design/app-b/index.html.
    public let navLabel: GPTextStyle
    /// Профиль .nav-item из design/app-b/index.html.
    public let navLabelWide: GPTextStyle
    /// Транскрипция: IBM Plex Mono.
    public let ipa: GPTextStyle
    /// Профиль .week b из design/app-b/index.html.
    public let weekCount: GPTextStyle
    /// Подпись крупного результата: основной и компактный итоги тренировки.
    public let numLabel: GPTextStyle
    /// Подпись основного результата на широком экране.
    public let numLabelWide: GPTextStyle
    /// Профиль .today-num span из design/app-b/index.html.
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
    /// Профиль .h1 из design/app-b/index.html.
    public let h1CompactWide: GPTextStyle
    /// .frame .l-ctw-text в screens/l.css.
    public let completeWordsText: GPTextStyle
    /// .frame .l-ctw-text в screens/l.css; широкая раскладка от 900 px.
    public let completeWordsTextWide: GPTextStyle
    /// .frame .l-frame в screens/l.css.
    public let sentenceAssembly: GPTextStyle
    /// .frame .l-frame в screens/l.css; широкая раскладка от 900 px.
    public let sentenceAssemblyWide: GPTextStyle
    /// Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ.
    public let numS: GPTextStyle
    /// Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ.
    public let numSWide: GPTextStyle
    /// Профиль .headword из design/app-b/index.html.
    public let numM: GPTextStyle
    /// Профиль .headword из design/app-b/index.html.
    public let numMWide: GPTextStyle
    /// Профиль .today-num b из design/app-b/index.html.
    public let numL: GPTextStyle
    /// Профиль .today-num b из design/app-b/index.html.
    public let numLWide: GPTextStyle
    /// Профиль .x-num из design/app-b/index.html.
    public let numXl: GPTextStyle
    /// Профиль .x-num из design/app-b/index.html.
    public let numXlWide: GPTextStyle
    /// Профиль .sum-num из design/app-b/index.html.
    public let numXxl: GPTextStyle
    /// Профиль .sum-num из design/app-b/index.html.
    public let numXxlWide: GPTextStyle
    /// Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ.
    public let numCompact: GPTextStyle
    /// Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ.
    public let numCompactWide: GPTextStyle
    /// Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ.
    public let wordTitle: GPTextStyle
    /// Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ.
    public let wordTitleWide: GPTextStyle

    public static let light = GPType(theme: .light)
    public static let dark = GPType(theme: .dark)

    private init(theme: GPThemeTokens) {
        body = GPTextStyle(size: 16, lineHeight: 23.2, weight: .regular, tracking: 0, relativeTo: .body, fontFamily: "Onest")
        h1 = GPTextStyle(size: 34, lineHeight: 35.36, weight: .heavy, tracking: -0.035, relativeTo: .largeTitle, fontFamily: "Onest")
        h1Wide = GPTextStyle(size: 44, lineHeight: 45.76, weight: .heavy, tracking: -0.035, relativeTo: .largeTitle, fontFamily: "Onest")
        h2 = GPTextStyle(size: 22, lineHeight: 25.3, weight: .heavy, tracking: -0.025, relativeTo: .title3, fontFamily: "Onest")
        h3 = GPTextStyle(size: 17, lineHeight: 22.1, weight: .bold, tracking: -0.01, relativeTo: .headline, fontFamily: "Onest")
        eyebrow = GPTextStyle(size: 13, lineHeight: 18.85, weight: .medium, tracking: 0, relativeTo: .caption, fontFamily: "Onest")
        lead = GPTextStyle(size: 17, lineHeight: 24.65, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Onest")
        button = GPTextStyle(size: 16.5, lineHeight: 23.925, weight: .bold, tracking: -0.01, relativeTo: .headline, fontFamily: "Onest")
        examSwitch = GPTextStyle(size: 15, lineHeight: 21.75, weight: .bold, tracking: -0.005, relativeTo: .subheadline, fontFamily: "Onest")
        startTitle = GPTextStyle(size: 28, lineHeight: 29.4, weight: .heavy, tracking: -0.035, relativeTo: .largeTitle, fontFamily: "Onest")
        startTitleWide = GPTextStyle(size: 34, lineHeight: 35.7, weight: .heavy, tracking: -0.035, relativeTo: .largeTitle, fontFamily: "Onest")
        meta = GPTextStyle(size: 14, lineHeight: 20.3, weight: .regular, tracking: -0.005, relativeTo: .footnote, fontFamily: "Onest")
        sectionName = GPTextStyle(size: 16.5, lineHeight: 23.925, weight: .semibold, tracking: -0.01, relativeTo: .headline, fontFamily: "Onest")
        caption = GPTextStyle(size: 13, lineHeight: 18.85, weight: .regular, tracking: -0.005, relativeTo: .caption, fontFamily: "Onest")
        sectionStat = GPTextStyle(size: 16, lineHeight: 23.2, weight: .bold, tracking: 0, relativeTo: .title2, fontFamily: "Onest")
        sectionStatWide = GPTextStyle(size: 16, lineHeight: 23.2, weight: .bold, tracking: 0, relativeTo: .title2, fontFamily: "Onest")
        sessionCount = GPTextStyle(size: 22, lineHeight: 31.9, weight: .heavy, tracking: -0.04, relativeTo: .title3, fontFamily: "Onest")
        sessionCountWide = GPTextStyle(size: 26, lineHeight: 37.7, weight: .heavy, tracking: -0.04, relativeTo: .title3, fontFamily: "Onest")
        qText = GPTextStyle(size: 20, lineHeight: 32.4, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Onest")
        qTextWide = GPTextStyle(size: 20, lineHeight: 32.4, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Onest")
        opt = GPTextStyle(size: 17, lineHeight: 24.65, weight: .medium, tracking: 0, relativeTo: .body, fontFamily: "Onest")
        answer = GPTextStyle(size: 15, lineHeight: 21.75, weight: .semibold, tracking: 0, relativeTo: .callout, fontFamily: "Onest")
        explainBody = GPTextStyle(size: 16, lineHeight: 25.28, weight: .regular, tracking: 0, relativeTo: .body, fontFamily: "Onest")
        action = GPTextStyle(size: 15, lineHeight: 21.75, weight: .semibold, tracking: 0, relativeTo: .callout, fontFamily: "Onest")
        seg = GPTextStyle(size: 13, lineHeight: 18.85, weight: .bold, tracking: 0.02, relativeTo: .caption, fontFamily: "Onest")
        scoreLabel = GPTextStyle(size: 14, lineHeight: 20.3, weight: .semibold, tracking: 0, relativeTo: .caption, fontFamily: "Onest")
        scoreNum = GPTextStyle(size: 30, lineHeight: 31.5, weight: .heavy, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Onest")
        scoreNumWide = GPTextStyle(size: 30, lineHeight: 31.5, weight: .heavy, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Onest")
        statValue = GPTextStyle(size: 16, lineHeight: 23.2, weight: .bold, tracking: 0, relativeTo: .body, fontFamily: "Onest")
        examTitle = GPTextStyle(size: 22, lineHeight: 25.3, weight: .heavy, tracking: -0.025, relativeTo: .largeTitle, fontFamily: "Onest")
        examTitleWide = GPTextStyle(size: 22, lineHeight: 25.3, weight: .heavy, tracking: -0.025, relativeTo: .largeTitle, fontFamily: "Onest")
        examName = GPTextStyle(size: 16, lineHeight: 23.2, weight: .heavy, tracking: -0.02, relativeTo: .largeTitle, fontFamily: "Onest")
        examNameWide = GPTextStyle(size: 16, lineHeight: 23.2, weight: .heavy, tracking: -0.02, relativeTo: .largeTitle, fontFamily: "Onest")
        headword = GPTextStyle(size: 52, lineHeight: 50.96, weight: .heavy, tracking: -0.045, relativeTo: .largeTitle, fontFamily: "Onest")
        headwordWide = GPTextStyle(size: 52, lineHeight: 50.96, weight: .heavy, tracking: -0.045, relativeTo: .largeTitle, fontFamily: "Onest")
        senseEn = GPTextStyle(size: 18, lineHeight: 26.1, weight: .regular, tracking: 0, relativeTo: .body, fontFamily: "Onest")
        wordMeta = GPTextStyle(size: 15, lineHeight: 21.75, weight: .regular, tracking: 0, relativeTo: .callout, fontFamily: "Onest")
        example = GPTextStyle(size: 15.5, lineHeight: 22.475, weight: .regular, tracking: 0, relativeTo: .body, fontFamily: "Onest")
        navLabel = GPTextStyle(size: 11.5, lineHeight: 16.675, weight: .semibold, tracking: 0.005, relativeTo: .caption2, fontFamily: "Onest")
        navLabelWide = GPTextStyle(size: 15.5, lineHeight: 22.475, weight: .semibold, tracking: 0.005, relativeTo: .caption2, fontFamily: "Onest")
        ipa = GPTextStyle(size: 14, lineHeight: 20.3, weight: .regular, tracking: -0.005, relativeTo: .footnote, fontFamily: "IBM Plex Mono")
        weekCount = GPTextStyle(size: 26, lineHeight: 37.7, weight: .heavy, tracking: -0.035, relativeTo: .title2, fontFamily: "Onest")
        numLabel = GPTextStyle(size: 20, lineHeight: 24, weight: .medium, tracking: -0.015, relativeTo: .title2, fontFamily: "Onest")
        numLabelWide = GPTextStyle(size: 28, lineHeight: 33.6, weight: .medium, tracking: -0.015, relativeTo: .title2, fontFamily: "Onest")
        numUnit = GPTextStyle(size: 22, lineHeight: 31.9, weight: .heavy, tracking: -0.025, relativeTo: .title3, fontFamily: "Onest")
        promptTitle = GPTextStyle(size: 24, lineHeight: 30, weight: .semibold, tracking: -0.015, relativeTo: .title2, fontFamily: "Onest")
        promptTitleWide = GPTextStyle(size: 28, lineHeight: 29.4, weight: .heavy, tracking: -0.035, relativeTo: .title2, fontFamily: "Onest")
        inputCompact = GPTextStyle(size: 17, lineHeight: 17, weight: .medium, tracking: 0, relativeTo: .body, fontFamily: "Onest")
        inputCompactWide = GPTextStyle(size: 19, lineHeight: 19, weight: .medium, tracking: 0, relativeTo: .body, fontFamily: "Onest")
        inputLetter = GPTextStyle(size: 26, lineHeight: 37.7, weight: .medium, tracking: -0.0031, relativeTo: .title2, fontFamily: "Onest")
        inputDisplay = GPTextStyle(size: 26, lineHeight: 31.2, weight: .medium, tracking: 0.01, relativeTo: .title2, fontFamily: "Onest")
        h1Compact = GPTextStyle(size: 34, lineHeight: 35.36, weight: .heavy, tracking: -0.035, relativeTo: .largeTitle, fontFamily: "Onest")
        h1CompactWide = GPTextStyle(size: 44, lineHeight: 45.76, weight: .heavy, tracking: -0.035, relativeTo: .largeTitle, fontFamily: "Onest")
        completeWordsText = GPTextStyle(size: 18, lineHeight: 38.7, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Onest")
        completeWordsTextWide = GPTextStyle(size: 22, lineHeight: 48.4, weight: .regular, tracking: -0.005, relativeTo: .body, fontFamily: "Onest")
        sentenceAssembly = GPTextStyle(size: 20, lineHeight: 46, weight: .regular, tracking: -0.004, relativeTo: .body, fontFamily: "Onest")
        sentenceAssemblyWide = GPTextStyle(size: 24, lineHeight: 55.2, weight: .regular, tracking: -0.0033, relativeTo: .body, fontFamily: "Onest")
        numS = GPTextStyle(size: 48, lineHeight: 48, weight: .heavy, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Onest")
        numSWide = GPTextStyle(size: 60, lineHeight: 60, weight: .heavy, tracking: -0.04, relativeTo: .largeTitle, fontFamily: "Onest")
        numM = GPTextStyle(size: 52, lineHeight: 50.96, weight: .heavy, tracking: -0.045, relativeTo: .largeTitle, fontFamily: "Onest")
        numMWide = GPTextStyle(size: 52, lineHeight: 50.96, weight: .heavy, tracking: -0.045, relativeTo: .largeTitle, fontFamily: "Onest")
        numL = GPTextStyle(size: 64, lineHeight: 57.6, weight: .heavy, tracking: -0.05, relativeTo: .largeTitle, fontFamily: "Onest")
        numLWide = GPTextStyle(size: 64, lineHeight: 57.6, weight: .heavy, tracking: -0.05, relativeTo: .largeTitle, fontFamily: "Onest")
        numXl = GPTextStyle(size: 68, lineHeight: 64.6, weight: .heavy, tracking: -0.05, relativeTo: .largeTitle, fontFamily: "Onest")
        numXlWide = GPTextStyle(size: 68, lineHeight: 64.6, weight: .heavy, tracking: -0.05, relativeTo: .largeTitle, fontFamily: "Onest")
        numXxl = GPTextStyle(size: 120, lineHeight: 96, weight: .heavy, tracking: -0.055, relativeTo: .largeTitle, fontFamily: "Onest")
        numXxlWide = GPTextStyle(size: 120, lineHeight: 96, weight: .heavy, tracking: -0.055, relativeTo: .largeTitle, fontFamily: "Onest")
        numCompact = GPTextStyle(size: 36, lineHeight: 37.8, weight: .heavy, tracking: -0.04, relativeTo: .title, fontFamily: "Onest")
        numCompactWide = GPTextStyle(size: 52, lineHeight: 54.6, weight: .heavy, tracking: -0.04, relativeTo: .title, fontFamily: "Onest")
        wordTitle = GPTextStyle(size: 40, lineHeight: 44, weight: .heavy, tracking: -0.045, relativeTo: .largeTitle, fontFamily: "Onest")
        wordTitleWide = GPTextStyle(size: 56, lineHeight: 61.6, weight: .heavy, tracking: -0.045, relativeTo: .largeTitle, fontFamily: "Onest")
    }
}

/// Движение. Длительности — секунды; при «Уменьшить движение» анимации нажатия и появления выключаются.
public enum GPMotion {
    public static let press: Double = 0.14
    public static let reveal: Double = 0.24
    public static let pulse: Double = 1.6
    public static let pressScale: CGFloat = 0.97
    public static func easeOut(duration: Double) -> Animation {
        .timingCurve(0.23, 1, 0.32, 1, duration: duration)
    }
}
