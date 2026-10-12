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
 * Планшет — отдельным классом: смена размера экрана посреди класса телефонных снимков ломала следующие
 * снимки (Robolectric пересоздавал активность, и кадр выходил пустым).
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "ru-" + RobolectricDeviceQualifiers.MediumTablet)
class TabletSnapshotTest(
    theme: String,
) : SnapshotBase(theme) {
    @Test
    fun trainingBuilder() = snap("tablet-training-builder") { TrainingScreens.Builder() }

    @Test
    fun trainingQuestionWrong() = snap("tablet-training-question-wrong") { TrainingScreens.Session(TrainingScreens.tcWrong) }

    @Test
    fun trainingSummary() = snap("tablet-training-summary") { TrainingScreens.Session(TrainingScreens.summary) }

    @Test
    fun trainingReview() = snap("tablet-training-review") { TrainingScreens.Review() }

    @Test
    fun trainingTopics() = snap("tablet-training-topics") { TrainingScreens.Builder(TrainingScreens.topics) }

    @Test
    fun trainingCheck() = snap("tablet-training-check") { TrainingScreens.Session(TrainingScreens.qcTimed) }

    @Test
    fun trainingOverview() = snap("tablet-training-overview") { TrainingScreens.Session(TrainingScreens.overview) }

    @Test
    fun trainingBuilderLarge() = snap("tablet-training-builder-large", large = true) { TrainingScreens.Builder() }

    @Test
    fun trainingQuestionLarge() = snap("tablet-training-question-large", large = true) { TrainingScreens.Session(TrainingScreens.tcWrong) }

    @Test
    fun trainingSummaryLarge() = snap("tablet-training-summary-large", large = true) { TrainingScreens.Session(TrainingScreens.summary) }

    @Test
    fun trainingReviewLarge() = snap("tablet-training-review-large", large = true) { TrainingScreens.Review() }

    @Test
    fun trainingCheckLarge() = snap("tablet-training-check-large", large = true) { TrainingScreens.Session(TrainingScreens.qcTimed) }

    @Test
    fun trainingTopicsLarge() = snap("tablet-training-topics-large", large = true) { TrainingScreens.Builder(TrainingScreens.topics) }

    @Test
    fun trainingOverviewLarge() = snap("tablet-training-overview-large", large = true) { TrainingScreens.Session(TrainingScreens.overview) }

    @Test
    fun trainingBuilderStartOffline() =
        snap("tablet-training-builder-start-offline") {
            TrainingScreens.Builder(TrainingScreens.builderCustom.copy(problem = dev.greprepapp.app.feature.training.StartProblem.Offline))
        }

    @Test
    fun home() = snap("tablet-home") { Home() }

    @Test
    fun homeLarge() = snap("tablet-home-large", large = true) { Home() }

    @Test
    fun homeHistory() = snap("tablet-homeHistory") { Home(ShellFixtures.history) }

    @Test
    fun homeHistoryLarge() = snap("tablet-homeHistory-large", large = true) { Home(ShellFixtures.history) }

    @Test
    fun homeOffline() = snap("tablet-homeOffline") { Home(ShellFixtures.first.copy(problem = dev.greprepapp.api.ApiFailure.Offline)) }

    @Test
    fun homeOfflineLarge() =
        snap("tablet-homeOffline-large", large = true) {
            Home(ShellFixtures.first.copy(problem = dev.greprepapp.api.ApiFailure.Offline))
        }

    @Test
    fun homeLoading() =
        snap("tablet-homeLoading") {
            Home(
                dev.greprepapp.app.feature.shell
                    .ShellState(),
            )
        }

    @Test
    fun homeLoadingLarge() =
        snap("tablet-homeLoading-large", large = true) {
            Home(
                dev.greprepapp.app.feature.shell
                    .ShellState(),
            )
        }

    @Test
    fun homeFailed() =
        snap("tablet-homeFailed") {
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
        snap("tablet-homeFailed-large", large = true) {
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
        snap("tablet-homeOfflineEmpty") {
            Home(
                dev.greprepapp.app.feature.shell
                    .ShellState(loading = false, problem = dev.greprepapp.api.ApiFailure.Offline),
            )
        }

    @Test
    fun homeOfflineEmptyLarge() =
        snap("tablet-homeOfflineEmpty-large", large = true) {
            Home(
                dev.greprepapp.app.feature.shell
                    .ShellState(loading = false, problem = dev.greprepapp.api.ApiFailure.Offline),
            )
        }

    @Test
    fun homeToefl() = snap("tablet-homeToefl") { Home(ShellFixtures.toefl) }

    @Test
    fun homeToeflLarge() = snap("tablet-homeToefl-large", large = true) { Home(ShellFixtures.toefl) }

    @Test
    fun words() = snap("tablet-words") { Home(tab = AppTab.Words) }

    @Test
    fun wordsLarge() = snap("tablet-words-large", large = true) { Home(tab = AppTab.Words) }

    @Test
    fun exam() = snap("tablet-exam") { Home(tab = AppTab.Exam) }

    @Test
    fun examLarge() = snap("tablet-exam-large", large = true) { Home(tab = AppTab.Exam) }

    @Test
    fun examToefl() = snap("tablet-examToefl") { Home(ShellFixtures.toefl, tab = AppTab.Exam) }

    @Test
    fun examToeflLarge() = snap("tablet-examToefl-large", large = true) { Home(ShellFixtures.toefl, tab = AppTab.Exam) }

    @Test
    fun progress() = snap("tablet-progress") { Home(tab = AppTab.Progress) }

    @Test
    fun progressLarge() = snap("tablet-progress-large", large = true) { Home(tab = AppTab.Progress) }

    @Test
    fun settings() = snap("tablet-settings", beforeCapture = { compose.onNodeWithTag("shell.profile").performClick() }) { Settings() }

    @Test
    fun settingsLarge() =
        snap("tablet-settings-large", large = true, beforeCapture = {
            compose.onNodeWithTag("shell.profile").performClick()
        }) { Settings() }

    @Test
    fun signIn() = snap("tablet-signin") { SignIn() }

    @Test
    fun signInLarge() = snap("tablet-signin-large", large = true) { SignIn() }

    @Test
    fun signInFailed() = snap("tablet-signin-failed") { SignIn(SignInViewModel.UiState(message = Message.Failed)) }

    @Test
    fun signInFailedLarge() = snap("tablet-signin-failed-large", large = true) { SignIn(SignInViewModel.UiState(message = Message.Failed)) }

    @Test
    fun chooseExam() =
        snap("tablet-chooseExam") {
            dev.greprepapp.app.feature.shell.ExamPicker(
                ShellFixtures.first.copy(user = ShellFixtures.first.user!!.copy(activeExam = null)),
                {},
                {},
            )
        }

    @Test
    fun chooseExamLarge() =
        snap("tablet-chooseExam-large", large = true) {
            dev.greprepapp.app.feature.shell.ExamPicker(
                ShellFixtures.first.copy(user = ShellFixtures.first.user!!.copy(activeExam = null)),
                {},
                {},
            )
        }

    @Test
    fun chooseExamBusy() =
        snap("tablet-chooseExamBusy") {
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
        snap("tablet-chooseExamBusy-large", large = true) {
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
        snap("tablet-homeContinue") {
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
        snap("tablet-homeContinue-large", large = true) {
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
        snap("tablet-homeStartOffline") {
            Home(
                ShellFixtures.first.copy(problem = dev.greprepapp.api.ApiFailure.Offline),
                action =
                    dev.greprepapp.app.feature.shell
                        .HomeAction(problem = dev.greprepapp.app.feature.training.StartProblem.Offline),
            )
        }

    @Test
    fun homeStartOfflineLarge() =
        snap("tablet-homeStartOffline-large", large = true) {
            Home(
                ShellFixtures.first.copy(problem = dev.greprepapp.api.ApiFailure.Offline),
                action =
                    dev.greprepapp.app.feature.shell
                        .HomeAction(problem = dev.greprepapp.app.feature.training.StartProblem.Offline),
            )
        }

    @Test
    fun examSheet() =
        snap("tablet-examSheet") {
            dev.greprepapp.app.feature.shell
                .ExamSheet(ShellFixtures.first, {}, {})
        }

    @Test
    fun examSheetLarge() =
        snap("tablet-examSheet-large", large = true) {
            dev.greprepapp.app.feature.shell
                .ExamSheet(ShellFixtures.first, {}, {})
        }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}")
        fun themes() = listOf(arrayOf("light"), arrayOf("dark"))
    }
}
