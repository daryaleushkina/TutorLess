package dev.greprepapp.app.flow

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import dev.greprepapp.api.models.NumericAnswer
import dev.greprepapp.api.models.Question
import dev.greprepapp.app.feature.training.Response
import dev.greprepapp.app.feature.training.SessionActions
import dev.greprepapp.app.feature.training.SessionContent
import dev.greprepapp.app.feature.training.SessionViewModel
import dev.greprepapp.app.feature.training.emptyResponse
import dev.greprepapp.app.snapshots.TrainingScreens
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.design.GpTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import dev.greprepapp.app.testing.NewQuestionFixtures as Q

@RunWith(ParameterizedRobolectricTestRunner::class)
@Config(qualifiers = "ru-w360dp-h800dp-160dpi")
class NewResponseLayoutFlowTest(
    private val fontScale: Float,
) {
    @get:Rule val compose = createAppComposeRule()

    private fun show(question: Question): (Response) -> Unit {
        val response = mutableStateOf(emptyResponse(question))
        val limitHit = mutableStateOf(false)
        val training = TrainingScreens.stored(question)
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
                GpTheme {
                    SessionContent(
                        SessionViewModel.UiState.Active(
                            SessionViewModel.Screen(
                                training,
                                0,
                                response.value,
                                null,
                                false,
                                false,
                                false,
                                selectionLimitHit = limitHit.value,
                            ),
                        ),
                        SessionViewModel.RepeatState(),
                        SessionActions(onEditResponse = {
                            val change = it(response.value)
                            response.value = change.response
                            limitHit.value = change.limitHit
                        }),
                    )
                }
            }
        }
        return { response.value = it }
    }

    @Test fun fractionLabelsFieldsAndErrorsFitAndImeNextFocusesTheDenominator() {
        show(Q.fraction)
        compose.onNodeWithTag("numeric.numerator").performScrollTo().performTextInput("9")
        compose.onNodeWithTag("numeric.numerator").performClick().performImeAction()
        compose.onNodeWithTag("numeric.denominator").assertIsFocused().performTextInput("0")
        compose.onNodeWithTag("numeric.error").performScrollTo().assertIsDisplayed()
        assertTextsFit()
        compose.onNodeWithTag("numeric.denominator").performScrollTo().performTextReplacement("15")
        assertFieldAboveActions("numeric.denominator")
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsEnabled()
        assertTextsFit()
    }

    @Test fun decimalFieldAcceptsExternalValuesAndLabelsStayWhole() {
        val inject = show(Q.number)
        compose.onNodeWithTag("numeric.number").performScrollTo().performTextInput("22,5")
        compose.onNodeWithTag("numeric.number").assertTextContains("22,5")
        compose.runOnIdle { inject(Response.Numeric(NumericAnswer(number = "48"))) }
        compose.onNodeWithTag("numeric.number").assertTextContains("48")
        assertFieldAboveActions("numeric.number")
        assertTextsFit()
    }

    @Test fun sentenceIsAnAccessibleIndependentTargetAndTextDoesNotClip() {
        show(Q.sentence)
        compose.onNodeWithTag("sentence.s5").performScrollTo().performClick().assertContentDescriptionEquals(
            "Абзац 2, предложение 2. " +
                Q.passage.paragraphs[1]
                    .sentences[1]
                    .text,
        )
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsEnabled()
        assertTextsFit()
    }

    @Test fun phoneReadingTabsShareTheWidthAndExposeTabSemantics() {
        show(Q.rc)
        val left = compose.onNodeWithTag("reading.text")
        val right = compose.onNodeWithTag("reading.question")
        left.assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Tab))
        right.assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Tab))
        assertEquals(left.fetchSemanticsNode().boundsInRoot.width, right.fetchSemanticsNode().boundsInRoot.width, 1f)
        right.performClick()
        compose.onNodeWithTag("option.B").performScrollTo().performClick()
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsEnabled()
        left.performClick()
        right.performClick()
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsEnabled()
        assertTextsFit()
    }

    @Test fun fixedCountMultiAnnouncesTheCountAndRefusesAnExtraChoice() {
        show(Q.multi.copy(selectCount = 3, answer = listOf("A", "B", "D")))
        compose.onNodeWithTag("question.instruction").assertTextContains("Выберите 3 варианта.")
        listOf("A", "B", "D", "C").forEach { compose.onNodeWithTag("option.$it").performScrollTo().performClick() }
        compose.onNodeWithTag("question.instruction").performScrollTo().assertTextContains("Сначала снимите отметку", substring = true)
        compose.onNodeWithTag("option.A").performScrollTo().performClick()
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsNotEnabled()
        compose.onNodeWithTag("session.note").assertTextContains("Выберите ещё 1 вариант")
        assertTextsFit()
    }

    @Test
    @Config(qualifiers = "ru-w1280dp-h800dp-land-160dpi")
    fun tabletReadingColumnsScrollIndependently() {
        val passage = Q.passage.copy(paragraphs = List(6) { Q.passage.paragraphs[it % 2] })
        show(Q.rc.copy(passage = passage, prompt = List(4) { Q.rc.prompt }.joinToString(" ")))
        compose.onNodeWithTag("reading.text").assertDoesNotExist()
        compose.onNodeWithTag("passage.paragraph.4").performScrollTo()
        val left = scroll("question.left")
        assertTrue(left > 0)
        assertEquals(0f, scroll("question.right"))
        compose.onNodeWithTag("option.E").performScrollTo()
        assertTrue(scroll("question.right") > 0)
        assertEquals(left, scroll("question.left"))
        compose.onNodeWithTag("option.B").performScrollTo().performClick()
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsEnabled()
        assertTextsFit()
    }

    private fun scroll(tag: String) =
        compose
            .onNodeWithTag(tag)
            .fetchSemanticsNode()
            .config[SemanticsProperties.VerticalScrollAxisRange]
            .value()

    private fun assertFieldAboveActions(tag: String) {
        val field =
            compose
                .onNodeWithTag(tag)
                .performScrollTo()
                .assertIsDisplayed()
                .fetchSemanticsNode()
                .boundsInRoot
        val actions = compose.onNodeWithTag("question.check", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        assertTrue("Поле должно быть над нижней панелью", field.bottom <= actions.top)
    }

    private fun assertTextsFit() {
        val texts = compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.GetTextLayoutResult), useUnmergedTree = true)
        for (index in texts.fetchSemanticsNodes().indices) {
            val layouts = mutableListOf<TextLayoutResult>()
            texts[index].performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
            for (layout in layouts) {
                assertFalse("${layout.layoutInput.text}: текст обрезан по высоте", layout.didOverflowHeight)
                for (line in 0 until layout.lineCount) assertFalse("${layout.layoutInput.text}: многоточие", layout.isLineEllipsized(line))
            }
        }
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "fontScale={0}")
        fun scales() = listOf(arrayOf(1.3f), arrayOf(2f))
    }
}
