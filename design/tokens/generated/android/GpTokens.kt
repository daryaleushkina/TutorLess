// Сгенерировано design/tokens/build.mjs из design/tokens/src — руками не править.
// Вместе с цветами выбирайте GpLightTheme/GpDarkTheme и GpTypography.light/dark.
package greprep.design

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/** Смысловые цвета. Тема выбирает набор: GpLightColors или GpDarkColors. */
@Immutable
class GpColors(
    val bg: Color,
    val surface: Color,
    val surface2: Color,
    val text: Color,
    val text2: Color,
    val text3: Color,
    val line: Color,
    val lineStrong: Color,
    val accent: Color,
    val onAccent: Color,
    val accentSoft: Color,
    val focus: Color,
    val right: Color,
    val rightSoft: Color,
    val wrong: Color,
    val wrongSoft: Color,
    val verbal: Color,
    val verbalSoft: Color,
    val quant: Color,
    val quantSoft: Color,
    val essay: Color,
    val essaySoft: Color,
    val words: Color,
    val wordsSoft: Color,
    val exam: Color,
    val examSoft: Color,
    val navBg: Color,
    val reading: Color,
    val readingSoft: Color,
    val listening: Color,
    val listeningSoft: Color,
    val writing: Color,
    val writingSoft: Color,
    val speaking: Color,
    val speakingSoft: Color,
    val signInAppleBg: Color,
    val signInAppleText: Color,
    val signInGoogleBg: Color,
    val signInGoogleStroke: Color,
    val signInGoogleText: Color,
)

val GpLightColors = GpColors(
    bg = Color(0xFFE2E3F1),
    surface = Color(0xFFEEEFF8),
    surface2 = Color(0xFFD4D6EA),
    text = Color(0xFF11132E),
    text2 = Color(0xFF454A6E),
    text3 = Color(0xFF4F5579),
    line = Color(0x1A11132E),
    lineStrong = Color(0x3811132E),
    accent = Color(0xFF3B3FB0),
    onAccent = Color(0xFFFFFFFF),
    accentSoft = Color(0x1A3B3FB0),
    focus = Color(0xFF3B3FB0),
    right = Color(0xFF00664E),
    rightSoft = Color(0x1C00664E),
    wrong = Color(0xFFA82F17),
    wrongSoft = Color(0x1AA82F17),
    verbal = Color(0xFF5A3FD6),
    verbalSoft = Color(0x1C5A3FD6),
    quant = Color(0xFF00664E),
    quantSoft = Color(0x1C00664E),
    essay = Color(0xFF844C00),
    essaySoft = Color(0x1C844C00),
    words = Color(0xFFA12A60),
    wordsSoft = Color(0x1CA12A60),
    exam = Color(0xFF0E1430),
    examSoft = Color(0x140E1430),
    navBg = Color(0xFFE8E9F5),
    reading = Color(0xFF2354C5),
    readingSoft = Color(0x1A2354C5),
    listening = Color(0xFF006677),
    listeningSoft = Color(0x1A006677),
    writing = Color(0xFF894E00),
    writingSoft = Color(0x1A894E00),
    speaking = Color(0xFFA92864),
    speakingSoft = Color(0x1AA92864),
    signInAppleBg = Color(0xFF000000),
    signInAppleText = Color(0xFFFFFFFF),
    signInGoogleBg = Color(0xFFFFFFFF),
    signInGoogleStroke = Color(0xFF747775),
    signInGoogleText = Color(0xFF1F1F1F),
)

val GpDarkColors = GpColors(
    bg = Color(0xFF0A0F1F),
    surface = Color(0xFF121931),
    surface2 = Color(0xFF1A2343),
    text = Color(0xFFEDF1FB),
    text2 = Color(0xFFA8B1CC),
    text3 = Color(0xFF8892B0),
    line = Color(0x1AA8B8E8),
    lineStrong = Color(0x38A8B8E8),
    accent = Color(0xFF5CCFFF),
    onAccent = Color(0xFF051425),
    accentSoft = Color(0x215CCFFF),
    focus = Color(0xFF5CCFFF),
    right = Color(0xFF6BE3A4),
    rightSoft = Color(0x216BE3A4),
    wrong = Color(0xFFFF8B78),
    wrongSoft = Color(0x21FF8B78),
    verbal = Color(0xFFA897FF),
    verbalSoft = Color(0x29A897FF),
    quant = Color(0xFF4FD9B0),
    quantSoft = Color(0x264FD9B0),
    essay = Color(0xFFFFBE63),
    essaySoft = Color(0x26FFBE63),
    words = Color(0xFFFF86B4),
    wordsSoft = Color(0x26FF86B4),
    exam = Color(0xFFEDF1FB),
    examSoft = Color(0x1AEDF1FB),
    navBg = Color(0xFF0D1328),
    reading = Color(0xFF8DB1FF),
    readingSoft = Color(0x298DB1FF),
    listening = Color(0xFF5FD3E6),
    listeningSoft = Color(0x265FD3E6),
    writing = Color(0xFFFFBE63),
    writingSoft = Color(0x26FFBE63),
    speaking = Color(0xFFFF86B4),
    speakingSoft = Color(0x26FF86B4),
    signInAppleBg = Color(0xFFFFFFFF),
    signInAppleText = Color(0xFF000000),
    signInGoogleBg = Color(0xFF131314),
    signInGoogleStroke = Color(0xFF8E918F),
    signInGoogleText = Color(0xFFE3E3E3),
)

/** Свечение: параметры каталога. spread — расширение слоя перед размытием. */
@Immutable
class GpShadow(
    val color: Color,
    val offsetX: Dp,
    val offsetY: Dp,
    val blur: Dp,
    val spread: Dp,
)

/** Тематический вес и свечение выбираются вместе с набором цветов. */
@Immutable
class GpThemeTokens(val thin: FontWeight, val glow: GpShadow)

val GpLightTheme = GpThemeTokens(
    thin = FontWeight.W300,
    glow = GpShadow(color = Color(red = 0.2314f, green = 0.2471f, blue = 0.6902f, alpha = 0.4f), offsetX = 0.dp, offsetY = 10.dp, blur = 28.dp, spread = -8.dp),
)

val GpDarkTheme = GpThemeTokens(
    thin = FontWeight.W200,
    glow = GpShadow(color = Color(red = 0.3608f, green = 0.8118f, blue = 1f, alpha = 0.5f), offsetX = 0.dp, offsetY = 10.dp, blur = 32.dp, spread = -6.dp),
)

/** Отступы и промежутки. */
object GpSpace {
    val s2 = 2.dp
    val s4 = 4.dp
    val s6 = 6.dp
    val s8 = 8.dp
    val s10 = 10.dp
    val s12 = 12.dp
    val s14 = 14.dp
    val s16 = 16.dp
    val s20 = 20.dp
    val s24 = 24.dp
    val s28 = 28.dp
    val s32 = 32.dp
    val s40 = 40.dp
    val s48 = 48.dp
    val s56 = 56.dp
    val s64 = 64.dp
    val s72 = 72.dp
}

/** Радиусы скругления. full — капсула: используйте CircleShape или RoundedCornerShape(50). */
object GpRadius {
    /** Малые элементы: --r-s. */
    val s = 10.dp
    /** Варианты ответа и средние карточки: --r-m. */
    val m = 16.dp
    /** Карточки и сгруппированные списки: --r-l. */
    val l = 24.dp
    /** Кнопки и переключатель экзамена: пилюля. */
    val full = 999.dp
}

/** Размеры элементов. */
object GpSize {
    /** Минимум для нажатия. */
    val tapTarget = 44.dp
    /** Кнопка действия .frame .btn. */
    val button = 52.dp
    /** Переключатель экзамена. */
    val examSwitch = 40.dp
    /** Строка раздела. */
    val sectionRow = 64.dp
    /** Карточка второго плана. */
    val sideCard = 60.dp
    /** Вариант ответа. */
    val opt = 52.dp
    /** Иконка .ic. */
    val icon = 22.dp
    /** Малая иконка .ic-sm. */
    val iconSm = 16.dp
    /** Круглая кнопка с иконкой. */
    val iconButton = 44.dp
    /** Точка цвета раздела. */
    val sectionMark = 10.dp
    /** Полоса продвижения сессии. */
    val sessionBar = 3.dp
    /** Строка навигации на широком экране. */
    val navItemWide = 46.dp
    /** Разделители и тонкие рамки. */
    val hairline = 1.dp
}

/** Раскладка. breakpointWide — граница компактной и широкой раскладки. */
object GpLayout {
    /** Боковые поля .frame .main на телефоне. */
    val gutter = 22.dp
    /** Боковые поля .frame .main на компьютере. */
    val gutterWide = 64.dp
    /** Верхнее поле основного содержимого. */
    val mainTop = 12.dp
    /** Верхнее поле основного содержимого на компьютере. */
    val mainTopWide = 44.dp
    /** Место под нижнюю навигацию. */
    val mainBottomNav = 96.dp
    /** Нижнее поле навигации. */
    val navBottom = 28.dp
    /** Ширина боковой навигации. */
    val sidebarWidth = 232.dp
    /** Максимальная ширина слова и его разбора. */
    val contentMax = 720.dp
    /** Граница широкой раскладки каталога. */
    val breakpointWide = 900.dp
    /** Колонка входа на широком экране: .t-signin-buttons в каталоге. */
    val authColumnMax = 400.dp
    /** Узкая колонка поясняющего текста на экранах состояний: ошибка, «нет сети». */
    val textMax = 320.dp
    /** до перестройки сессии по R1–R20 (часть 3 редизайна) */
    val sessionMax = 1040.dp
}

/** Прозрачность состояний элементов. */
object GpOpacity {
    const val DISABLED = 0.5f
}

/** Типографика кнопки Google. Размер и разрядка — sp, чтобы следовать системному масштабу текста. */
object GpSignInGoogle {
    const val FONT_FAMILY = "Roboto"
    val FONT_FALLBACKS = listOf("sans-serif")
    val fontSize = 14.sp
    val fontWeight = FontWeight.W500
    val tracking = 0.25.sp
    val lineHeight = 20.sp
}

/** Типографика кнопки Apple: системный шрифт Android, размеры текста — sp. */
object GpSignInApple {
    val fontFamily = GpTypography.SYSTEM_FONT_FAMILY
    val fontSize = 17.sp
    val fontWeight = FontWeight.W500
    val lineHeight = 20.sp
}

/** family — Geologica, monoFamily — IBM Plex Mono из ресурсов. sp растут с системным масштабом. */
@Immutable
class GpTypography private constructor(family: FontFamily, monoFamily: FontFamily, theme: GpThemeTokens) {
    /** Основной текст .frame. */
    val body = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 23.2.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Заголовок экрана .frame .h1. */
    val h1 = TextStyle(fontFamily = family, fontSize = 34.sp, lineHeight = 39.1.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.03).em)
    val h1Wide = TextStyle(fontFamily = family, fontSize = 44.sp, lineHeight = 50.6.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.03).em)
    /** Заголовок карточки .frame .h2. */
    val h2 = TextStyle(fontFamily = family, fontSize = 19.sp, lineHeight = 23.75.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.015).em)
    /** Подзаголовок .frame .h3. */
    val h3 = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 20.8.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.01).em)
    /** Подпись над заголовком; также legend и rel-label. */
    val eyebrow = TextStyle(fontFamily = family, fontSize = 13.sp, lineHeight = 18.85.sp, fontWeight = FontWeight.W500, letterSpacing = (0).em)
    /** Вводный текст .lead. */
    val lead = TextStyle(fontFamily = family, fontSize = 17.sp, lineHeight = 24.65.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Текст кнопки .frame .btn. */
    val button = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 23.2.sp, fontWeight = FontWeight.W600, letterSpacing = (0.005).em)
    /** Переключатель экзамена. */
    val examSwitch = TextStyle(fontFamily = family, fontSize = 14.sp, lineHeight = 20.3.sp, fontWeight = FontWeight.W600, letterSpacing = (0.02).em)
    /** Заголовок карточки тренировки. */
    val startTitle = TextStyle(fontFamily = family, fontSize = 30.sp, lineHeight = 34.5.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.03).em)
    val startTitleWide = TextStyle(fontFamily = family, fontSize = 44.sp, lineHeight = 50.6.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.035).em)
    /** Подписи start-meta, session-meta, q-instr. */
    val meta = TextStyle(fontFamily = family, fontSize = 14.sp, lineHeight = 20.3.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Название раздела. */
    val sectionName = TextStyle(fontFamily = family, fontSize = 17.sp, lineHeight = 24.65.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.01).em)
    /** section-types, section-stat small, score-note. */
    val caption = TextStyle(fontFamily = family, fontSize = 13.sp, lineHeight = 18.85.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Тонкие цифры статистики раздела. */
    val sectionStat = TextStyle(fontFamily = family, fontSize = 24.sp, lineHeight = 25.2.sp, fontWeight = theme.thin, letterSpacing = (-0.02).em)
    val sectionStatWide = TextStyle(fontFamily = family, fontSize = 28.sp, lineHeight = 29.4.sp, fontWeight = theme.thin, letterSpacing = (-0.02).em)
    /** Тонкий счётчик сессии. */
    val sessionCount = TextStyle(fontFamily = family, fontSize = 22.sp, lineHeight = 31.9.sp, fontWeight = theme.thin, letterSpacing = (-0.02).em)
    val sessionCountWide = TextStyle(fontFamily = family, fontSize = 26.sp, lineHeight = 37.7.sp, fontWeight = theme.thin, letterSpacing = (-0.02).em)
    /** Итоговое правило .frame .q-text; базовые 19/1.55 переопределены. */
    val qText = TextStyle(fontFamily = family, fontSize = 20.sp, lineHeight = 32.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.01).em)
    val qTextWide = TextStyle(fontFamily = family, fontSize = 24.sp, lineHeight = 38.4.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.01).em)
    /** Вариант ответа .frame .opt. */
    val opt = TextStyle(fontFamily = family, fontSize = 17.sp, lineHeight = 24.65.sp, fontWeight = FontWeight.W500, letterSpacing = (-0.005).em)
    /** Ответ .frame .ans. */
    val answer = TextStyle(fontFamily = family, fontSize = 15.sp, lineHeight = 21.75.sp, fontWeight = FontWeight.W500, letterSpacing = (-0.005).em)
    /** Текст разбора .explain-body. */
    val explainBody = TextStyle(fontFamily = family, fontSize = 15.sp, lineHeight = 23.25.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Ссылка на тему .topic-link; чип .chip. */
    val action = TextStyle(fontFamily = family, fontSize = 15.sp, lineHeight = 21.75.sp, fontWeight = FontWeight.W500, letterSpacing = (-0.005).em)
    /** Переключатель языка разбора. */
    val seg = TextStyle(fontFamily = family, fontSize = 13.sp, lineHeight = 18.85.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.005).em)
    /** Подпись балла. */
    val scoreLabel = TextStyle(fontFamily = family, fontSize = 13.sp, lineHeight = 18.85.sp, fontWeight = FontWeight.W500, letterSpacing = (-0.005).em)
    /** Тонкий балл прогресса. */
    val scoreNum = TextStyle(fontFamily = family, fontSize = 32.sp, lineHeight = 32.sp, fontWeight = theme.thin, letterSpacing = (-0.04).em)
    val scoreNumWide = TextStyle(fontFamily = family, fontSize = 44.sp, lineHeight = 44.sp, fontWeight = theme.thin, letterSpacing = (-0.04).em)
    /** Тонкие цифры точности и истории .acc-val, .hist-res. */
    val statValue = TextStyle(fontFamily = family, fontSize = 18.sp, lineHeight = 26.1.sp, fontWeight = theme.thin, letterSpacing = (-0.02).em)
    /** Заголовок выбора экзамена. */
    val examTitle = TextStyle(fontFamily = family, fontSize = 36.sp, lineHeight = 41.4.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.03).em)
    val examTitleWide = TextStyle(fontFamily = family, fontSize = 48.sp, lineHeight = 55.2.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.03).em)
    /** Название экзамена крупными тонкими буквами. */
    val examName = TextStyle(fontFamily = family, fontSize = 44.sp, lineHeight = 44.sp, fontWeight = theme.thin, letterSpacing = (-0.04).em)
    val examNameWide = TextStyle(fontFamily = family, fontSize = 64.sp, lineHeight = 64.sp, fontWeight = theme.thin, letterSpacing = (-0.04).em)
    /** Слово в словаре. */
    val headword = TextStyle(fontFamily = family, fontSize = 56.sp, lineHeight = 56.sp, fontWeight = theme.thin, letterSpacing = (-0.04).em)
    val headwordWide = TextStyle(fontFamily = family, fontSize = 88.sp, lineHeight = 88.sp, fontWeight = theme.thin, letterSpacing = (-0.04).em)
    /** Значение слова на английском. */
    val senseEn = TextStyle(fontFamily = family, fontSize = 20.sp, lineHeight = 28.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.01).em)
    /** Метаданные слова. */
    val wordMeta = TextStyle(fontFamily = family, fontSize = 15.sp, lineHeight = 21.75.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Пример употребления. */
    val example = TextStyle(fontFamily = family, fontSize = 17.sp, lineHeight = 24.65.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Подпись нижней навигации. */
    val navLabel = TextStyle(fontFamily = family, fontSize = 11.sp, lineHeight = 15.95.sp, fontWeight = FontWeight.W500, letterSpacing = (-0.005).em)
    val navLabelWide = TextStyle(fontFamily = family, fontSize = 15.sp, lineHeight = 21.75.sp, fontWeight = FontWeight.W500, letterSpacing = (-0.005).em)
    /** Транскрипция: IBM Plex Mono. */
    val ipa = TextStyle(fontFamily = monoFamily, fontSize = 14.sp, lineHeight = 20.3.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Тонкий счётчик недели на компьютере. */
    val weekCount = TextStyle(fontFamily = family, fontSize = 28.sp, lineHeight = 40.6.sp, fontWeight = theme.thin, letterSpacing = (-0.03).em)

    companion object {
        /** Настройка «Крупнее»: множитель поверх системного масштаба шрифта. */
        const val TEXT_SCALE_LARGE = 1.125f
        const val FONT_FAMILY = "Geologica"
        const val MONO_FONT_FAMILY = "IBM Plex Mono"
        const val MATH_FONT_FAMILY = "Source Serif 4"
        val MATH_FONT_FALLBACKS = listOf("Georgia", "serif")
        /** Системный шрифт: кнопка «Вход с Apple» (правила Apple) и невидимый измеритель MainButton Telegram (клиент рисует её системным шрифтом) */
        val SYSTEM_FONT_FAMILY = FontFamily.Default
        fun light(family: FontFamily, monoFamily: FontFamily) = GpTypography(family, monoFamily, GpLightTheme)
        fun dark(family: FontFamily, monoFamily: FontFamily) = GpTypography(family, monoFamily, GpDarkTheme)
    }
}

/** Движение. Длительности — миллисекунды. */
object GpMotion {
    const val PRESS = 160
    const val REVEAL = 240
    const val PULSE = 1600
    const val PRESS_SCALE = 0.98f
    val EaseOut = CubicBezierEasing(0.2f, 0.8f, 0.2f, 1f)
}
