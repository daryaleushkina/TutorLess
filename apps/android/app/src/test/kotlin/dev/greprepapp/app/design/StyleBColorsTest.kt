package dev.greprepapp.app.design

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import dev.greprepapp.api.models.Section
import dev.greprepapp.app.feature.shell.MainScaffold
import dev.greprepapp.app.snapshots.TrainingScreens
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.design.GpTheme
import greprep.design.GpDarkColors
import greprep.design.GpLightColors
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Проверяем цвет отрисованного текста: базовая палитра не должна попасть в подписи и цифры. */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "ru-" + RobolectricDeviceQualifiers.MediumPhone)
class StyleBColorsTest(
    private val dark: Boolean,
) {
    @get:Rule val compose = createAppComposeRule()

    private val colors = if (dark) GpDarkColors else GpLightColors

    @Test
    fun activeNavigationUsesText() {
        compose.setContent {
            GpTheme(darkTheme = dark) {
                MainScaffold(appVersion = "0.1.0 (1)", onSignOut = {}) {}
            }
        }
        assertColor(
            colors.text,
            compose.onNode(hasText("Тренировка") and hasAnyAncestor(hasTestTag("tab.training")), useUnmergedTree = true),
        )
    }

    @Test
    fun questionHeadingUsesSectionInk() {
        compose.setContent { GpTheme(darkTheme = dark) { TrainingScreens.Session(TrainingScreens.tcSelected) } }
        assertColor(colors.verbalInk, compose.onNodeWithText("Text Completion", useUnmergedTree = true))
    }

    @Test
    fun summaryNumberUsesSectionInk() {
        compose.setContent { GpTheme(darkTheme = dark) { TrainingScreens.Session(TrainingScreens.summary) } }
        assertColor(colors.verbalInk, compose.onNodeWithTag("summary.correct"))
    }

    private fun assertColor(
        expected: Color,
        node: SemanticsNodeInteraction,
    ) {
        val results = mutableListOf<TextLayoutResult>()
        node.performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
        assertEquals(
            expected,
            results
                .single()
                .layoutInput.style.color,
        )
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "dark={0}")
        fun themes() = listOf(arrayOf(false), arrayOf(true))
    }
}
