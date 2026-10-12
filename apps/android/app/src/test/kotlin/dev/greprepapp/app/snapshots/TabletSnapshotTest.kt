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
    @Test fun trainingB0() = snap("tablet-b-r1") { TrainingScreens.Builder() }

    @Test fun trainingBLarge0() = snap("tablet-b-r1-large", large = true) { TrainingScreens.Builder() }

    @Test fun trainingB1() = snap("tablet-b-r1-custom") { TrainingScreens.Builder(TrainingScreens.builderCustom) }

    @Test fun trainingBLarge1() = snap("tablet-b-r1-custom-large", large = true) { TrainingScreens.Builder(TrainingScreens.builderCustom) }

    @Test fun trainingB2() = snap("tablet-b-r2") { TrainingScreens.Builder(TrainingScreens.topics) }

    @Test fun trainingBLarge2() = snap("tablet-b-r2-large", large = true) { TrainingScreens.Builder(TrainingScreens.topics) }

    @Test fun trainingB3() = snap("tablet-b-r3") { TrainingScreens.Session(TrainingScreens.tcSelected) }

    @Test fun trainingBLarge3() = snap("tablet-b-r3-large", large = true) { TrainingScreens.Session(TrainingScreens.tcSelected) }

    @Test fun trainingB4() = snap("tablet-b-r4") { TrainingScreens.Session(TrainingScreens.tcWrong) }

    @Test fun trainingBLarge4() = snap("tablet-b-r4-large", large = true) { TrainingScreens.Session(TrainingScreens.tcWrong) }

    @Test fun trainingB5() = snap("tablet-b-r4-dk") { TrainingScreens.Session(TrainingScreens.dontKnow) }

    @Test fun trainingBLarge5() = snap("tablet-b-r4-dk-large", large = true) { TrainingScreens.Session(TrainingScreens.dontKnow) }

    @Test fun trainingB6() = snap("tablet-b-r5") { TrainingScreens.Session(TrainingScreens.tc3Partial) }

    @Test fun trainingBLarge6() = snap("tablet-b-r5-large", large = true) { TrainingScreens.Session(TrainingScreens.tc3Partial) }

    @Test fun trainingB7() = snap("tablet-b-r6-question") { TrainingScreens.Session(TrainingScreens.seSelected) }

    @Test fun trainingBLarge7() = snap("tablet-b-r6-question-large", large = true) { TrainingScreens.Session(TrainingScreens.seSelected) }

    @Test fun trainingB8() = snap("tablet-b-r6") { TrainingScreens.Session(TrainingScreens.seCorrect) }

    @Test fun trainingBLarge8() = snap("tablet-b-r6-large", large = true) { TrainingScreens.Session(TrainingScreens.seCorrect) }

    @Test fun trainingB9() = snap("tablet-b-r9") { TrainingScreens.Session(TrainingScreens.qcPractice) }

    @Test fun trainingBLarge9() = snap("tablet-b-r9-large", large = true) { TrainingScreens.Session(TrainingScreens.qcPractice) }

    @Test fun trainingB10() = snap("tablet-b-single-choice") { TrainingScreens.Session(TrainingScreens.mcSelected) }

    @Test fun trainingBLarge10() =
        snap(
            "tablet-b-single-choice-large",
            large = true,
        ) { TrainingScreens.Session(TrainingScreens.mcSelected) }

    @Test fun trainingB11() = snap("tablet-b-r14") { TrainingScreens.Session(TrainingScreens.qcTimed) }

    @Test fun trainingBLarge11() = snap("tablet-b-r14-large", large = true) { TrainingScreens.Session(TrainingScreens.qcTimed) }

    @Test fun trainingB12() = snap("tablet-b-r14-list") { TrainingScreens.Session(TrainingScreens.overview) }

    @Test fun trainingBLarge12() = snap("tablet-b-r14-list-large", large = true) { TrainingScreens.Session(TrainingScreens.overview) }

    @Test fun trainingB13() = snap("tablet-b-r14-timeout") { TrainingScreens.Session(TrainingScreens.summaryTimedOut) }

    @Test fun trainingBLarge13() =
        snap(
            "tablet-b-r14-timeout-large",
            large = true,
        ) { TrainingScreens.Session(TrainingScreens.summaryTimedOut) }

    @Test fun trainingB14() = snap("tablet-b-r15") { TrainingScreens.Session(TrainingScreens.summary) }

    @Test fun trainingBLarge14() = snap("tablet-b-r15-large", large = true) { TrainingScreens.Session(TrainingScreens.summary) }

    @Test fun trainingB15() = snap("tablet-b-r15-perfect") { TrainingScreens.Session(TrainingScreens.summaryPerfect) }

    @Test fun trainingBLarge15() =
        snap(
            "tablet-b-r15-perfect-large",
            large = true,
        ) { TrainingScreens.Session(TrainingScreens.summaryPerfect) }

    @Test fun trainingB16() = snap("tablet-b-r16") { TrainingScreens.Review() }

    @Test fun trainingBLarge16() = snap("tablet-b-r16-large", large = true) { TrainingScreens.Review() }

    @Test fun trainingB17() = snap("tablet-b-r19") { TrainingScreens.ReviewItem() }

    @Test fun trainingBLarge17() = snap("tablet-b-r19-large", large = true) { TrainingScreens.ReviewItem() }

    @Test fun trainingB18() = snap("tablet-b-r20") { TrainingScreens.Session(TrainingScreens.past) }

    @Test fun trainingBLarge18() = snap("tablet-b-r20-large", large = true) { TrainingScreens.Session(TrainingScreens.past) }

    @Test fun trainingB19() = snap("tablet-b-r17") { TrainingScreens.Report() }

    @Test fun trainingBLarge19() = snap("tablet-b-r17-large", large = true) { TrainingScreens.Report() }

    @Test fun trainingB20() = snap("tablet-b-r17-failed") { TrainingScreens.Report(failed = true) }

    @Test fun trainingBLarge20() = snap("tablet-b-r17-failed-large", large = true) { TrainingScreens.Report(failed = true) }

    @Test fun trainingB21() = snap("tablet-b-builder-offline") { TrainingScreens.Builder(TrainingScreens.builderOffline) }

    @Test fun trainingBLarge21() =
        snap("tablet-b-builder-offline-large", large = true) {
            TrainingScreens.Builder(TrainingScreens.builderOffline)
        }

    @Test fun trainingB22() = snap("tablet-b-builder-empty") { TrainingScreens.Builder(TrainingScreens.builderNoQuestions) }

    @Test fun trainingBLarge22() =
        snap("tablet-b-builder-empty-large", large = true) {
            TrainingScreens.Builder(TrainingScreens.builderNoQuestions)
        }

    @Test fun trainingTypesSheet() =
        snap(
            "tablet-b-r1-types",
            beforeCapture = { compose.onNodeWithTag("builder.type").performClick() },
        ) { TrainingScreens.Builder() }

    @Test fun trainingTypesSheetLarge() =
        snap(
            "tablet-b-r1-types-large",
            large = true,
            beforeCapture = { compose.onNodeWithTag("builder.type").performClick() },
        ) { TrainingScreens.Builder() }

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
