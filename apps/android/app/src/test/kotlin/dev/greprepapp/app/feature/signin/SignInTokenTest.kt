package dev.greprepapp.app.feature.signin

import android.content.Context
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.font.FontFamily
import androidx.test.core.app.ApplicationProvider
import dev.greprepapp.app.R
import dev.greprepapp.design.GpTheme
import greprep.design.GpLayout
import greprep.design.GpSignInApple
import greprep.design.GpSignInGoogle
import greprep.design.GpSpace
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "ru-w1200dp-h800dp-land-mdpi")
class SignInTokenTest {
    @get:Rule val compose = createComposeRule()

    private fun render() {
        compose.setContent {
            GpTheme {
                SignInContent(SignInViewModel.UiState(), null, false, {}, {})
            }
        }
    }

    private fun layout(label: String): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        compose
            .onNodeWithText(label, useUnmergedTree = true)
            .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
        return results.single()
    }

    @Test
    fun appleUsesSystemTypographyAndGoogleUsesBundledRoboto() {
        render()
        val apple = layout("Вход с Apple").layoutInput.style
        assertEquals(FontFamily.Default, apple.fontFamily)
        assertEquals(GpSignInApple.fontSize, apple.fontSize)
        assertEquals(GpSignInApple.lineHeight, apple.lineHeight)
        assertEquals(GpSignInApple.fontWeight, apple.fontWeight)
        val google = layout("Войти с аккаунтом Google").layoutInput.style
        assertNotEquals(FontFamily.Default, google.fontFamily)
        assertEquals(GpSignInGoogle.fontSize, google.fontSize)
        assertEquals(GpSignInGoogle.lineHeight, google.lineHeight)
        assertEquals(GpSignInGoogle.fontWeight, google.fontWeight)
        assertEquals(GpSignInGoogle.tracking, google.letterSpacing)
    }

    @Test
    fun wideSignInUsesTheAuthColumnWidth() {
        render()
        val context = ApplicationProvider.getApplicationContext<Context>()
        val tagline = compose.onNodeWithText(context.getString(R.string.signin_tagline)).fetchSemanticsNode().boundsInRoot
        assertTrue(tagline.width <= GpLayout.textMax.value)
        val button = compose.onNodeWithTag("signin.apple").fetchSemanticsNode().boundsInRoot
        assertEquals((GpLayout.authColumnMax - GpSpace.s24 * 2).value, button.width, 0.5f)
    }
}
