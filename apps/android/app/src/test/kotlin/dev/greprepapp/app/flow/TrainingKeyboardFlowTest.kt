package dev.greprepapp.app.flow

import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.InputModeManager
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.text.TextLayoutResult
import dev.greprepapp.app.feature.training.NumericResponse
import dev.greprepapp.app.feature.training.PlainPrompt
import dev.greprepapp.app.feature.training.TrainingKeyboard
import dev.greprepapp.app.feature.training.emptyResponse
import dev.greprepapp.app.testing.NewQuestionFixtures
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.design.GpTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "ru-w1000dp-h800dp-land-mdpi-keysexposed-qwerty")
class TrainingKeyboardFlowTest {
    @get:Rule val compose = createAppComposeRule()

    @Test
    fun keyboardFocusDoesNotMergeTheQuestionIntoTheWholeScreen() {
        compose.setContent {
            GpTheme {
                TrainingKeyboard(onKey = { false }) {
                    Text("Вопрос", modifier = Modifier.testTag("prompt"))
                }
            }
        }
        compose.onNodeWithTag("prompt").assertExists()
    }

    @Test
    fun editableNumberKeepsBothArrowEventsUntilFocusLeavesTheField() {
        lateinit var input: InputModeManager
        lateinit var focus: FocusManager
        var navigation = 0
        compose.setContent {
            input = LocalInputModeManager.current
            focus = LocalFocusManager.current
            GpTheme {
                TrainingKeyboard(onKey = { key ->
                    if (key == Key.DirectionLeft || key == Key.DirectionRight) {
                        navigation++
                        true
                    } else {
                        false
                    }
                }) {
                    NumericResponse(NewQuestionFixtures.number, emptyResponse(NewQuestionFixtures.number), false, {})
                }
            }
        }
        compose.runOnIdle { input.requestInputMode(InputMode.Keyboard) }
        compose.onNodeWithTag("numeric.number").performClick().performTextInput("22.5")
        compose.onNodeWithTag("numeric.number").assertIsFocused()
        compose.onRoot().performKeyInput { pressKey(Key.DirectionLeft) }
        compose.onNodeWithTag("numeric.number").performTextInput("0")
        compose.onNodeWithTag("numeric.number").assertTextContains("22.05")
        compose.onRoot().performKeyInput { pressKey(Key.DirectionRight) }
        assertEquals(0, navigation)
        compose.runOnIdle { focus.clearFocus() }
        compose.onRoot().performKeyInput { pressKey(Key.DirectionRight) }
        assertEquals(1, navigation)
    }

    @Test
    fun verbalMultiPromptKeepsEnglishArticlesAndPronounsInBodyType() {
        compose.setContent {
            GpTheme { PlainPrompt(NewQuestionFixtures.rcMulti.copy(prompt = "I visited a library.")) }
        }
        val results = mutableListOf<TextLayoutResult>()
        compose.onNodeWithTag("question.prompt").performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
        assertEquals(
            emptyList<Any>(),
            results
                .single()
                .layoutInput.text.spanStyles,
        )
    }

    @Test
    fun focusedMaterialButtonReceivesEnterBeforeTheScreenShortcut() {
        val focus = FocusRequester()
        lateinit var input: InputModeManager
        var screenActions = 0
        var buttonActions = 0
        compose.setContent {
            input = LocalInputModeManager.current
            GpTheme {
                TrainingKeyboard(onKey = { key ->
                    if (key == Key.Enter) {
                        screenActions++
                        true
                    } else {
                        false
                    }
                }) {
                    Button(onClick = { buttonActions++ }, modifier = Modifier.focusRequester(focus).testTag("focused")) { Text("Кнопка") }
                }
            }
        }
        compose.runOnIdle {
            input.requestInputMode(InputMode.Keyboard)
            focus.requestFocus()
        }
        compose.onNodeWithTag("focused").assertIsFocused()
        compose.onRoot().performKeyInput { pressKey(Key.Enter) }
        assertEquals(1, buttonActions)
        assertEquals(0, screenActions)
    }
}
