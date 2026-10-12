package dev.greprepapp.app.snapshots

import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import dev.greprepapp.app.snapshots.TrainingScreens.Session
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Каждое состояние B: обе темы и настройка «Крупнее». */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "ru-" + RobolectricDeviceQualifiers.MediumPhone)
class TrainingSnapshotTest(
    theme: String,
    private val large: Boolean,
) : SnapshotBase(theme) {
    @Test fun screen0() = snap("b-r1" + if (large) "-large" else "", large = large) { TrainingScreens.Builder() }

    @Test fun screen1() =
        snap("b-r1-custom" + if (large) "-large" else "", large = large) {
            TrainingScreens.Builder(TrainingScreens.builderCustom)
        }

    @Test fun screen2() = snap("b-r2" + if (large) "-large" else "", large = large) { TrainingScreens.Builder(TrainingScreens.topics) }

    @Test fun screen3() = snap("b-r3" + if (large) "-large" else "", large = large) { Session(TrainingScreens.tcSelected) }

    @Test fun screen4() = snap("b-r4" + if (large) "-large" else "", large = large) { Session(TrainingScreens.tcWrong) }

    @Test fun screen5() = snap("b-r4-dk" + if (large) "-large" else "", large = large) { Session(TrainingScreens.dontKnow) }

    @Test fun screen6() = snap("b-r5" + if (large) "-large" else "", large = large) { Session(TrainingScreens.tc3Partial) }

    @Test fun screen7() = snap("b-r6-question" + if (large) "-large" else "", large = large) { Session(TrainingScreens.seSelected) }

    @Test fun screen8() = snap("b-r6" + if (large) "-large" else "", large = large) { Session(TrainingScreens.seCorrect) }

    @Test fun screen9() = snap("b-r9" + if (large) "-large" else "", large = large) { Session(TrainingScreens.qcPractice) }

    @Test fun screen10() = snap("b-single-choice" + if (large) "-large" else "", large = large) { Session(TrainingScreens.mcSelected) }

    @Test fun screen11() = snap("b-r14" + if (large) "-large" else "", large = large) { Session(TrainingScreens.qcTimed) }

    @Test fun screen12() = snap("b-r14-list" + if (large) "-large" else "", large = large) { Session(TrainingScreens.overview) }

    @Test fun screen13() = snap("b-r14-timeout" + if (large) "-large" else "", large = large) { Session(TrainingScreens.summaryTimedOut) }

    @Test fun screen14() = snap("b-r15" + if (large) "-large" else "", large = large) { Session(TrainingScreens.summary) }

    @Test fun screen15() = snap("b-r15-perfect" + if (large) "-large" else "", large = large) { Session(TrainingScreens.summaryPerfect) }

    @Test fun screen16() = snap("b-r16" + if (large) "-large" else "", large = large) { TrainingScreens.Review() }

    @Test fun screen17() = snap("b-r19" + if (large) "-large" else "", large = large) { TrainingScreens.ReviewItem() }

    @Test fun screen18() = snap("b-r20" + if (large) "-large" else "", large = large) { Session(TrainingScreens.past) }

    @Test fun screen19() = snap("b-r17" + if (large) "-large" else "", large = large) { TrainingScreens.Report() }

    @Test fun screen20() = snap("b-r17-failed" + if (large) "-large" else "", large = large) { TrainingScreens.Report(failed = true) }

    @Test fun screen21() =
        snap("b-builder-offline" + if (large) "-large" else "", large = large) {
            TrainingScreens.Builder(TrainingScreens.builderOffline)
        }

    @Test fun screen22() =
        snap("b-builder-empty" + if (large) "-large" else "", large = large) {
            TrainingScreens.Builder(TrainingScreens.builderNoQuestions)
        }

    @Test fun typeSheet() =
        snap(
            "b-r1-types" + if (large) "-large" else "",
            large = large,
            beforeCapture = { compose.onNodeWithTag("builder.type").performClick() },
        ) { TrainingScreens.Builder() }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}-large={1}")
        fun themes() =
            listOf(arrayOf<Any>("light", false), arrayOf<Any>("dark", false), arrayOf<Any>("light", true), arrayOf<Any>("dark", true))
    }
}
