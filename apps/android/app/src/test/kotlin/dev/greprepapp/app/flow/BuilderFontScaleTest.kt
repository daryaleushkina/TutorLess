package dev.greprepapp.app.flow

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import dev.greprepapp.app.snapshots.TrainingScreens
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.design.Gp
import dev.greprepapp.design.GpTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "ru-" + RobolectricDeviceQualifiers.MediumPhone)
class BuilderFontScaleTest {
    @get:Rule val compose = createAppComposeRule()

    @Test
    fun countChoicesFitAtFontScale130() = countChoicesFit(1.3f)

    @Test
    fun countChoicesFitAtFontScale200() = countChoicesFit(2f)

    private fun countChoicesFit(scale: Float) {
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, scale)) {
                GpTheme { TrainingScreens.Builder() }
            }
        }
        compose.onNodeWithTag("builder.count").performScrollTo()
        for (text in listOf("5", "10", "15", "20")) {
            val results = mutableListOf<TextLayoutResult>()
            val node = compose.onNodeWithText(text, useUnmergedTree = true)
            node.performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
            assertEquals(1, results.single().lineCount)
            val layout = results.single()
            // softWrap=false оставляет Paragraph с дробной шириной. Глиф «5» занимает 28 px
            // в рамке 29 px, хотя didOverflowWidth=true: проверяем нарисованную строку.
            assertTrue("Число $text обрезается слева", layout.getLineLeft(0) >= 0)
            assertTrue("Число $text обрезается справа", layout.getLineRight(0) <= layout.size.width)
            assertTrue("Число $text обрезается по высоте", !layout.didOverflowHeight)
            assertEquals(text.length, layout.getLineEnd(0, visibleEnd = true))
        }
    }

    @Test fun modeLabelStaysWholeAndTheChoicesDoNotOverlapItAtLargeFont() {
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                GpTheme { TrainingScreens.Builder() }
            }
        }
        val label = compose.onNodeWithText("Режим", useUnmergedTree = true).performScrollTo()
        val results = mutableListOf<TextLayoutResult>()
        label.performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
        assertEquals(1, results.single().lineCount)
        val labelBounds = label.fetchSemanticsNode().boundsInRoot
        val segments = compose.onNodeWithTag("builder.mode.practice").fetchSemanticsNode().boundsInRoot
        assertTrue("Выбор режима не должен налезать на подпись", !segments.overlaps(labelBounds))
    }
}
