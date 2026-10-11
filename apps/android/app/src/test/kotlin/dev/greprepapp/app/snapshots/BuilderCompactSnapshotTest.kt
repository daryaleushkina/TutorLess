package dev.greprepapp.app.snapshots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollTo
import dev.greprepapp.app.feature.training.FieldRow
import dev.greprepapp.design.Gp
import greprep.design.GpLayout
import greprep.design.GpSpace
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Узкий телефон и шрифт 200 %: настоящий конструктор и длинные подписи строки в обоих языках. */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "ru-w320dp-h800dp-160dpi")
class BuilderCompactSnapshotTest(
    theme: String,
) : SnapshotBase(theme) {
    @Test
    fun builderFont200Russian() =
        snap(
            "training-builder-320-font-200-ru",
            systemFontScale = 2f,
            beforeCapture = { compose.onNodeWithTag("builder.count").performScrollTo() },
        ) { TrainingScreens.Builder() }

    @Test
    @Config(qualifiers = "en-w320dp-h800dp-160dpi")
    fun builderFont200English() =
        snap(
            "training-builder-320-font-200-en",
            systemFontScale = 2f,
            beforeCapture = { compose.onNodeWithTag("builder.count").performScrollTo() },
        ) { TrainingScreens.Builder() }

    @Test
    fun longLabelFont200Russian() =
        snap("training-builder-label-320-font-200-ru", systemFontScale = 2f) { Label("Режим", "Количество вопросов") }

    @Test
    @Config(qualifiers = "en-w320dp-h800dp-160dpi")
    fun longLabelFont200English() =
        snap("training-builder-label-320-font-200-en", systemFontScale = 2f) { Label("Mode", "Number of questions") }

    @Composable
    private fun Label(
        short: String,
        long: String,
    ) {
        Column(
            Modifier.fillMaxSize().background(Gp.colors.bg).padding(horizontal = GpLayout.gutter, vertical = GpSpace.s24),
        ) {
            FieldRow(short) { Text("10", style = Gp.type.sessionCount) }
            FieldRow(long) { Text("10", style = Gp.type.sessionCount) }
        }
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}")
        fun themes() = listOf(arrayOf("light"), arrayOf("dark"))
    }
}
