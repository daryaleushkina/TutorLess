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
import dev.greprepapp.api.models.StepState
import dev.greprepapp.app.feature.shell.MainScaffold
import dev.greprepapp.app.feature.today.TodayContent
import dev.greprepapp.app.feature.today.TodayPlan
import dev.greprepapp.app.feature.today.TodayViewModel
import dev.greprepapp.app.snapshots.TrainingScreens
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.app.testing.plan
import dev.greprepapp.app.testing.step
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
    fun todaySectionLabelsUseInkAndActiveNavigationUsesText() {
        val today =
            TodayPlan.from(
                plan(
                    step("v", Section.VERBAL, StepState.CURRENT, 10, "Текущий шаг"),
                    step("q", Section.QUANT, StepState.NEXT, 10, "Следующий шаг"),
                    step("w", Section.WORDS, StepState.NEXT, 5, "Шаг со словами"),
                    step("e", Section.ESSAY, StepState.NEXT, 30, "Шаг с эссе"),
                ),
            )
        compose.setContent {
            GpTheme(darkTheme = dark) {
                MainScaffold(appVersion = "0.1.0 (1)", onSignOut = {}) {
                    TodayContent(
                        TodayViewModel.UiState(content = TodayViewModel.Content.Plan(today)),
                        onRefresh = {},
                        onSelect = {},
                    )
                }
            }
        }
        assertColor(colors.verbalInk, compose.onNodeWithText("Verbal", useUnmergedTree = true))
        assertColor(colors.quantInk, compose.onNodeWithText("Quant", useUnmergedTree = true))
        assertColor(
            colors.text,
            compose.onNode(hasText("Сегодня") and hasAnyAncestor(hasTestTag("tab.today")), useUnmergedTree = true),
        )
        compose.onNodeWithTag("today.plan").performScrollToNode(hasText("Слова"))
        // «Слова» есть и во вкладках: цвет раздела проверяем внутри строки плана.
        assertColor(
            colors.wordsInk,
            compose.onNode(hasText("Слова") and hasAnyAncestor(hasTestTag("today.step.w")), useUnmergedTree = true),
        )
        compose.onNodeWithTag("today.plan").performScrollToNode(hasText("Эссе"))
        assertColor(colors.essayInk, compose.onNodeWithText("Эссе", useUnmergedTree = true))
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
