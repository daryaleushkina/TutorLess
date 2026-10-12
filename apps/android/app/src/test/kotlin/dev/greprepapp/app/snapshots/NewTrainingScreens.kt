package dev.greprepapp.app.snapshots

import androidx.compose.runtime.Composable
import dev.greprepapp.api.models.NumericAnswer
import dev.greprepapp.api.models.Question
import dev.greprepapp.app.feature.training.RecordedAnswer
import dev.greprepapp.app.feature.training.Response
import dev.greprepapp.app.feature.training.SessionActions
import dev.greprepapp.app.feature.training.SessionContent
import dev.greprepapp.app.feature.training.SessionViewModel
import dev.greprepapp.app.testing.NewQuestionFixtures as Q

object NewTrainingScreens {
    @Composable
    fun Screen(name: String) {
        val (question, response) =
            when (name) {
                "r7", "r7-review" -> Q.rc to Response.Options(listOf("B"))
                "r7-text" -> Q.rc to Response.Options()
                "r8", "r8-correct" -> Q.sentence to Response.Sentence("s5")
                "r8-wrong" -> Q.sentence to Response.Sentence("s3")
                "r10" -> Q.multi to Response.Options(listOf("B", "D"))
                "r10-checked" -> Q.multi to Response.Options(listOf("B", "C", "D"))
                "r11", "r11-correct" -> Q.number to Response.Numeric(NumericAnswer(number = "22.5"))
                "r11-bad" -> Q.number to Response.Numeric(NumericAnswer(number = "22,5,0"))
                "r11b" -> Q.fraction to Response.Numeric(NumericAnswer(numerator = "9", denominator = "15"))
                else -> error("Unknown training snapshot: $name")
            }
        SessionContent(
            state(question, response, name in setOf("r7-review", "r8-correct", "r8-wrong", "r10-checked", "r11-correct")),
            SessionViewModel.RepeatState(),
            SessionActions(),
        )
    }

    private fun state(
        question: Question,
        response: Response,
        revealed: Boolean,
    ): SessionViewModel.UiState {
        val training = TrainingScreens.stored(question)
        return SessionViewModel.UiState.Active(
            SessionViewModel.Screen(
                training.copy(
                    answers =
                        if (revealed) {
                            mapOf(0 to RecordedAnswer(0, response, false, false, "2026-10-06T09:02:00Z", 30_000))
                        } else {
                            emptyMap()
                        },
                ),
                0,
                response,
                null,
                false,
                false,
                false,
            ),
        )
    }
}
