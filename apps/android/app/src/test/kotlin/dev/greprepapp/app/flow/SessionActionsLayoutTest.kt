package dev.greprepapp.app.flow

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import dev.greprepapp.app.feature.training.BottomActions
import dev.greprepapp.app.ui.EmptyState
import dev.greprepapp.design.Gp
import dev.greprepapp.design.GpTheme
import greprep.design.GpLayout
import greprep.design.GpLightColors
import greprep.design.GpSize
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
    @get:Rule val compose = createComposeRule()

    @Test
    fun actionsHaveAFlatBackgroundAndUseSessionWidth() {
        compose.setContent {
            GpTheme(darkTheme = false) {
                Box(Modifier.background(Gp.colors.surface2)) {
                    BottomActions(Modifier.testTag("actions")) {
                        Box(Modifier.fillMaxWidth().height(GpSize.button).testTag("button"))
                    }
                }
            }
        }
        val frame = compose.onNodeWithTag("actions").captureToImage().asAndroidBitmap()
        assertEquals(GpLightColors.bg.toArgb(), frame.getPixel(0, 0))
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
            GpTheme(darkTheme = false) { EmptyState("Нет сети", "Подключитесь к сети, чтобы продолжить.", Modifier.testTag("state")) }
        }
        val nodes = compose.onNodeWithTag("state").fetchSemanticsNode().children
        assertTrue(nodes.all { it.boundsInRoot.width <= GpLayout.textMax.value })
    }
}
