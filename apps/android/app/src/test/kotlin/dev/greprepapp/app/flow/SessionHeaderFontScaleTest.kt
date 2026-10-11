package dev.greprepapp.app.flow

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import dev.greprepapp.app.snapshots.TrainingScreens
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.design.GpTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "ru-w360dp-h800dp-160dpi")
class SessionHeaderFontScaleTest {
    @get:Rule val compose = createAppComposeRule()

    @Test fun timerAndProgressStayWholeAndClearOfAllHeaderButtonsAtFontScale130() {
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                GpTheme { TrainingScreens.Session(TrainingScreens.qcTimed) }
            }
        }
        val timer =
            compose
                .onNodeWithTag("session.timer")
                .assertIsDisplayed()
                .fetchSemanticsNode()
                .boundsInRoot
        for (text in listOf("12:40", "1 из 2")) {
            val results = mutableListOf<TextLayoutResult>()
            val node = compose.onNodeWithText(text, useUnmergedTree = true)
            node.performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
            assertEquals("Текст $text должен быть целиком на одной строке", 1, results.single().lineCount)
            val layout = results.single()
            val bounds = node.fetchSemanticsNode().boundsInRoot
            // softWrap=false может оставить Paragraph шире занятого текстом места.
            // Проверяем границы нарисованной строки, а не ширину пустой части Paragraph.
            assertTrue(
                "Все глифы $text должны помещаться в своей области",
                layout.getLineLeft(0) >= 0 && layout.getLineRight(0) <= bounds.width,
            )
            assertFalse("Строка $text не должна обрезаться по высоте", layout.didOverflowHeight)
            assertTrue("Текст $text должен помещаться в пилюле", timer.contains(bounds.topLeft) && timer.contains(bounds.bottomRight))
        }
        val close =
            compose
                .onNodeWithTag("session.close")
                .assertIsDisplayed()
                .fetchSemanticsNode()
                .boundsInRoot
        val flag =
            compose
                .onNodeWithTag("question.flag")
                .assertIsDisplayed()
                .fetchSemanticsNode()
                .boundsInRoot
        val overview =
            compose
                .onNodeWithTag("question.overview")
                .assertIsDisplayed()
                .fetchSemanticsNode()
                .boundsInRoot
        for (button in listOf(close, flag, overview)) {
            assertFalse("Таймер не должен налезать на кнопку", timer.overlaps(button))
        }
        assertTrue("Пилюля должна помещаться на 360 dp", timer.left >= 0 && timer.right <= 360)
    }
}
