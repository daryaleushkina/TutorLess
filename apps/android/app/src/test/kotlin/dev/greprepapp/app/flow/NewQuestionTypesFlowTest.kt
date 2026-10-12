package dev.greprepapp.app.flow

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dev.greprepapp.api.models.Question
import dev.greprepapp.api.models.TrainingMode
import dev.greprepapp.app.MainActivity
import dev.greprepapp.app.feature.training.TrainingRepository
import dev.greprepapp.app.feature.training.TrainingStore
import dev.greprepapp.app.testing.FakeNetwork
import dev.greprepapp.app.testing.Fixtures
import dev.greprepapp.app.testing.NightModeResetRule
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import javax.inject.Inject
import dev.greprepapp.app.testing.NewQuestionFixtures as Q

/** Новые формы проходят через настоящий корень, JSON-сервер, сохранение на диск и очередь. */
@OptIn(ExperimentalTestApi::class)
@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
@Config(application = HiltTestApplication::class, qualifiers = "ru-w411dp-h914dp-420dpi")
class NewQuestionTypesFlowTest {
    @get:Rule(order = -1)
    val nightMode = NightModeResetRule()

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createEmptyComposeRule()

    @Inject @dev.greprepapp.app.core.AppScope
    lateinit var scope: kotlinx.coroutines.CoroutineScope

    @Inject lateinit var server: FakeServer

    @Inject lateinit var network: FakeNetwork

    @Inject lateinit var store: TrainingStore

    @Inject lateinit var clock: dev.greprepapp.app.testing.MutableClock
    private var scenario: ActivityScenario<MainActivity>? = null

    @Before fun setUp() = hilt.inject()

    @After fun tearDown() {
        scope.cancel()
        scenario?.close()
    }

    private fun waitFor(tag: String) = compose.waitUntilAtLeastOneExists(hasTestTag(tag), 10_000)

    private fun click(tag: String) {
        waitFor(tag)
        compose.onNodeWithTag(tag).performClick()
    }

    private fun start(
        vararg questions: Question,
        check: Boolean = false,
    ) {
        server.nextSession = Fixtures.session(*questions, mode = if (check) TrainingMode.CHECK else TrainingMode.PRACTICE)
        scenario = ActivityScenario.launch(MainActivity::class.java)
        waitFor("signin.dev.name")
        compose.onNodeWithTag("signin.dev.name").performTextInput("new-gre-forms")
        click("signin.dev.submit")
        waitFor("training.home")
        compose.onNodeWithTag("shell.scroll").performScrollToNode(hasTestTag("home.configure"))
        click("home.configure")
        if (check) click("builder.mode.check")
        click("builder.start")
        waitFor(if (questions.first().passage != null) "passage" else "question.prompt")
    }

    private fun checkAndNext() {
        click("question.check")
        waitFor("explanation")
        click("question.next")
    }

    @Test fun readingAndSentenceFinishOfflineSurviveRecreationAndDrainTheQueue() {
        start(Q.rc, Q.sentence)
        server.down = true
        network.isOnline.value = false
        click("reading.question")
        click("option.B")
        scenario!!.recreate()
        waitFor("option.B")
        compose.onNodeWithTag("option.B").assertIsSelected()
        checkAndNext()
        compose.onNodeWithTag("sentence.s4").performScrollTo().performClick()
        compose.onNodeWithTag("sentence.s5").performScrollTo().performClick()
        compose.onNodeWithTag("sentence.s4").assertIsNotSelected()
        scenario!!.recreate()
        waitFor("sentence.s5")
        compose.onNodeWithTag("sentence.s5").assertIsSelected()
        checkAndNext()
        waitFor("summary")
        compose.onNodeWithTag("summary.correct").assertTextEquals("2")
        compose.waitUntil(10_000) {
            store.trainings.value.values
                .single()
                .answers.size == 2
        }
        assertTrue(server.answers.isEmpty())
        assertEquals(
            setOf(0, 1),
            store.trainings.value.values
                .single()
                .unsent,
        )
        server.down = false
        network.isOnline.value = true
        compose.waitUntil(10_000) {
            store.trainings.value.values
                .single()
                .unsent
                .isEmpty() && server.finishes.size == 1
        }
        val answers = server.answers.flatMap { it.answers }.associateBy { it.position }
        assertEquals(listOf("B"), answers.getValue(0).optionIds)
        assertEquals("s5", answers.getValue(1).sentenceId)
        assertCapabilities()
        click("summary.review")
        click("review.item.0")
        click("reading.text")
        compose.onNodeWithTag("passage").assertIsDisplayed()
        click("reading.question")
        compose.onNodeWithTag("explanation").performScrollTo().assertIsDisplayed()
    }

    @Test fun partialMultiCommaNumberAndUnreducedFractionFinishOffline() {
        start(Q.multi, Q.number, Q.fraction)
        server.down = true
        network.isOnline.value = false
        click("option.B")
        checkAndNext()
        compose.onNodeWithTag("numeric.number").performTextInput("22,5")
        scenario!!.recreate()
        waitFor("numeric.number")
        compose.onNodeWithTag("numeric.number").assertTextContains("22,5")
        checkAndNext()
        compose.onNodeWithTag("numeric.numerator").performScrollTo().performTextInput("9")
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsNotEnabled()
        compose.onNodeWithTag("numeric.denominator").performScrollTo().performTextInput("0")
        compose.onNodeWithTag("numeric.error").performScrollTo().assertTextContains("нулём", substring = true)
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsNotEnabled()
        compose.onNodeWithTag("numeric.denominator").performScrollTo().performTextReplacement("15")
        scenario!!.recreate()
        waitFor("numeric.numerator")
        compose.onNodeWithTag("numeric.numerator").assertTextContains("9")
        compose.onNodeWithTag("numeric.denominator").assertTextContains("15")
        checkAndNext()
        waitFor("summary")
        compose.onNodeWithTag("summary.correct").assertTextEquals("2")
        assertTrue(server.answers.isEmpty())
        server.down = false
        network.isOnline.value = true
        compose.waitUntil(10_000) {
            store.trainings.value.values
                .single()
                .unsent
                .isEmpty() && server.finishes.size == 1
        }
        val answers = server.answers.flatMap { it.answers }.associateBy { it.position }
        assertEquals(listOf("B"), answers.getValue(0).optionIds)
        assertEquals("22.5", answers.getValue(1).numericAnswer?.number)
        assertEquals("9", answers.getValue(2).numericAnswer?.numerator)
        assertEquals("15", answers.getValue(2).numericAnswer?.denominator)
        assertCapabilities()
    }

    @Test fun pastedBadNumberShowsAnErrorAndCannotBeChecked() {
        start(Q.number)
        compose.onNodeWithTag("numeric.number").performTextInput("22,5,0")
        compose.onNodeWithTag("numeric.error").assertTextContains("Так число не записать", substring = true)
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsNotEnabled()
        scenario!!.recreate()
        waitFor("numeric.error")
        compose.onNodeWithTag("numeric.number").assertTextContains("22,5,0")
        assertTrue(server.answers.isEmpty())
        compose.onNodeWithTag("numeric.number").performTextReplacement("22.50")
        checkAndNext()
        waitFor("summary")
        compose.onNodeWithTag("summary.correct").assertTextEquals("1")
    }

    @Test fun checkModeDoesNotSendMalformedNumericDrafts() {
        start(Q.number, check = true)
        compose.onNodeWithTag("numeric.number").performTextInput("22,5,0")
        compose.onNodeWithTag("numeric.error").assertExists()
        compose.waitUntil(10_000) {
            store.trainings.value.values
                .single()
                .answers
                .isNotEmpty()
        }
        assertTrue(
            store.trainings.value.values
                .single()
                .answers.values
                .all { it.toGivenAnswer().numericAnswer == null },
        )
        compose.onNodeWithTag("numeric.number").performTextReplacement("22,5")
        click("question.next")
        click("overview.finish")
        waitFor("summary")
        compose.onNodeWithTag("summary.correct").assertTextEquals("1")
        compose.waitUntil(10_000) { server.finishes.size == 1 }
        assertTrue(server.answers.flatMap { it.answers }.all { it.numericAnswer?.number == null || it.numericAnswer?.number == "22.5" })
    }

    @Test fun selectedWrongAndOmittedRightAreMarkedAfterChecking() {
        start(Q.multi)
        click("option.B")
        click("option.C")
        click("question.check")
        waitFor("explanation")
        compose.onNodeWithTag("explanation.verdict").assertTextContains("Неверно", substring = true)
        compose
            .onNodeWithTag(
                "option.C",
            ).assertIsOn()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "выбран, неверный"))
        compose
            .onNodeWithTag(
                "option.A",
            ).assertIsOff()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "не выбран, верный"))
        compose
            .onNodeWithTag(
                "option.B",
            ).assertIsOn()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "выбран, верный"))
    }

    @Test fun readingMultiKeepsTextAndOffersCheckboxesAndAnExplanation() {
        start(Q.rcMulti)
        click("reading.question")
        click("option.A")
        click("option.C")
        compose.onNodeWithTag("option.A").assertIsOn()
        compose.onNodeWithTag("option.C").assertIsOn()
        click("reading.text")
        compose.onNodeWithTag("passage").assertIsDisplayed()
        click("reading.question")
        click("question.check")
        waitFor("explanation")
        compose.onNodeWithTag("explanation.verdict").assertTextContains("Верно", substring = true)
        click("reading.text")
        compose.onNodeWithTag("passage").assertIsDisplayed()
        click("reading.question")
        compose.onNodeWithTag("explanation").performScrollTo().assertIsDisplayed()
        click("question.next")
        waitFor("summary")
        compose.onNodeWithTag("summary.correct").assertTextEquals("1")
    }

    @Test fun longNumericPasteExplainsTheLengthLimit() {
        start(Q.number)
        compose.onNodeWithTag("numeric.number").performTextInput("2".repeat(129))
        compose.onNodeWithTag("numeric.error").assertTextContains("128", substring = true)
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsNotEnabled()
        compose.onNodeWithTag("numeric.number").performTextReplacement("22,5")
        compose.onNodeWithTag("numeric.error").assertDoesNotExist()
        checkAndNext()
        waitFor("summary")
        compose.onNodeWithTag("summary.correct").assertTextEquals("1")
    }

    @Test fun skippingEmptySentenceAndNumberDeliversFlagsAndVisitTime() {
        start(Q.sentence, Q.number, check = true)
        clock.now = clock.now.plusSeconds(3)
        click("question.flag")
        click("question.next")
        waitFor("numeric.number")
        clock.now = clock.now.plusSeconds(5)
        click("question.flag")
        click("question.next")
        click("overview.finish")
        click("overview.confirm.finish")
        waitFor("summary")
        compose.waitUntil(10_000) { server.finishes.size == 1 }
        val answers = server.answers.flatMap { it.answers }.associateBy { it.position }
        assertEquals(setOf(0, 1), answers.keys)
        listOf(3000, 5000).forEachIndexed { position, elapsed ->
            val answer = answers.getValue(position)
            assertTrue(answer.flagged)
            assertEquals(elapsed, answer.elapsedMs)
            assertEquals(null, answer.numericAnswer)
            assertEquals(null, answer.sentenceId)
        }
        assertTrue(server.clientErrors.isEmpty())
    }

    @Test fun dontKnowAfterBadNumericPasteClearsTheDraftInTheExplanation() {
        start(Q.number)
        compose.onNodeWithTag("numeric.number").performTextInput("22,5,0")
        click("question.dontKnow")
        waitFor("explanation")
        compose.onNodeWithTag("numeric.number").assertTextContains("")
        compose.onNodeWithTag("numeric.error").assertDoesNotExist()
    }

    @Test fun textAndQuestionKeepTheirScrollAndTheNextQuestionOpensTheQuestionTab() {
        val passage = Q.passage.copy(paragraphs = List(6) { Q.passage.paragraphs[it % 2] })
        // Короткий вопрос целиком помещается на экране и не проверяет восстановление прокрутки.
        val first = Q.rc.copy(passage = passage, prompt = List(4) { Q.rc.prompt }.joinToString(" "))
        start(first, first.copy(id = "00000000-0000-4000-8000-000000000036"))
        compose.onNodeWithTag("reading.text").assertIsSelected()
        compose.onNodeWithTag("passage.paragraph.4").performScrollTo()
        val textScroll = scroll("reading.text.scroll")
        assertTrue(textScroll > 0)
        click("reading.question")
        compose.onNodeWithTag("option.E").performScrollTo()
        val questionScroll = scroll("question")
        assertTrue(questionScroll > 0)
        click("reading.text")
        assertEquals(textScroll, scroll("reading.text.scroll"))
        scenario!!.recreate()
        waitFor("reading.text.scroll")
        assertEquals(textScroll, scroll("reading.text.scroll"))
        click("reading.question")
        assertEquals(questionScroll, scroll("question"))
        compose.onNodeWithTag("option.B").performScrollTo().performClick()
        checkAndNext()
        waitFor("question.prompt")
        compose.onNodeWithTag("reading.question").assertIsSelected()
    }

    private fun scroll(tag: String) =
        compose
            .onNodeWithTag(tag)
            .fetchSemanticsNode()
            .config[SemanticsProperties.VerticalScrollAxisRange]
            .value()

    private fun assertCapabilities() {
        val expected = TrainingRepository.CAPABILITIES
        assertTrue(expected.endsWith(",multiple_choice_multi,numeric_entry,select_in_passage,passage"))
        assertTrue("figure" !in expected)
        assertTrue(
            server.requests.filter { it.target.startsWith("/api/trainings") }.all { it.headers["X-Training-Capabilities"] == expected },
        )
    }
}
