package dev.greprepapp.app.feature.shell

import dev.greprepapp.api.models.Exam
import dev.greprepapp.api.models.LastTraining
import dev.greprepapp.api.models.QuestionType
import dev.greprepapp.api.models.Section
import dev.greprepapp.api.models.TrainingSource
import dev.greprepapp.app.snapshots.ShellFixtures
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HomeRequestTest {
    @Test fun lastTrainingCannotOfferStartWhenAllSectionsAreEmpty() {
        val state = ShellFixtures.history.copy(options = ShellFixtures.first.options!!.copy(types = emptyList()))
        assertNull(state.startRequest())
    }

    @Test fun lastTrainingFromAnotherExamDoesNotReplaceAvailableDefault() {
        val state = ShellFixtures.history
        val last = state.home!!.lastTraining!!
        val changed = state.copy(home = state.home.copy(lastTraining = last.copy(request = last.request.copy(exam = Exam.TOEFL))))
        val request = changed.startRequest()!!
        assertEquals(Exam.GRE, request.exam)
        assertEquals(setOf(QuestionType.TEXT_COMPLETION), request.questionTypes)
    }

    @Test fun removedLastTypeFallsBackToAnAvailableType() {
        val state = ShellFixtures.history
        val remaining = state.options!!.types.filter { it.section == Section.QUANT }
        val request = state.copy(options = state.options.copy(types = remaining)).startRequest()!!
        assertEquals(Section.QUANT, request.section)
        assertEquals(setOf(QuestionType.QUANTITATIVE_COMPARISON), request.questionTypes)
        assertEquals(2, request.count)
    }

    @Test fun historyKeepsActualSizeAndModeButDoesNotRepeatMistakesSource() {
        val state = ShellFixtures.history
        val last = state.home!!.lastTraining!!
        val request = last.request.copy(source = TrainingSource.MISTAKES)
        val actual = state.copy(home = state.home.copy(lastTraining = LastTraining(request, 4))).startRequest()!!
        assertEquals(request.copy(source = null, count = 4), actual)
    }

    @Test fun lastCheckStartsWithTheSectionCount() {
        val state = ShellFixtures.history
        val last = state.home!!.lastTraining!!
        val actual =
            state
                .copy(
                    home =
                        state.home.copy(
                            lastTraining =
                                last.copy(
                                    request = last.request.copy(mode = dev.greprepapp.api.models.TrainingMode.CHECK),
                                    propertySize = 4,
                                ),
                        ),
                ).startRequest()!!
        assertEquals(12, actual.count)
    }

    @Test fun firstTrainingRespectsServerMaximum() {
        val state = ShellFixtures.first
        assertEquals(3, state.copy(options = state.options!!.copy(maxQuestions = 3)).startRequest()!!.count)
    }

    @Test fun missingExamOrOptionsCannotStart() {
        val state = ShellFixtures.first
        assertNull(state.copy(user = state.user!!.copy(activeExam = null)).startRequest())
        assertNull(state.copy(options = null).startRequest())
    }
}
