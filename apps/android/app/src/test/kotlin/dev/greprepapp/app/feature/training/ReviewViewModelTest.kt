package dev.greprepapp.app.feature.training

import dev.greprepapp.api.models.TrainingMode
import dev.greprepapp.app.testing.Fixtures
import dev.greprepapp.app.testing.MainDispatcherRule
import dev.greprepapp.app.testing.Reply
import dev.greprepapp.app.testing.TestGraph
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class ReviewViewModelTest {
    @get:Rule val main = MainDispatcherRule()

    @get:Rule val folder = TemporaryFolder()

    @Test fun topicPracticeKeepsExamAndTopicAndHandlesStartFailures() =
        runTest(main.dispatcher) {
            val g = TestGraph(this, main.dispatcher, folder.root, token = "token").also { it.settle() }
            g.trainingsApi.start = Reply.Ok(Fixtures.session(Fixtures.tc1, Fixtures.tc1, Fixtures.se.copy(topicId = Fixtures.tc1.topicId)))
            val id = (g.trainings.start(Fixtures.timedPreset.request) as StartResult.Started).trainingId
            val vm = ReviewViewModel(id, g.trainings)
            advanceUntilIdle()
            vm.startTopic("missing")
            assertEquals(1, g.trainingsApi.starts.size)
            for ((reply, expected) in listOf(
                Reply.NetworkDown to StartProblem.Offline,
                Reply.Error(409, "no_questions") to StartProblem.NoQuestions,
                Reply.Error(500) to StartProblem.Failed,
            )) {
                g.trainingsApi.start = reply
                vm.startTopic(Fixtures.tc1.topicId)
                advanceUntilIdle()
                assertEquals(expected, vm.topicStart.value.problem)
            }
            g.trainingsApi.start = Reply.Ok(Fixtures.session(Fixtures.tc1, id = "topic"))
            vm.startTopic(Fixtures.tc1.topicId)
            vm.startTopic(Fixtures.tc1.topicId)
            advanceUntilIdle()
            assertEquals("topic", vm.topicStart.value.started)
            val request = g.trainingsApi.starts.last()
            assertEquals(TrainingMode.PRACTICE, request.mode)
            assertEquals(setOf(Fixtures.tc1.questionType), request.questionTypes)
            assertEquals(listOf(Fixtures.tc1.topicId), request.topicIds)
            assertEquals(10, request.count)
            vm.consumeStarted()
            assertNull(vm.topicStart.value.started)
        }

    @Test fun missingTrainingCannotStartATopic() =
        runTest(main.dispatcher) {
            val g = TestGraph(this, main.dispatcher, folder.root, token = "token").also { it.settle() }
            val vm = ReviewViewModel("missing", g.trainings)
            vm.startTopic(Fixtures.tc1.topicId)
            advanceUntilIdle()
            assertEquals(ReviewViewModel.UiState.Missing, vm.state.value)
            assertEquals(0, g.trainingsApi.starts.size)
        }
}
