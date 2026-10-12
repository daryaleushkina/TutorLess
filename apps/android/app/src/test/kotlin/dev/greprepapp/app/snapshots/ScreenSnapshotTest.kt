package dev.greprepapp.app.snapshots

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import com.github.takahirom.roborazzi.captureRoboImage
import dev.greprepapp.api.models.Section
import dev.greprepapp.app.core.session.SignOutReason
import dev.greprepapp.app.feature.shell.AppTab
import dev.greprepapp.app.feature.shell.MainScaffold
import dev.greprepapp.app.feature.signin.SignInContent
import dev.greprepapp.app.feature.signin.SignInViewModel
import dev.greprepapp.app.feature.signin.SignInViewModel.Message
import dev.greprepapp.app.feature.signin.SignInViewModel.Method
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.design.GpTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Эталонные снимки экранов: телефон и планшет, светлая и тёмная тема, «Крупнее» и системный крупный шрифт.
 * Записать — `./gradlew :app:recordRoborazziDebug`, сверить — `verifyRoborazziDebug` (это делает гейт).
 * Переснимать только при намеренной правке вида — и написать об этом в коммите (AGENTS.md, «Тесты»).
 *
 * Снимок — через правило Compose: кадр снимается, когда содержимое отрисовано и всё затихло. Часы Compose
 * стоят — крутилка загрузки и пульсация не делают кадр каждый раз другим.
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "ru-" + RobolectricDeviceQualifiers.MediumPhone)
class ScreenSnapshotTest(
    theme: String,
) : SnapshotBase(theme) {
    @Test fun newType0() =
        snap("b-r7", large = false, beforeCapture = {
            compose.onNodeWithTag("reading.question").performClick()
        }) { NewTrainingScreens.Screen("r7") }

    @Test fun newType0Large() =
        snap("b-r7-large", large = true, beforeCapture = {
            compose.onNodeWithTag("reading.question").performClick()
        }) { NewTrainingScreens.Screen("r7") }

    @Test fun newType1() = snap("b-r7-text", large = false) { NewTrainingScreens.Screen("r7-text") }

    @Test fun newType1Large() = snap("b-r7-text-large", large = true) { NewTrainingScreens.Screen("r7-text") }

    @Test fun newType2() = snap("b-r7-review", large = false) { NewTrainingScreens.Screen("r7-review") }

    @Test fun newType2Large() = snap("b-r7-review-large", large = true) { NewTrainingScreens.Screen("r7-review") }

    @Test fun newType3() = snap("b-r8", large = false) { NewTrainingScreens.Screen("r8") }

    @Test fun newType3Large() = snap("b-r8-large", large = true) { NewTrainingScreens.Screen("r8") }

    @Test fun newType4() = snap("b-r8-correct", large = false) { NewTrainingScreens.Screen("r8-correct") }

    @Test fun newType4Large() = snap("b-r8-correct-large", large = true) { NewTrainingScreens.Screen("r8-correct") }

    @Test fun newType5() = snap("b-r8-wrong", large = false) { NewTrainingScreens.Screen("r8-wrong") }

    @Test fun newType5Large() = snap("b-r8-wrong-large", large = true) { NewTrainingScreens.Screen("r8-wrong") }

    @Test fun newType6() = snap("b-r10", large = false) { NewTrainingScreens.Screen("r10") }

    @Test fun newType6Large() = snap("b-r10-large", large = true) { NewTrainingScreens.Screen("r10") }

    @Test fun newType7() = snap("b-r10-checked", large = false) { NewTrainingScreens.Screen("r10-checked") }

    @Test fun newType7Large() = snap("b-r10-checked-large", large = true) { NewTrainingScreens.Screen("r10-checked") }

    @Test fun newType8() = snap("b-r11", large = false) { NewTrainingScreens.Screen("r11") }

    @Test fun newType8Large() = snap("b-r11-large", large = true) { NewTrainingScreens.Screen("r11") }

    @Test fun newType9() = snap("b-r11-bad", large = false) { NewTrainingScreens.Screen("r11-bad") }

    @Test fun newType9Large() = snap("b-r11-bad-large", large = true) { NewTrainingScreens.Screen("r11-bad") }

    @Test fun newType10() = snap("b-r11-correct", large = false) { NewTrainingScreens.Screen("r11-correct") }

    @Test fun newType10Large() = snap("b-r11-correct-large", large = true) { NewTrainingScreens.Screen("r11-correct") }

    @Test fun newType11() = snap("b-r11b", large = false) { NewTrainingScreens.Screen("r11b") }

    @Test fun newType11Large() = snap("b-r11b-large", large = true) { NewTrainingScreens.Screen("r11b") }

    @Test
    fun home() = snap("home") { Home() }

    @Test
    fun homeLarge() = snap("home-large", large = true) { Home() }

    @Test
    fun homeHistory() = snap("homeHistory") { Home(ShellFixtures.history) }

    @Test
    fun homeHistoryLarge() = snap("homeHistory-large", large = true) { Home(ShellFixtures.history) }

    @Test
    fun homeOffline() = snap("homeOffline") { Home(ShellFixtures.first.copy(problem = dev.greprepapp.api.ApiFailure.Offline)) }

    @Test
    fun homeOfflineLarge() =
        snap("homeOffline-large", large = true) {
            Home(ShellFixtures.first.copy(problem = dev.greprepapp.api.ApiFailure.Offline))
        }

    @Test
    fun homeLoading() =
        snap("homeLoading") {
            Home(
                dev.greprepapp.app.feature.shell
                    .ShellState(),
            )
        }

    @Test
    fun homeLoadingLarge() =
        snap("homeLoading-large", large = true) {
            Home(
                dev.greprepapp.app.feature.shell
                    .ShellState(),
            )
        }

    @Test
    fun homeFailed() =
        snap("homeFailed") {
            Home(
                dev.greprepapp.app.feature.shell.ShellState(
                    loading = false,
                    problem =
                        dev.greprepapp.api.ApiFailure
                            .Unexpected("invalid response"),
                ),
            )
        }

    @Test
    fun homeFailedLarge() =
        snap("homeFailed-large", large = true) {
            Home(
                dev.greprepapp.app.feature.shell.ShellState(
                    loading = false,
                    problem =
                        dev.greprepapp.api.ApiFailure
                            .Unexpected("invalid response"),
                ),
            )
        }

    @Test
    fun homeOfflineEmpty() =
        snap("homeOfflineEmpty") {
            Home(
                dev.greprepapp.app.feature.shell
                    .ShellState(loading = false, problem = dev.greprepapp.api.ApiFailure.Offline),
            )
        }

    @Test
    fun homeOfflineEmptyLarge() =
        snap("homeOfflineEmpty-large", large = true) {
            Home(
                dev.greprepapp.app.feature.shell
                    .ShellState(loading = false, problem = dev.greprepapp.api.ApiFailure.Offline),
            )
        }

    @Test
    fun homeToefl() = snap("homeToefl") { Home(ShellFixtures.toefl) }

    @Test
    fun homeToeflLarge() = snap("homeToefl-large", large = true) { Home(ShellFixtures.toefl) }

    @Test
    fun words() = snap("words") { Home(tab = AppTab.Words) }

    @Test
    fun wordsLarge() = snap("words-large", large = true) { Home(tab = AppTab.Words) }

    @Test
    fun exam() = snap("exam") { Home(tab = AppTab.Exam) }

    @Test
    fun examLarge() = snap("exam-large", large = true) { Home(tab = AppTab.Exam) }

    @Test
    fun examToefl() = snap("examToefl") { Home(ShellFixtures.toefl, tab = AppTab.Exam) }

    @Test
    fun examToeflLarge() = snap("examToefl-large", large = true) { Home(ShellFixtures.toefl, tab = AppTab.Exam) }

    @Test
    fun progress() = snap("progress") { Home(tab = AppTab.Progress) }

    @Test
    fun progressLarge() = snap("progress-large", large = true) { Home(tab = AppTab.Progress) }

    @Test
    fun settings() = snap("settings") { Settings() }

    @Test
    fun settingsLarge() = snap("settings-large", large = true) { Settings() }

    @Test
    fun signIn() = snap("signin") { SignIn() }

    @Test
    fun signInLarge() = snap("signin-large", large = true) { SignIn() }

    @Test
    fun signInFailed() = snap("signin-failed") { SignIn(SignInViewModel.UiState(message = Message.Failed)) }

    @Test
    fun signInFailedLarge() = snap("signin-failed-large", large = true) { SignIn(SignInViewModel.UiState(message = Message.Failed)) }

    @Test
    fun chooseExam() =
        snap("chooseExam") {
            dev.greprepapp.app.feature.shell.ExamPicker(
                ShellFixtures.first.copy(user = ShellFixtures.first.user!!.copy(activeExam = null)),
                {},
                {},
            )
        }

    @Test
    fun chooseExamLarge() =
        snap("chooseExam-large", large = true) {
            dev.greprepapp.app.feature.shell.ExamPicker(
                ShellFixtures.first.copy(user = ShellFixtures.first.user!!.copy(activeExam = null)),
                {},
                {},
            )
        }

    @Test
    fun chooseExamBusy() =
        snap("chooseExamBusy") {
            dev.greprepapp.app.feature.shell.ExamPicker(
                ShellFixtures.first.copy(
                    user = ShellFixtures.first.user!!.copy(activeExam = null),
                    choosing = dev.greprepapp.api.models.Exam.GRE,
                ),
                {
                },
                {},
            )
        }

    @Test
    fun chooseExamBusyLarge() =
        snap("chooseExamBusy-large", large = true) {
            dev.greprepapp.app.feature.shell.ExamPicker(
                ShellFixtures.first.copy(
                    user = ShellFixtures.first.user!!.copy(activeExam = null),
                    choosing = dev.greprepapp.api.models.Exam.GRE,
                ),
                {
                },
                {},
            )
        }

    @Test
    fun homeContinue() =
        snap("homeContinue") {
            Home(
                ShellFixtures.history,
                active =
                    dev.greprepapp.app.feature.training.ContinueTraining(
                        "training",
                        dev.greprepapp.api.models.Section.VERBAL,
                        listOf(dev.greprepapp.api.models.QuestionType.TEXT_COMPLETION),
                        3,
                        10,
                    ),
            )
        }

    @Test
    fun homeContinueLarge() =
        snap("homeContinue-large", large = true) {
            Home(
                ShellFixtures.history,
                active =
                    dev.greprepapp.app.feature.training.ContinueTraining(
                        "training",
                        dev.greprepapp.api.models.Section.VERBAL,
                        listOf(dev.greprepapp.api.models.QuestionType.TEXT_COMPLETION),
                        3,
                        10,
                    ),
            )
        }

    @Test
    fun homeStartOffline() =
        snap("homeStartOffline") {
            Home(
                ShellFixtures.first.copy(problem = dev.greprepapp.api.ApiFailure.Offline),
                action =
                    dev.greprepapp.app.feature.shell
                        .HomeAction(problem = dev.greprepapp.app.feature.training.StartProblem.Offline),
            )
        }

    @Test
    fun homeStartOfflineLarge() =
        snap("homeStartOffline-large", large = true) {
            Home(
                ShellFixtures.first.copy(problem = dev.greprepapp.api.ApiFailure.Offline),
                action =
                    dev.greprepapp.app.feature.shell
                        .HomeAction(problem = dev.greprepapp.app.feature.training.StartProblem.Offline),
            )
        }

    @Test
    fun examSheet() =
        snap("examSheet") {
            dev.greprepapp.app.feature.shell
                .ExamSheet(ShellFixtures.first, {}, {})
        }

    @Test
    fun examSheetLarge() =
        snap("examSheet-large", large = true) {
            dev.greprepapp.app.feature.shell
                .ExamSheet(ShellFixtures.first, {}, {})
        }

    @Test
    fun signInExpiredWithGoogleMessage() =
        snap("signin-expired-google-message") {
            SignIn(SignInViewModel.UiState(message = Message.NotConnectedYet(SignInViewModel.Method.Google)), SignOutReason.SessionExpired)
        }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}")
        fun themes() = listOf(arrayOf("light"), arrayOf("dark"))
    }
}
