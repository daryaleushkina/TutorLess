package dev.greprepapp.app.flow

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.printToString
import androidx.test.core.app.ActivityScenario
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dev.greprepapp.app.MainActivity
import dev.greprepapp.app.testing.MemoryTokenStore
import dev.greprepapp.app.testing.NightModeResetRule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import javax.inject.Inject

@OptIn(ExperimentalTestApi::class)
@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
@Config(application = HiltTestApplication::class, qualifiers = "ru-w411dp-h914dp-420dpi")
class ShellFlowTest {
    @get:Rule(order = -1)
    val nightMode = NightModeResetRule()

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createEmptyComposeRule()

    @Inject @dev.greprepapp.app.core.AppScope
    lateinit var scope: CoroutineScope

    @Inject lateinit var server: FakeServer

    @Inject lateinit var themes: dev.greprepapp.app.testing.MemoryThemeStore

    @Inject lateinit var tokens: MemoryTokenStore
    private var scenario: ActivityScenario<MainActivity>? = null

    @After
    fun close() {
        if (::scope.isInitialized) scope.cancel()
        scenario?.close()
    }

    private fun launch(first: Boolean = false) {
        hilt.inject()
        server.issue("saved")
        tokens.token = "saved"
        if (first) server.user = server.user.copy(activeExam = null)
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    private fun wait(tag: String) = compose.waitUntilAtLeastOneExists(hasTestTag(tag), 10_000)

    private fun click(tag: String) {
        wait(tag)
        compose.onNodeWithTag(tag).performClick()
    }

    @Test
    @Config(qualifiers = "ru-w1280dp-h800dp-160dpi")
    fun trainingReplacesTodayAndTabsKeepProfileHistory() {
        launch()
        wait("tab.training")
        compose.onNodeWithTag("tab.today").assertDoesNotExist()
        click("shell.profile")
        wait("settings.signOut")
        click("tab.words")
        click("tab.training")
        compose.onNodeWithTag("settings.signOut").assertExists()
        org.junit.Assert.assertFalse(server.requests.any { it.target.startsWith("/api/today") })
    }

    @Test
    fun firstSignInPicksOnlyAnExamFromTheServer() {
        launch(first = true)
        wait("exam.pick.gre")
        compose.onNodeWithTag("tab.training").assertDoesNotExist()
        compose.onNodeWithTag("exam.pick.sat").assertDoesNotExist()
        click("exam.pick.gre")
        wait("home.start")
        org.junit.Assert.assertEquals(dev.greprepapp.api.models.Exam.GRE, server.examChanges.single().exam)
    }

    @Test
    fun changingExamUsesSheetAndDisablesEmptyToeflSections() {
        launch()
        click("shell.examSwitch")
        click("exam.pick.toefl")
        wait("home.section.reading")
        for (section in listOf(
            "reading",
            "listening",
            "writing",
            "speaking",
        )) {
            compose.onNodeWithTag("home.section.$section").assertIsNotEnabled()
        }
        compose.onNodeWithTag("home.start").assertDoesNotExist()
        org.junit.Assert.assertEquals(dev.greprepapp.api.models.Exam.TOEFL, server.examChanges.single().exam)
        click("tab.exam")
        compose.onNodeWithText("Здесь будут пробные экзамены TOEFL с\u00a0оценкой Writing и\u00a0Speaking.").assertExists()
    }

    @Test
    fun languageSavesToAccountAndRollsBackOnError() {
        launch()
        click("shell.profile")
        click("settings.locale.en")
        compose.waitUntil(5_000) { server.user.locale == dev.greprepapp.api.models.Locale.EN }
        wait("settings.locale.ru")
        compose.onNodeWithTag("settings.locale.en").assertIsSelected()
        server.localeStatus = 500
        click("settings.locale.ru")
        wait("settings.error")
        compose.onNodeWithTag("settings.locale.en").assertIsSelected()
        org.junit.Assert.assertEquals(
            listOf(
                dev.greprepapp.api.models.Locale.EN,
                dev.greprepapp.api.models.Locale.RU,
            ),
            server.localeChanges.map {
                it.locale
            },
        )
    }

    @Test
    fun themeAndTextSizeSurviveRecreationAndRowsStayDisabled() {
        launch()
        click("shell.profile")
        for (tag in listOf("subscription", "identities", "contact")) compose.onNodeWithTag("settings.$tag").assertIsNotEnabled()
        click("settings.theme.light")
        click("settings.text.large")
        compose.waitForIdle()
        scenario?.recreate()
        wait("settings.theme.light")
        compose.onNodeWithTag("settings.theme.light").assertIsSelected()
        compose.onNodeWithTag("settings.text.large").assertIsSelected()
        compose.onNodeWithTag("settings.exam").assertDoesNotExist()
    }

    @Test
    fun mistakesStartWithSourceAndOnlySupportedCapabilities() {
        hilt.inject()
        server.issue("saved")
        tokens.token = "saved"
        server.home = server.home.copy(mistakes = 2)
        scenario = ActivityScenario.launch(MainActivity::class.java)
        wait("home.start")
        compose.onNodeWithTag("shell.scroll").performScrollToNode(hasTestTag("home.mistakes"))
        click("home.mistakes")
        try {
            wait("question.prompt")
        } catch (failure: androidx.compose.ui.test.ComposeTimeoutException) {
            throw AssertionError(
                "starts=${server.starts.size}, requests=${server.requests.map { it.target }}, errors=${server.clientErrors}: " +
                    compose.onRoot().printToString(),
                failure,
            )
        }
        org.junit.Assert.assertEquals(dev.greprepapp.api.models.TrainingSource.MISTAKES, server.starts.single().source)
        val calls = server.requests.filter { it.target.startsWith("/api/home") || it.target.startsWith("/api/trainings") }
        org.junit.Assert.assertTrue(calls.isNotEmpty())
        org.junit.Assert.assertTrue(
            calls.all {
                it.headers["X-Training-Capabilities"] ==
                    "text_completion,sentence_equivalence,quantitative_comparison,multiple_choice," +
                    "multiple_choice_multi,numeric_entry,select_in_passage,passage"
            },
        )
    }

    @Test
    fun failedSignOutKeepsProfileAndTokenUntilRetry() {
        launch()
        click("shell.profile")
        server.down = true
        click("settings.signOut")
        wait("settings.signOutError")
        org.junit.Assert.assertEquals("saved", tokens.token)
        server.down = false
        click("settings.signOut")
        wait("signin.apple")
        org.junit.Assert.assertNull(tokens.token)
    }

    @Test
    fun busyPickerBlocksAnotherExamAndFailureKeepsSelectionOpen() {
        launch(first = true)
        wait("exam.pick.gre")
        server.examStatus = 500
        server.examGate = java.util.concurrent.CountDownLatch(1)
        click("exam.pick.gre")
        compose.onNodeWithTag("exam.pick.toefl").assertIsNotEnabled()
        server.examGate!!.countDown()
        wait("exam.error")
        compose.onNodeWithTag("exam.pick.gre").assertIsEnabled()
        server.examGate = null
        server.examStatus = 200
        click("exam.pick.toefl")
        wait("home.section.reading")
    }

    @Test fun failedTextSizeDoesNotApplyAnUnsavedChoice() {
        launch()
        click("shell.profile")
        themes.saveFailure = java.io.IOException("disk full")
        click("settings.text.large")
        wait("settings.error")
        compose.onNodeWithTag("settings.text.normal").assertIsSelected()
    }
}
