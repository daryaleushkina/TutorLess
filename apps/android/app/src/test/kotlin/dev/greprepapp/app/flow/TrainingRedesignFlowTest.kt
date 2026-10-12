package dev.greprepapp.app.flow

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dev.greprepapp.api.models.TrainingMode
import dev.greprepapp.app.MainActivity
import dev.greprepapp.app.testing.Fixtures
import dev.greprepapp.app.testing.ManualTicker
import dev.greprepapp.app.testing.MutableClock
import dev.greprepapp.app.testing.NightModeResetRule
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import javax.inject.Inject

/** Новые переходы B проверяются через настоящий корень и сервер по договору. */
@OptIn(ExperimentalTestApi::class)
@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
@Config(application = HiltTestApplication::class, qualifiers = "ru-w411dp-h914dp-420dpi")
class TrainingRedesignFlowTest {
    @get:Rule(order = -1)
    val nightMode = NightModeResetRule()

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createEmptyComposeRule()

    @Inject @dev.greprepapp.app.core.AppScope
    lateinit var scope: kotlinx.coroutines.CoroutineScope

    @Inject lateinit var server: FakeServer

    @Inject lateinit var clock: MutableClock

    @Inject lateinit var ticker: ManualTicker
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

    private fun builder() {
        scenario = ActivityScenario.launch(MainActivity::class.java)
        waitFor("signin.dev.name")
        compose.onNodeWithTag("signin.dev.name").performTextInput("training-b")
        click("signin.dev.submit")
        waitFor("training.home")
        compose.onNodeWithTag("shell.scroll").performScrollToNode(hasTestTag("home.configure"))
        click("home.configure")
        waitFor("builder.start")
    }

    @Test fun typeUsesASheetAndCheckHasFixedSectionLength() {
        builder()
        click("builder.type")
        waitFor("builder.types.sheet")
        click("builder.type.sentence_equivalence")
        click("builder.mode.check")
        compose.onNodeWithTag("builder.count").assertDoesNotExist()
        click("builder.type")
        click("builder.type.all")
        click("builder.start")
        waitFor("question.prompt")
        assertEquals(12, server.starts.single().count)
        assertEquals(
            2,
            server.starts
                .single()
                .questionTypes.size,
        )
    }

    @Test fun practiceBackReturnsToTheDraftAndDontKnowExplains() {
        server.nextSession = Fixtures.session(Fixtures.tc1, Fixtures.tc3, Fixtures.se)
        builder()
        click("builder.start")
        waitFor("question.prompt")
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsNotEnabled()
        click("question.dontKnow")
        waitFor("explanation")
        compose.onNodeWithTag("explanation.verdict").assertTextContains("Разберём", substring = true)
        click("question.next")
        click("option.A")
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsNotEnabled()
        click("question.previous")
        waitFor("question.return")
        click("question.return")
        compose.onNodeWithTag("question.prompt").assertTextContains("speculative", substring = true)
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsNotEnabled()
    }

    @Test fun checkConfirmsMissingAnswersAndTimesOutFromTheSheet() {
        server.nextSession = Fixtures.session(Fixtures.tc1, Fixtures.se, mode = TrainingMode.CHECK)
        builder()
        click("builder.mode.check")
        click("builder.start")
        click("option.A")
        click("question.flag")
        click("question.overview")
        waitFor("overview")
        click("overview.finish")
        waitFor("overview.confirm")
        click("overview.cancel")
        clock.now = clock.now.plusSeconds(181)
        ticker.tick()
        waitFor("session.timeout")
        compose.onNodeWithText("Время вышло").assertIsDisplayed()
        click("timeout.summary")
        waitFor("summary")
        click("summary.review")
        click("review.filter.flagged")
        compose.onNodeWithTag("review.item.0").assertIsDisplayed()
        compose.onNodeWithTag("review.item.1").assertDoesNotExist()
    }

    @Test fun allFourResponsesRequireCompleteAnswersAndKeepTheSePair() {
        server.nextSession = Fixtures.session(Fixtures.tc3, Fixtures.se, Fixtures.qc, Fixtures.mc)
        builder()
        click("builder.start")
        click("option.A")
        click("option.D")
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsNotEnabled()
        compose.onNodeWithTag("option.G").performScrollTo().performClick()
        click("question.check")
        click("question.next")
        click("option.A")
        compose.onNodeWithTag("question.check", useUnmergedTree = true).assertIsNotEnabled()
        click("option.C")
        compose.onNodeWithTag("option.F").performScrollTo().performClick()
        compose.onNodeWithTag("option.A").assertIsOn()
        compose.onNodeWithTag("option.C").assertIsOn()
        compose.onNodeWithTag("option.F").assertIsOff()
        compose.onNodeWithTag("question").performScrollToNode(hasTestTag("question.instruction"))
        compose.onNodeWithText("Выберите два слова.").assertIsDisplayed()
        click("question.check")
        click("question.next")
        click("option.B")
        click("question.check")
        click("question.next")
        click("option.B")
        click("question.check")
        click("question.next")
        waitFor("summary")
        compose.onNodeWithTag("summary.correct").assertTextContains("4")
        compose.waitUntil(10_000) { server.finishes.size == 1 }
        assertEquals(
            4,
            server.answers
                .flatMap { it.answers }
                .map { it.position }
                .distinct()
                .size,
        )
    }

    @Test fun timeoutClosesTheExitConfirmationAndShowsTheResult() {
        server.nextSession = Fixtures.session(Fixtures.tc1, mode = TrainingMode.CHECK)
        builder()
        click("builder.mode.check")
        click("builder.start")
        click("session.close")
        waitFor("session.exit.confirm")
        clock.now = clock.now.plusSeconds(181)
        ticker.tick()
        compose.waitUntil(10_000) { server.finishes.size == 1 }
        compose.onNodeWithTag("session.exit.confirm").assertDoesNotExist()
        click("timeout.summary")
        waitFor("summary")
    }

    @Test fun topicsCannotBeEmptyAndDifficultyChangesTheAvailableCount() {
        builder()
        click("builder.topics")
        click("topics.toggleAll")
        compose.onNodeWithTag("topics.done").assertIsNotEnabled()
        compose.onNodeWithText("Выберите хотя бы одну тему").assertIsDisplayed()
        click("topics.toggleAll")
        click("topics.difficulty.easy")
        compose.onNodeWithTag("topics.available").assertTextContains("тренировка будет из 1", substring = true)
        click("topics.done")
        click("builder.start")
        waitFor("question.prompt")
        assertEquals(1, server.starts.single().count)
    }

    @Test fun filteredReviewMovesBothWaysAndReportUsesTheChosenLanguage() {
        server.nextSession = Fixtures.session(Fixtures.tc1, Fixtures.se, Fixtures.tc3)
        builder()
        click("builder.start")
        click("option.C")
        click("question.check")
        click("question.next")
        click("option.A")
        click("option.C")
        click("question.check")
        click("question.next")
        click("question.dontKnow")
        click("question.next")
        click("summary.review")
        click("review.filter.mistakes")
        click("review.item.0")
        click("reviewItem.next")
        compose.onNodeWithText("Вопрос 3").assertIsDisplayed()
        click("reviewItem.previous")
        compose.onNodeWithText("Вопрос 1").assertIsDisplayed()
        compose.onNodeWithText("EN").performScrollTo().performClick()
        compose.onNodeWithTag("question.report").performScrollTo().performClick()
        click("report.kind.translation")
        click("report.send")
        waitFor("report.sent")
        compose.waitUntil(10_000) { server.reports.size == 1 }
        click("reviewItem.next")
        compose.onNodeWithTag("reviewItem.forward").assertDoesNotExist()
        click("reviewItem.summary")
        waitFor("summary")
    }

    @Test fun otherReportNeedsTextAndTheCheckExitHasConfirmation() {
        server.nextSession = Fixtures.session(Fixtures.tc1, Fixtures.se, mode = TrainingMode.CHECK)
        builder()
        click("builder.mode.check")
        click("builder.start")
        click("question.report")
        compose.onNodeWithTag("report.kind.translation").assertDoesNotExist()
        click("report.kind.other")
        compose.onNodeWithTag("report.send").assertIsNotEnabled()
        compose.onNodeWithTag("report.text").performTextInput("Не читается условие")
        click("report.send")
        waitFor("report.sent")
        click("session.close")
        waitFor("session.exit.confirm")
        click("session.stay")
        compose.onNodeWithTag("session.timer").assertIsDisplayed()
        click("session.close")
        click("session.exit")
        waitFor("training.home")
        click("home.continue")
        compose.waitUntil(10_000) {
            try {
                compose.onNodeWithTag("session.timer").assertIsDisplayed()
                true
            } catch (_: AssertionError) {
                false
            }
        }
    }

    @Test fun explanationTopicStartsPracticeAndShowsAnOfflineFailure() {
        builder()
        click("builder.start")
        click("question.dontKnow")
        server.down = true
        compose.onNodeWithTag("question.topic").performScrollTo().performClick()
        waitFor("topic.problem")
        server.down = false
        server.nextSession = Fixtures.session(Fixtures.tc1, id = "topic-practice")
        compose.onNodeWithTag("question.topic").performScrollTo().performClick()
        waitFor("question.check")
        assertEquals(listOf("contrast-signals"), server.starts.last().topicIds)
        assertEquals(10, server.starts.last().count)
        assertEquals(TrainingMode.PRACTICE, server.starts.last().mode)
    }

    @Test fun summaryTopicAndReviewTopicStartPractice() {
        server.nextSession = Fixtures.session(Fixtures.tc1)
        builder()
        click("builder.start")
        click("question.dontKnow")
        click("question.next")
        server.nextSession = Fixtures.session(Fixtures.tc1, id = "topic-from-summary")
        click("summary.topic.contrast-signals")
        waitFor("question.check")
        click("question.dontKnow")
        click("question.next")
        click("summary.review")
        click("review.item.0")
        // NavDisplay завершает переход прежде, чем цели нового экрана попадут в доступное дерево.
        waitFor("reviewItem")
        waitFor("question.topic")
        server.nextSession = Fixtures.session(Fixtures.tc1, id = "topic-from-review")
        compose.onNodeWithTag("question.topic").performScrollTo().performClick()
        waitFor("question.check")
        compose.waitUntil(10_000) { server.starts.size == 3 }
        assertEquals(listOf("contrast-signals"), server.starts.last().topicIds)
    }
}
