package dev.greprepapp.design

import androidx.compose.ui.text.font.FontListFontFamily
import androidx.compose.ui.text.font.ResourceFont
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

/** Вес 650 обязан иметь своё начертание на оси wght, без округления до 600 или 700. */
@RunWith(RobolectricTestRunner::class)
class TextFamilyTest {
    @Test
    fun bundledTextFamilyUsesOnestAtEveryRequiredWeight() {
        val fonts = (OnestFamily as FontListFontFamily).fonts
        assertEquals(listOf(400, 500, 600, 650, 700, 800), fonts.map { it.weight.weight })
        val resources = RuntimeEnvironment.getApplication().resources
        fonts.forEach { font ->
            assertEquals("onest_variable", resources.getResourceEntryName((font as ResourceFont).resId))
        }
    }
}
