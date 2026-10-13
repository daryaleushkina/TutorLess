package dev.greprepapp.design

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import greprep.design.GpColors
import greprep.design.GpDarkColors
import greprep.design.GpDarkTheme
import greprep.design.GpLayout
import greprep.design.GpLightColors
import greprep.design.GpLightTheme
import greprep.design.GpRadius
import greprep.design.GpThemeTokens
import greprep.design.GpTypography

/** Каждому весу, включая 650, соответствует точное значение оси wght переменного Onest. */
val OnestFamily: FontFamily =
    FontFamily(
        onest(FontWeight.W400),
        onest(FontWeight.W500),
        onest(FontWeight.W600),
        onest(FontWeight(650)),
        onest(FontWeight.W700),
        onest(FontWeight.W800),
    )

private fun onest(weight: FontWeight) =
    Font(
        resId = R.font.onest_variable,
        weight = weight,
        variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)),
    )

val PlexMonoFamily: FontFamily = FontFamily(Font(R.font.ibm_plex_mono_regular, FontWeight.W400))

/** Формулы Quant: прямые числа и курсивные переменные, без синтетического наклона. */
val MathFamily: FontFamily =
    FontFamily(
        Font(R.font.source_serif4_regular, FontWeight.W400),
        Font(R.font.source_serif4_italic, FontWeight.W400, FontStyle.Italic),
    )

private val LocalGpColors = staticCompositionLocalOf { GpDarkColors }
private val LocalGpType = staticCompositionLocalOf { GpTypography.dark(OnestFamily, PlexMonoFamily) }

// Цвета и типографика переключаются вместе с выбранной темой приложения.
private val LocalGpDark = staticCompositionLocalOf { GpDarkTheme }
private val LocalGpWide = staticCompositionLocalOf { false }

/** Доступ к токенам внутри темы: `Gp.colors.text`, `Gp.type.body`, `Gp.isDark`. */
object Gp {
    val colors: GpColors
        @Composable @ReadOnlyComposable
        get() = LocalGpColors.current

    val type: GpTypography
        @Composable @ReadOnlyComposable
        get() = LocalGpType.current

    val theme: GpThemeTokens
        @Composable @ReadOnlyComposable
        get() = LocalGpDark.current

    val isDark: Boolean
        @Composable @ReadOnlyComposable
        get() = LocalGpDark.current === GpDarkTheme

    /** Ширина окна, а не устройства: варианты *Wide учитывают многоконный режим. */
    val isWide: Boolean
        @Composable @ReadOnlyComposable
        get() = LocalGpWide.current
}

/**
 * Стиль B поверх Material 3. Тема приходит из хранилища приложения; цвета и типографика
 * переключаются вместе. largeText — множитель поверх системного масштаба, а не замена ему.
 */
@Composable
fun GpTheme(
    darkTheme: Boolean = true,
    largeText: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) GpDarkColors else GpLightColors
    val theme = if (darkTheme) GpDarkTheme else GpLightTheme
    val type =
        remember(darkTheme) {
            if (darkTheme) GpTypography.dark(OnestFamily, PlexMonoFamily) else GpTypography.light(OnestFamily, PlexMonoFamily)
        }
    val density = LocalDensity.current
    val scaled = if (largeText) Density(density.density, density.fontScale * GpTypography.TEXT_SCALE_LARGE) else density
    val wide =
        with(density) {
            LocalWindowInfo.current.containerSize.width
                .toDp()
        } >= GpLayout.breakpointWide
    CompositionLocalProvider(
        LocalGpColors provides colors,
        LocalGpType provides type,
        LocalGpDark provides theme,
        LocalGpWide provides wide,
        LocalDensity provides scaled,
    ) {
        MaterialTheme(
            colorScheme = colors.toMaterial(darkTheme),
            typography = type.toMaterial(wide),
            shapes = gpShapes,
        ) {
            CompositionLocalProvider(
                LocalContentColor provides colors.text,
                LocalTextStyle provides type.body,
                content = content,
            )
        }
    }
}

private val gpShapes =
    Shapes(
        extraSmall = RoundedCornerShape(GpRadius.s),
        small = RoundedCornerShape(GpRadius.s),
        medium = RoundedCornerShape(GpRadius.m),
        large = RoundedCornerShape(GpRadius.l),
        extraLarge = RoundedCornerShape(GpRadius.l),
    )

/** Томатный — у главной кнопки; остальные выбранные элементы используют цвет текста и поверхности. */
internal fun GpColors.toMaterial(dark: Boolean): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = text,
        onPrimary = bg,
        primaryFixed = text,
        primaryFixedDim = text2,
        onPrimaryFixed = bg,
        onPrimaryFixedVariant = bg,
        primaryContainer = surface2,
        onPrimaryContainer = text,
        secondary = text,
        onSecondary = bg,
        secondaryFixed = text,
        secondaryFixedDim = text2,
        onSecondaryFixed = bg,
        onSecondaryFixedVariant = bg,
        secondaryContainer = surface2,
        onSecondaryContainer = text,
        tertiary = verbalInk,
        onTertiary = bg,
        tertiaryFixed = verbal,
        tertiaryFixedDim = verbal,
        onTertiaryFixed = bg,
        onTertiaryFixedVariant = bg,
        tertiaryContainer = verbalSoft,
        onTertiaryContainer = verbalInk,
        background = bg,
        onBackground = text,
        surface = surface,
        onSurface = text,
        surfaceVariant = surface2,
        onSurfaceVariant = text2,
        surfaceContainerLowest = bg,
        surfaceContainerLow = navBg,
        surfaceContainer = surface,
        surfaceContainerHigh = surface2,
        surfaceContainerHighest = surface3,
        surfaceBright = surface2,
        surfaceDim = bg,
        inverseSurface = text,
        inverseOnSurface = bg,
        inversePrimary = onAccent,
        outline = lineStrong,
        outlineVariant = line,
        error = wrong,
        onError = bg,
        errorContainer = wrongSoft,
        onErrorContainer = wrong,
        scrim = GpDarkColors.bg,
        surfaceTint = Color.Transparent,
    )
}

/** Все роли Material используют вшитый шрифт; заголовки выбирают вариант по ширине окна. */
internal fun GpTypography.toMaterial(wide: Boolean): Typography =
    Typography(
        displayLarge = if (wide) headwordWide else headword,
        displayMedium = if (wide) examNameWide else examName,
        displaySmall = if (wide) scoreNumWide else scoreNum,
        headlineLarge = if (wide) h1Wide else h1,
        headlineMedium = if (wide) startTitleWide else startTitle,
        headlineSmall = h2,
        titleLarge = h2,
        titleMedium = sectionName,
        titleSmall = h3,
        bodyLarge = body,
        bodyMedium = meta,
        bodySmall = caption,
        labelLarge = button,
        labelMedium = navLabel,
        labelSmall = caption,
    )
