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
    val surface3: Color,
    val text: Color,
    val text2: Color,
    val text3: Color,
    val line: Color,
    val lineStrong: Color,
    val accent: Color,
    val onAccent: Color,
    val focus: Color,
    val navBg: Color,
    val right: Color,
    val rightSoft: Color,
    val wrong: Color,
    val wrongSoft: Color,
    val highlight: Color,
    val verbal: Color,
    val quant: Color,
    val essay: Color,
    val words: Color,
    val exam: Color,
    val examGre: Color,
    val examToefl: Color,
    val examSat: Color,
    val examGmat: Color,
    val accentSoft: Color,
    val verbalSoft: Color,
    val quantSoft: Color,
    val essaySoft: Color,
    val wordsSoft: Color,
    val examSoft: Color,
    val examGreSoft: Color,
    val examToeflSoft: Color,
    val examSatSoft: Color,
    val examGmatSoft: Color,
    val reading: Color,
    val readingSoft: Color,
    val listening: Color,
    val listeningSoft: Color,
    val writing: Color,
    val writingSoft: Color,
    val speaking: Color,
    val speakingSoft: Color,
    val verbalInk: Color,
    val quantInk: Color,
    val essayInk: Color,
    val wordsInk: Color,
    val examInk: Color,
    val readingInk: Color,
    val listeningInk: Color,
    val writingInk: Color,
    val speakingInk: Color,
    val examGreInk: Color,
    val examToeflInk: Color,
    val examSatInk: Color,
    val examGmatInk: Color,
    val signInAppleBg: Color,
    val signInAppleText: Color,
    val signInGoogleBg: Color,
    val signInGoogleStroke: Color,
    val signInGoogleText: Color,
)

val GpLightColors = GpColors(
    bg = Color(0xFFFBF3EA),
    surface = Color(0xFFFFFDF9),
    surface2 = Color(0xFFF3EADF),
    surface3 = Color(0xFFEADFD2),
    text = Color(0xFF1C1424),
    text2 = Color(0xFF4E4459),
    text3 = Color(0xFF6B6176),
    line = Color(0x171C1424),
    lineStrong = Color(0x2E1C1424),
    accent = Color(0xFFFF5B3A),
    onAccent = Color(0xFF1C1424),
    focus = Color(0xFFE84523),
    navBg = Color(0xFFFBF3EA),
    right = Color(0xFF00724A),
    rightSoft = Color(0x3343D6A3),
    wrong = Color(0xFFBA2C11),
    wrongSoft = Color(0x24FF6B4A),
    highlight = Color(0x6643D6A3),
    verbal = Color(0xFF7357F0),
    quant = Color(0xFF0E9F6E),
    essay = Color(0xFFC98A00),
    words = Color(0xFFD9468F),
    exam = Color(0xFF2F86D6),
    examGre = Color(0xFFFFC53D),
    examToefl = Color(0xFF43D6A3),
    examSat = Color(0xFFB9A6FF),
    examGmat = Color(0xFF82CBFF),
    accentSoft = Color(0x24FF5B3A),
    verbalSoft = Color(0x1A7357F0),
    quantSoft = Color(0x1A0E9F6E),
    essaySoft = Color(0x1AC98A00),
    wordsSoft = Color(0x1AD9468F),
    examSoft = Color(0x1A2F86D6),
    examGreSoft = Color(0x1AFFC53D),
    examToeflSoft = Color(0x1A43D6A3),
    examSatSoft = Color(0x1AB9A6FF),
    examGmatSoft = Color(0x1A82CBFF),
    reading = Color(0xFF82CBFF),
    readingSoft = Color(0x1A82CBFF),
    listening = Color(0xFF43D6A3),
    listeningSoft = Color(0x1A43D6A3),
    writing = Color(0xFFFFC53D),
    writingSoft = Color(0x1AFFC53D),
    speaking = Color(0xFFFF9ECD),
    speakingSoft = Color(0x1AFF9ECD),
    verbalInk = Color(0xFF6747DF),
    quantInk = Color(0xFF00724D),
    essayInk = Color(0xFF875B00),
    wordsInk = Color(0xFFB82374),
    examInk = Color(0xFF0066B2),
    readingInk = Color(0xFF1C6998),
    listeningInk = Color(0xFF007252),
    writingInk = Color(0xFF805E00),
    speakingInk = Color(0xFF9D4573),
    examGreInk = Color(0xFF805E00),
    examToeflInk = Color(0xFF007252),
    examSatInk = Color(0xFF6B56A8),
    examGmatInk = Color(0xFF1C6998),
    signInAppleBg = Color(0xFF000000),
    signInAppleText = Color(0xFFFFFFFF),
    signInGoogleBg = Color(0xFFFFFFFF),
    signInGoogleStroke = Color(0xFF747775),
    signInGoogleText = Color(0xFF1F1F1F),
)

val GpDarkColors = GpColors(
    bg = Color(0xFF140F1C),
    surface = Color(0xFF1E1828),
    surface2 = Color(0xFF282133),
    surface3 = Color(0xFF342B41),
    text = Color(0xFFFBF4EC),
    text2 = Color(0xFFCEC3DA),
    text3 = Color(0xFFA698B6),
    line = Color(0x14FBF4EC),
    lineStrong = Color(0x33FBF4EC),
    accent = Color(0xFFFF5B3A),
    onAccent = Color(0xFF1C1424),
    focus = Color(0xFFFF5B3A),
    navBg = Color(0xFF140F1C),
    right = Color(0xFF5FE3AE),
    rightSoft = Color(0x2443D6A3),
    wrong = Color(0xFFFF8D75),
    wrongSoft = Color(0x24FF6B4A),
    highlight = Color(0x4D43D6A3),
    verbal = Color(0xFFB9A6FF),
    quant = Color(0xFF43D6A3),
    essay = Color(0xFFFFC53D),
    words = Color(0xFFFF9ECD),
    exam = Color(0xFF82CBFF),
    examGre = Color(0xFFFFC53D),
    examToefl = Color(0xFF43D6A3),
    examSat = Color(0xFFB9A6FF),
    examGmat = Color(0xFF82CBFF),
    accentSoft = Color(0x24FF5B3A),
    verbalSoft = Color(0x24B9A6FF),
    quantSoft = Color(0x2443D6A3),
    essaySoft = Color(0x24FFC53D),
    wordsSoft = Color(0x24FF9ECD),
    examSoft = Color(0x2482CBFF),
    examGreSoft = Color(0x24FFC53D),
    examToeflSoft = Color(0x2443D6A3),
    examSatSoft = Color(0x24B9A6FF),
    examGmatSoft = Color(0x2482CBFF),
    reading = Color(0xFF82CBFF),
    readingSoft = Color(0x2482CBFF),
    listening = Color(0xFF43D6A3),
    listeningSoft = Color(0x2443D6A3),
    writing = Color(0xFFFFC53D),
    writingSoft = Color(0x24FFC53D),
    speaking = Color(0xFFFF9ECD),
    speakingSoft = Color(0x24FF9ECD),
    verbalInk = Color(0xFFB9A6FF),
    quantInk = Color(0xFF43D6A3),
    essayInk = Color(0xFFFFC53D),
    wordsInk = Color(0xFFFF9ECD),
    examInk = Color(0xFF82CBFF),
    readingInk = Color(0xFF82CBFF),
    listeningInk = Color(0xFF43D6A3),
    writingInk = Color(0xFFFFC53D),
    speakingInk = Color(0xFFFF9ECD),
    examGreInk = Color(0xFFFFC53D),
    examToeflInk = Color(0xFF43D6A3),
    examSatInk = Color(0xFFB9A6FF),
    examGmatInk = Color(0xFF82CBFF),
    signInAppleBg = Color(0xFFFFFFFF),
    signInAppleText = Color(0xFF000000),
    signInGoogleBg = Color(0xFF131314),
    signInGoogleStroke = Color(0xFF8E918F),
    signInGoogleText = Color(0xFFE3E3E3),
)

/** Параметры тени. В стиле B glow прозрачен и имеет нулевые размеры. */
@Immutable
class GpShadow(
    val color: Color,
    val offsetX: Dp,
    val offsetY: Dp,
    val blur: Dp,
    val spread: Dp,
)

/** Совместимость с прежними темами: thin = 800, glow — нулевой; оба устарели. */
@Immutable
class GpThemeTokens(val thin: FontWeight, val glow: GpShadow)

val GpLightTheme = GpThemeTokens(
    thin = FontWeight.W800,
    glow = GpShadow(color = Color(red = 0f, green = 0f, blue = 0f, alpha = 0f), offsetX = 0.dp, offsetY = 0.dp, blur = 0.dp, spread = 0.dp),
)

val GpDarkTheme = GpThemeTokens(
    thin = FontWeight.W800,
    glow = GpShadow(color = Color(red = 0f, green = 0f, blue = 0f, alpha = 0f), offsetX = 0.dp, offsetY = 0.dp, blur = 0.dp, spread = 0.dp),
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
    val s = 12.dp
    /** Варианты ответа и средние карточки: --r-m. */
    val m = 18.dp
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
    val button = 54.dp
    /** Переключатель экзамена. */
    val examSwitch = 40.dp
    /** Строка раздела. */
    val sectionRow = 64.dp
    /** Карточка второго плана. */
    val sideCard = 60.dp
    /** Вариант ответа. */
    val opt = 54.dp
    /** Иконка .ic. */
    val icon = 22.dp
    /** Малая иконка .ic-sm. */
    val iconSm = 18.dp
    /** Круглая кнопка с иконкой. */
    val iconButton = 44.dp
    /** Точка цвета раздела. */
    val sectionMark = 9.dp
    /** Полоса продвижения сессии. */
    val sessionBar = 4.dp
    /** Строка навигации на широком экране. */
    val navItemWide = 46.dp
    /** Разделители и тонкие рамки. */
    val hairline = 1.dp
}

/** Раскладка. breakpointWide — граница компактной и широкой раскладки. */
object GpLayout {
    /** Боковые поля .frame .main на телефоне. */
    val gutter = 20.dp
    /** Боковые поля .frame .main на компьютере. */
    val gutterWide = 56.dp
    /** Верхнее поле основного содержимого. */
    val mainTop = 0.dp
    /** Верхнее поле основного содержимого на компьютере. */
    val mainTopWide = 44.dp
    /** Место под нижнюю навигацию. */
    val mainBottomNav = 112.dp
    /** Нижнее поле навигации. */
    val navBottom = 30.dp
    /** Ширина боковой навигации. */
    val sidebarWidth = 248.dp
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

/** family — Onest, monoFamily — IBM Plex Mono из ресурсов. sp растут с системным масштабом. */
@Immutable
class GpTypography private constructor(family: FontFamily, monoFamily: FontFamily, theme: GpThemeTokens) {
    /** Профиль .frame из design/app-b/index.html. */
    val body = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 23.2.sp, fontWeight = FontWeight.W400, letterSpacing = (0).em)
    /** Профиль .h1 из design/app-b/index.html. */
    val h1 = TextStyle(fontFamily = family, fontSize = 34.sp, lineHeight = 35.36.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.035).em)
    /** Профиль .h1 из design/app-b/index.html. */
    val h1Wide = TextStyle(fontFamily = family, fontSize = 44.sp, lineHeight = 45.76.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.035).em)
    /** Профиль .h2 из design/app-b/index.html. */
    val h2 = TextStyle(fontFamily = family, fontSize = 22.sp, lineHeight = 25.3.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.025).em)
    /** Профиль .h3 из design/app-b/index.html. */
    val h3 = TextStyle(fontFamily = family, fontSize = 17.sp, lineHeight = 22.1.sp, fontWeight = FontWeight.W700, letterSpacing = (-0.01).em)
    /** Подпись над заголовком; также legend и rel-label. */
    val eyebrow = TextStyle(fontFamily = family, fontSize = 13.sp, lineHeight = 18.85.sp, fontWeight = FontWeight.W500, letterSpacing = (0).em)
    /** Вводный текст .lead. */
    val lead = TextStyle(fontFamily = family, fontSize = 17.sp, lineHeight = 24.65.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Профиль .btn из design/app-b/index.html. */
    val button = TextStyle(fontFamily = family, fontSize = 16.5.sp, lineHeight = 23.925.sp, fontWeight = FontWeight.W700, letterSpacing = (-0.01).em)
    /** Профиль .exam-switch из design/app-b/index.html. */
    val examSwitch = TextStyle(fontFamily = family, fontSize = 15.sp, lineHeight = 21.75.sp, fontWeight = FontWeight.W700, letterSpacing = (-0.005).em)
    /** Профиль .start-title из design/app-b/index.html. */
    val startTitle = TextStyle(fontFamily = family, fontSize = 28.sp, lineHeight = 29.4.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.035).em)
    /** Профиль .start-title из design/app-b/index.html. */
    val startTitleWide = TextStyle(fontFamily = family, fontSize = 34.sp, lineHeight = 35.7.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.035).em)
    /** Подписи start-meta, session-meta, q-instr. */
    val meta = TextStyle(fontFamily = family, fontSize = 14.sp, lineHeight = 20.3.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Профиль .row-body b из design/app-b/index.html. */
    val sectionName = TextStyle(fontFamily = family, fontSize = 16.5.sp, lineHeight = 23.925.sp, fontWeight = FontWeight(650), letterSpacing = (-0.01).em)
    /** section-types, section-stat small, score-note. */
    val caption = TextStyle(fontFamily = family, fontSize = 13.sp, lineHeight = 18.85.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Профиль .stat b из design/app-b/index.html. */
    val sectionStat = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 23.2.sp, fontWeight = FontWeight.W700, letterSpacing = (0).em)
    /** Профиль .stat b из design/app-b/index.html. */
    val sectionStatWide = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 23.2.sp, fontWeight = FontWeight.W700, letterSpacing = (0).em)
    /** Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ. */
    val sessionCount = TextStyle(fontFamily = family, fontSize = 22.sp, lineHeight = 31.9.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.04).em)
    /** Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ. */
    val sessionCountWide = TextStyle(fontFamily = family, fontSize = 26.sp, lineHeight = 37.7.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.04).em)
    /** Профиль .q-text из design/app-b/index.html. */
    val qText = TextStyle(fontFamily = family, fontSize = 20.sp, lineHeight = 32.4.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Профиль .q-text из design/app-b/index.html. */
    val qTextWide = TextStyle(fontFamily = family, fontSize = 20.sp, lineHeight = 32.4.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Профиль .opt из design/app-b/index.html. */
    val opt = TextStyle(fontFamily = family, fontSize = 17.sp, lineHeight = 24.65.sp, fontWeight = FontWeight.W500, letterSpacing = (0).em)
    /** Профиль .ans из design/app-b/index.html. */
    val answer = TextStyle(fontFamily = family, fontSize = 15.sp, lineHeight = 21.75.sp, fontWeight = FontWeight(650), letterSpacing = (0).em)
    /** Профиль .explain-body из design/app-b/index.html. */
    val explainBody = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 25.28.sp, fontWeight = FontWeight.W400, letterSpacing = (0).em)
    /** Профиль .link-row из design/app-b/index.html. */
    val action = TextStyle(fontFamily = family, fontSize = 15.sp, lineHeight = 21.75.sp, fontWeight = FontWeight.W600, letterSpacing = (0).em)
    /** Профиль .seg button из design/app-b/index.html. */
    val seg = TextStyle(fontFamily = family, fontSize = 13.sp, lineHeight = 18.85.sp, fontWeight = FontWeight.W700, letterSpacing = (0.02).em)
    /** Профиль .x-label из design/app-b/index.html. */
    val scoreLabel = TextStyle(fontFamily = family, fontSize = 14.sp, lineHeight = 20.3.sp, fontWeight = FontWeight.W600, letterSpacing = (0).em)
    /** Профиль .metric-num из design/app-b/index.html. */
    val scoreNum = TextStyle(fontFamily = family, fontSize = 30.sp, lineHeight = 31.5.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.04).em)
    /** Профиль .metric-num из design/app-b/index.html. */
    val scoreNumWide = TextStyle(fontFamily = family, fontSize = 30.sp, lineHeight = 31.5.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.04).em)
    /** Профиль .stat b из design/app-b/index.html. */
    val statValue = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 23.2.sp, fontWeight = FontWeight.W700, letterSpacing = (0).em)
    /** Профиль .h2 из design/app-b/index.html. */
    val examTitle = TextStyle(fontFamily = family, fontSize = 22.sp, lineHeight = 25.3.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.025).em)
    /** Профиль .h2 из design/app-b/index.html. */
    val examTitleWide = TextStyle(fontFamily = family, fontSize = 22.sp, lineHeight = 25.3.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.025).em)
    /** Профиль .exam-tile из design/app-b/index.html. */
    val examName = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 23.2.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.02).em)
    /** Профиль .exam-tile из design/app-b/index.html. */
    val examNameWide = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 23.2.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.02).em)
    /** Псевдоним num-m для совместимости платформ; значения задаёт общая ступень. */
    val headword = TextStyle(fontFamily = family, fontSize = 52.sp, lineHeight = 50.96.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.045).em)
    /** Псевдоним num-l-wide для совместимости платформ; значения задаёт общая ступень. */
    val headwordWide = TextStyle(fontFamily = family, fontSize = 52.sp, lineHeight = 50.96.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.045).em)
    /** Профиль .sense-en из design/app-b/index.html. */
    val senseEn = TextStyle(fontFamily = family, fontSize = 18.sp, lineHeight = 26.1.sp, fontWeight = FontWeight.W400, letterSpacing = (0).em)
    /** Профиль .word-meta из design/app-b/index.html. */
    val wordMeta = TextStyle(fontFamily = family, fontSize = 15.sp, lineHeight = 21.75.sp, fontWeight = FontWeight.W400, letterSpacing = (0).em)
    /** Профиль .example из design/app-b/index.html. */
    val example = TextStyle(fontFamily = family, fontSize = 15.5.sp, lineHeight = 22.475.sp, fontWeight = FontWeight.W400, letterSpacing = (0).em)
    /** Профиль .nav-item из design/app-b/index.html. */
    val navLabel = TextStyle(fontFamily = family, fontSize = 11.5.sp, lineHeight = 16.675.sp, fontWeight = FontWeight.W600, letterSpacing = (0.005).em)
    /** Профиль .nav-item из design/app-b/index.html. */
    val navLabelWide = TextStyle(fontFamily = family, fontSize = 15.5.sp, lineHeight = 22.475.sp, fontWeight = FontWeight.W600, letterSpacing = (0.005).em)
    /** Транскрипция: IBM Plex Mono. */
    val ipa = TextStyle(fontFamily = monoFamily, fontSize = 14.sp, lineHeight = 20.3.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** Профиль .week b из design/app-b/index.html. */
    val weekCount = TextStyle(fontFamily = family, fontSize = 26.sp, lineHeight = 37.7.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.035).em)
    /** Подпись крупного результата: основной и компактный итоги тренировки. */
    val numLabel = TextStyle(fontFamily = family, fontSize = 20.sp, lineHeight = 24.sp, fontWeight = FontWeight.W500, letterSpacing = (-0.015).em)
    /** Подпись основного результата на широком экране. */
    val numLabelWide = TextStyle(fontFamily = family, fontSize = 28.sp, lineHeight = 33.6.sp, fontWeight = FontWeight.W500, letterSpacing = (-0.015).em)
    /** Профиль .today-num span из design/app-b/index.html. */
    val numUnit = TextStyle(fontFamily = family, fontSize = 22.sp, lineHeight = 31.9.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.025).em)
    /** Заголовок задания слов: перевод в нескольких упражнениях. */
    val promptTitle = TextStyle(fontFamily = family, fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.W600, letterSpacing = (-0.015).em)
    /** Широкий заголовок задания слов — существующая роль start-title. */
    val promptTitleWide = TextStyle(fontFamily = family, fontSize = 28.sp, lineHeight = 29.4.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.035).em)
    /** Однострочный ввод: поиск слова и ячейки Complete the Words. */
    val inputCompact = TextStyle(fontFamily = family, fontSize = 17.sp, lineHeight = 17.sp, fontWeight = FontWeight.W500, letterSpacing = (0).em)
    /** Однострочный ввод на широком экране. */
    val inputCompactWide = TextStyle(fontFamily = family, fontSize = 19.sp, lineHeight = 19.sp, fontWeight = FontWeight.W500, letterSpacing = (0).em)
    /** Буквы: сборка слова и сравнение введённого ответа; один размер для обоих экранов. */
    val inputLetter = TextStyle(fontFamily = family, fontSize = 26.sp, lineHeight = 37.7.sp, fontWeight = FontWeight.W500, letterSpacing = (-0.0031).em)
    /** Ввод ответа словом: несколько упражнений W12–W14. */
    val inputDisplay = TextStyle(fontFamily = family, fontSize = 26.sp, lineHeight = 31.2.sp, fontWeight = FontWeight.W500, letterSpacing = (0.01).em)
    /** Компактный заголовок прогресса: на телефоне совпадает с h1. */
    val h1Compact = TextStyle(fontFamily = family, fontSize = 34.sp, lineHeight = 35.36.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.035).em)
    /** Профиль .h1 из design/app-b/index.html. */
    val h1CompactWide = TextStyle(fontFamily = family, fontSize = 44.sp, lineHeight = 45.76.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.035).em)
    /** .frame .l-ctw-text в screens/l.css. */
    val completeWordsText = TextStyle(fontFamily = family, fontSize = 18.sp, lineHeight = 38.7.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** .frame .l-ctw-text в screens/l.css; широкая раскладка от 900 px. */
    val completeWordsTextWide = TextStyle(fontFamily = family, fontSize = 22.sp, lineHeight = 48.4.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.005).em)
    /** .frame .l-frame в screens/l.css. */
    val sentenceAssembly = TextStyle(fontFamily = family, fontSize = 20.sp, lineHeight = 46.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.004).em)
    /** .frame .l-frame в screens/l.css; широкая раскладка от 900 px. */
    val sentenceAssemblyWide = TextStyle(fontFamily = family, fontSize = 24.sp, lineHeight = 55.2.sp, fontWeight = FontWeight.W400, letterSpacing = (-0.0033).em)
    /** Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ. */
    val numS = TextStyle(fontFamily = family, fontSize = 48.sp, lineHeight = 48.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.04).em)
    /** Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ. */
    val numSWide = TextStyle(fontFamily = family, fontSize = 60.sp, lineHeight = 60.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.04).em)
    /** Профиль .headword из design/app-b/index.html. */
    val numM = TextStyle(fontFamily = family, fontSize = 52.sp, lineHeight = 50.96.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.045).em)
    /** Профиль .headword из design/app-b/index.html. */
    val numMWide = TextStyle(fontFamily = family, fontSize = 52.sp, lineHeight = 50.96.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.045).em)
    /** Профиль .today-num b из design/app-b/index.html. */
    val numL = TextStyle(fontFamily = family, fontSize = 64.sp, lineHeight = 57.6.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.05).em)
    /** Профиль .today-num b из design/app-b/index.html. */
    val numLWide = TextStyle(fontFamily = family, fontSize = 64.sp, lineHeight = 57.6.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.05).em)
    /** Профиль .x-num из design/app-b/index.html. */
    val numXl = TextStyle(fontFamily = family, fontSize = 68.sp, lineHeight = 64.6.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.05).em)
    /** Профиль .x-num из design/app-b/index.html. */
    val numXlWide = TextStyle(fontFamily = family, fontSize = 68.sp, lineHeight = 64.6.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.05).em)
    /** Профиль .sum-num из design/app-b/index.html. */
    val numXxl = TextStyle(fontFamily = family, fontSize = 120.sp, lineHeight = 96.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.055).em)
    /** Профиль .sum-num из design/app-b/index.html. */
    val numXxlWide = TextStyle(fontFamily = family, fontSize = 120.sp, lineHeight = 96.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.055).em)
    /** Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ. */
    val numCompact = TextStyle(fontFamily = family, fontSize = 36.sp, lineHeight = 37.8.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.04).em)
    /** Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ. */
    val numCompactWide = TextStyle(fontFamily = family, fontSize = 52.sp, lineHeight = 54.6.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.04).em)
    /** Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ. */
    val wordTitle = TextStyle(fontFamily = family, fontSize = 40.sp, lineHeight = 44.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.045).em)
    /** Крупный профиль Onest 800; имя сохранено для совместимости со шкалой платформ. */
    val wordTitleWide = TextStyle(fontFamily = family, fontSize = 56.sp, lineHeight = 61.6.sp, fontWeight = FontWeight.W800, letterSpacing = (-0.045).em)

    companion object {
        /** Настройка «Крупнее»: множитель поверх системного масштаба шрифта. */
        const val TEXT_SCALE_LARGE = 1.125f
        const val FONT_FAMILY = "Onest"
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
    const val PRESS = 140
    const val REVEAL = 240
    const val PULSE = 1600
    const val PRESS_SCALE = 0.97f
    val EaseOut = CubicBezierEasing(0.23f, 1f, 0.32f, 1f)
}
