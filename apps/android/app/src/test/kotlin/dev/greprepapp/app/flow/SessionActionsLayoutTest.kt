package dev.greprepapp.app.flow

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import dev.greprepapp.app.feature.training.BottomActions
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.app.ui.EmptyState
import dev.greprepapp.design.Gp
import dev.greprepapp.design.GpPrimaryButton
import dev.greprepapp.design.GpTheme
import greprep.design.GpLayout
import greprep.design.GpLightColors
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "ru-w1200dp-h800dp-land-mdpi")
class SessionActionsLayoutTest {
    @get:Rule val compose = createAppComposeRule()

    @Test
    fun actionsHaveAFlatBackgroundAndUseSessionWidth() {
        var attempt by mutableIntStateOf(0)
        compose.setContent {
            key(attempt) {
                GpTheme(darkTheme = false) {
                    Box(Modifier.fillMaxSize().background(Gp.colors.surface2)) {
                        BottomActions(Modifier.testTag("actions")) {
                            GpPrimaryButton("Продолжить", onClick = {}, modifier = Modifier.fillMaxWidth().testTag("button"))
                        }
                    }
                }
            }
        }
        // Как в SnapshotBase: NATIVE иногда снимает однотонный фон окна вместо первого кадра.
        // Повторяем только такой кадр; нарисованный неверный фон сразу остаётся ошибкой теста.
        var rendered: android.graphics.Bitmap? = null
        repeat(3) {
            if (rendered == null) {
                compose.waitForIdle()
                val frame = compose.onNodeWithTag("actions").captureToImage().asAndroidBitmap()
                val first = frame.getPixel(0, 0)
                val blank =
                    (0 until frame.height step 16).all { y ->
                        (0 until frame.width step 16).all { x -> frame.getPixel(x, y) == first }
                    }
                if (blank) attempt++ else rendered = frame
            }
        }
        assertEquals(GpLightColors.bg.toArgb(), checkNotNull(rendered) { "Действие не нарисовалось" }.getPixel(0, 0))
        assertEquals(
            GpLayout.sessionMax.value,
            compose
                .onNodeWithTag("button")
                .fetchSemanticsNode()
                .boundsInRoot.width,
            0.5f,
        )
    }

    @Test
    fun centeredEmptyStateUsesTheNarrowTextColumn() {
        compose.setContent {
            GpTheme(darkTheme = false) {
                EmptyState(
                    "Нет сети",
                    "Подключитесь к сети, чтобы продолжить тренировку. Ответы сохраняются на устройстве, и после восстановления связи вы сможете вернуться к следующему заданию.",
                    Modifier.testTag("state"),
                )
            }
        }
        val nodes = compose.onNodeWithTag("state").fetchSemanticsNode().children
        assertTrue(nodes.all { it.boundsInRoot.width <= GpLayout.textMax.value })
    }
}
