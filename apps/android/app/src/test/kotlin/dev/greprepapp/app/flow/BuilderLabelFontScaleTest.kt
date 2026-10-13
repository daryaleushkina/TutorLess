package dev.greprepapp.app.flow

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import dev.greprepapp.app.feature.training.FieldRow
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.design.Gp
import dev.greprepapp.design.GpTheme
import greprep.design.GpLayout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w320dp-h800dp-160dpi")
class BuilderLabelFontScaleTest {
    @get:Rule val compose = createAppComposeRule()

    @Test
    @Config(qualifiers = "ru-w320dp-h800dp-160dpi")
    fun russianLabelsStayWholeOrWrapAtWordBoundaries() = checkLabel("Режим", "Количество вопросов")

    @Test
    @Config(qualifiers = "en-w320dp-h800dp-160dpi")
    fun englishLabelsStayWholeOrWrapAtWordBoundaries() = checkLabel("Mode", "Number of questions")

    private fun checkLabel(
        short: String,
        long: String,
    ) {
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 2f)) {
                GpTheme {
                    Column(Modifier.fillMaxWidth().padding(horizontal = GpLayout.gutter)) {
                        FieldRow(short) { Text("10", style = Gp.type.sessionCount) }
                        FieldRow(long) { Text("10", style = Gp.type.sessionCount) }
                    }
                }
            }
        }
        assertEquals(1, layout(short).lineCount)
        val result = layout(long)
        assertFalse("Длинная подпись не должна обрезаться", result.hasVisualOverflow)
        assertTrue("Подпись должна перенестись по словам", result.lineCount > 1)
        for (line in 0 until result.lineCount - 1) {
            val end = result.getLineEnd(line, visibleEnd = true)
            assertTrue("Перенос внутри слова: $long, позиция $end", long.getOrNull(end)?.isWhitespace() == true)
        }
    }

    private fun layout(text: String): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText(text, useUnmergedTree = true).performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
        return results.single()
    }
}
