package dev.greprepapp.app.design

import android.graphics.Typeface
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import dev.greprepapp.design.GeologicaFamily
import dev.greprepapp.design.Gp
import dev.greprepapp.design.GpTheme
import dev.greprepapp.design.MathFamily
import dev.greprepapp.design.PlexMonoFamily
import greprep.design.GpDarkColors
import greprep.design.GpDarkTheme
import greprep.design.GpLightColors
import greprep.design.GpLightTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.GraphicsMode

/** Проверяем измеренный Text и загруженный Typeface, а не только имя семейства в таблице токенов. */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TypographyTest(
    private val dark: Boolean,
) {
    @get:Rule val compose = createComposeRule()

    @Test
    fun everyRoleRendersWithItsBundledFamilyAndThematicWeight() {
        val styles = linkedMapOf<String, TextStyle>()
        val resolved = mutableListOf<Typeface>()
        compose.setContent {
            GpTheme(darkTheme = dark) {
                assertSame(if (dark) GpDarkColors else GpLightColors, Gp.colors)
                assertSame(if (dark) GpDarkTheme else GpLightTheme, Gp.theme)
                assertEquals(if (dark) FontWeight.W200 else FontWeight.W300, Gp.theme.thin)
                // Все роли, включая будущие экраны: новая роль автоматически попадает в проверку.
                Gp.type.javaClass.declaredFields.filter { it.type == TextStyle::class.java }.forEach { field ->
                    field.isAccessible = true
                    styles[field.name] = field.get(Gp.type) as TextStyle
                }
                val resolver = LocalFontFamilyResolver.current
                Column {
                    styles.forEach { (name, style) ->
                        Text("$name · Пример 123", style = style)
                        resolved += resolver.resolve(style.fontFamily, style.fontWeight ?: FontWeight.W400).value as Typeface
                    }
                    Text("material · Пример", style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
        assertEquals(GeologicaFamily, layout("material · Пример").layoutInput.style.fontFamily)
        assertTrue(styles.keys.containsAll(ThinRoles))
        styles.forEach { (name, style) ->
            val expected: FontFamily = if (name == "ipa") PlexMonoFamily else GeologicaFamily
            assertEquals(name, expected, layout("$name · Пример 123").layoutInput.style.fontFamily)
            if (name in ThinRoles) assertEquals(name, if (dark) FontWeight.W200 else FontWeight.W300, style.fontWeight)
        }
        resolved.forEach { assertNotEquals("шрифт не подменился системным", Typeface.DEFAULT, it) }
    }

    @Test
    fun materialColorsAllComeFromTokens() {
        compose.setContent {
            GpTheme(darkTheme = dark) {
                val tokenColors =
                    Gp.colors.javaClass.declaredFields
                        .filter { it.type == java.lang.Long.TYPE }
                        .map { field ->
                            field.isAccessible = true
                            field.getLong(Gp.colors)
                        }.toSet() + GpDarkColors.bg.value.toLong() +
                        androidx.compose.ui.graphics.Color.Transparent.value
                            .toLong()
                val scheme = MaterialTheme.colorScheme
                scheme.javaClass.declaredFields.filter { it.type == java.lang.Long.TYPE }.forEach { field ->
                    field.isAccessible = true
                    assertTrue("Material ${field.name} должен быть токеном", field.getLong(scheme) in tokenColors)
                }
            }
        }
    }

    @Test
    fun quantMathHasBundledUprightAndItalicFaces() {
        assertEquals(2, (MathFamily as androidx.compose.ui.text.font.FontListFontFamily).fonts.size)
        compose.setContent {
            GpTheme(darkTheme = dark) {
                Text(
                    "x + 2",
                    style = Gp.type.qText.copy(fontFamily = MathFamily, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic),
                )
            }
        }
        assertEquals(MathFamily, layout("x + 2").layoutInput.style.fontFamily)
    }

    private fun layout(text: String): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText(text).performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
        return results.single()
    }

    companion object {
        private val ThinRoles =
            setOf(
                "sectionStat",
                "sectionStatWide",
                "sessionCount",
                "sessionCountWide",
                "scoreNum",
                "scoreNumWide",
                "statValue",
                "examName",
                "examNameWide",
                "headword",
                "headwordWide",
                "weekCount",
            )

        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "dark={0}")
        fun themes() = listOf(arrayOf(false), arrayOf(true))
    }
}
