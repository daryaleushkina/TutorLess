package dev.greprepapp.app.feature.training

import androidx.lifecycle.viewModelScope
import dev.greprepapp.api.models.NumericAnswer
import dev.greprepapp.api.models.NumericEntry
import dev.greprepapp.app.testing.Fixtures
import dev.greprepapp.app.testing.MainDispatcherRule
import dev.greprepapp.app.testing.Reply
import dev.greprepapp.app.testing.TestGraph
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class ResponseSessionTest {
    @get:Rule val main = MainDispatcherRule()

    @get:Rule val folder = TemporaryFolder()

    @Test fun typedAnswersSurviveSessionRestartDiskAndOfflineQueue() =
        runTest(main.dispatcher) {
            val g = TestGraph(this, main.dispatcher, folder.root, token = "token").also { it.settle() }
            g.trainingsApi.answers = Reply.NetworkDown
            val numeric =
                Fixtures.mc.copy(
                    groups = emptyList(),
                    selectCount = 0,
                    answer = emptyList(),
                    numericEntry = NumericEntry(NumericEntry.Format.NUMBER),
                    numericAnswer = NumericAnswer(number = "-0.50"),
                )
            val questions =
                listOf(
                    numeric,
                    numeric.copy(
                        numericEntry = NumericEntry(NumericEntry.Format.FRACTION),
                        numericAnswer = NumericAnswer(numerator = "-3", denominator = "7"),
                    ),
                    sentenceQuestion(),
                )
            val responses =
                listOf(
                    Response.Numeric(NumericAnswer(number = "-0.50")),
                    Response.Numeric(NumericAnswer(numerator = "-3", denominator = "7")),
                    Response.Sentence("sentence-1"),
                )
            questions.forEachIndexed { index, q ->
                g.trainingsApi.start = Reply.Ok(Fixtures.session(q, id = "typed-$index"))
                val id = (g.trainings.start(Fixtures.lastPreset.request) as StartResult.Started).trainingId
                val vm = SessionViewModel(id, g.trainings, g.clock, g.ticker)
                advanceUntilIdle()
                vm.respond(responses[index])
                advanceUntilIdle()
                assertTrue((vm.state.value as SessionViewModel.UiState.Active).screen.canCheck)
                vm.check()
                advanceUntilIdle()
                assertEquals(
                    responses[index],
                    g.trainingStore
                        .get(id)
                        ?.answer(0)
                        ?.response,
                )
                assertEquals(setOf(0), g.trainingStore.get(id)?.unsent)
                val disk = TrainingStore(folder.root).get(id)!!
                assertEquals(responses[index], disk.answer(0)?.response)
                assertEquals(1, TrainingRules.result(disk).correct)
                vm.viewModelScope.cancel()
                val resumed = SessionViewModel(id, g.trainings, g.clock, g.ticker)
                advanceUntilIdle()
                assertEquals(responses[index], (resumed.state.value as SessionViewModel.UiState.Active).screen.response)
                resumed.respond(Response.Options())
                advanceUntilIdle()
                assertEquals(responses[index], (resumed.state.value as SessionViewModel.UiState.Active).screen.response)
                resumed.viewModelScope.cancel()
            }
            g.trainingsApi.answers = Reply.Ok(Unit)
            g.trainings.sync()
            advanceUntilIdle()
            questions.indices.forEach { index ->
                val sent =
                    g.trainingsApi.sentAnswers
                        .last { it.first == "typed-$index" }
                        .second.answers
                        .single()
                assertEquals(responses[index], sent.toRecordedAnswer().response)
            }
            // После отправки старые незаконченные сессии убираются; доставка проверена по телам запросов.
            assertTrue(
                g.trainingStore.trainings.value.values
                    .all { it.unsent.isEmpty() },
            )
        }
}
