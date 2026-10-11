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
    fun countFieldGrowsToFitItsTextAtFontScale130() {
        var lineHeight = 0f
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                GpTheme {
                    lineHeight = with(LocalDensity.current) { Gp.type.sessionCount.lineHeight.value * this.density * this.fontScale }
                    TrainingScreens.Builder()
                }
            }
        }
        val field = compose.onNodeWithTag("builder.count").performScrollTo()
        val results = mutableListOf<TextLayoutResult>()
        field.performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
        val layout = results.single()
        assertTrue(
            "Вся высота строки числа должна помещаться в поле: ${maxOf(
                lineHeight,
                layout.multiParagraph.height,
            )}, ${field.fetchSemanticsNode().layoutInfo.height.toFloat()}",
            maxOf(lineHeight, layout.multiParagraph.height) <=
                field
                    .fetchSemanticsNode()
                    .layoutInfo.height
                    .toFloat(),
        )
    }

    @Test fun modeLabelStaysWholeAndTheSegmentsWrapUnderItAtLargeFont() {
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
        assertTrue("Сегменты должны перейти под целую подпись", segments.top >= labelBounds.bottom)
    }
}
