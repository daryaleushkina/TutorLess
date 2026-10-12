package dev.greprepapp.app.feature.training

import dev.greprepapp.api.ApiJson
import dev.greprepapp.api.models.GivenAnswer
import dev.greprepapp.api.models.Question
import dev.greprepapp.app.R
import dev.greprepapp.app.testing.NewQuestionFixtures
import kotlinx.serialization.Serializable
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NewQuestionRulesTest {
    @Test fun answersMatchTheSharedExamples() {
        val stream = checkNotNull(javaClass.getResourceAsStream("/question-types.json"))
        val cases = stream.bufferedReader().use { ApiJson.decodeFromString<QuestionExamples>(it.readText()) }
        assertTrue(cases.answers.isNotEmpty())
        // Неверный формат запроса проверяет сервер; здесь — зачёт всех допустимых ответов, как в старом наборе.
        cases.answers.filterNot { it.badAnswer }.forEach { c ->
            assertEquals(
                c.name,
                c.correct,
                !c.answer.dontKnow &&
                    c.answer
                        .toRecordedAnswer()
                        .response
                        .isCorrect(c.question),
            )
            if (c.correct && c.question.numericEntry?.decimalPlaces != null) {
                val expected = checkNotNull(c.answer.numericAnswer?.number).toBigDecimal()
                assertEquals(c.name, 0, expected.compareTo(NumericResponseComponent.keyText(c.question).toBigDecimal()))
            }
        }
    }

    @Test fun fixedCountMultiCanBeClearedAndDoesNotReplaceAnExistingChoice() {
        val question = NewQuestionFixtures.multi.copy(selectCount = 2, answer = listOf("B", "D"))
        val pair = Response.Options(listOf("B", "D"))
        assertEquals(ResponseChange(pair, limitHit = true), pair.toggle(question, "E"))
        assertFalse(pair.toggle(question, "B").response.isComplete(question))
        val single = question.copy(selectCount = 1, answer = listOf("B"))
        assertEquals(Response.Options(), Response.Options(listOf("B")).toggle(single, "B").response)
    }

    @Test fun singleTypedCharactersAreFilteredAndPastedTextCanBeExplained() {
        assertFalse(allowsNumericEdit("22,5", "22,5,", integer = false))
        assertFalse(allowsNumericEdit("2", "2-", integer = false))
        assertFalse(allowsNumericEdit("", "x", integer = false))
        assertTrue(allowsNumericEdit("", "-", integer = false))
        assertTrue(allowsNumericEdit("-", "-2", integer = false))
        assertTrue(allowsNumericEdit("2", "2.", integer = false))
        assertTrue(allowsNumericEdit("22,5", "22,5,0", integer = false))
        assertTrue(allowsNumericEdit("22,5,0", "22,5", integer = false))
        assertFalse(allowsNumericEdit("3", "3.", integer = true))
        assertTrue(allowsNumericEdit("3", "-3", integer = true))
        assertEquals(R.string.numeric_invalid_number, numericDraftError(NewQuestionFixtures.number, "22,5,0", "", ""))
        listOf("", "-", ".", ",", "-.", "-,", "22,5", "22.50").forEach {
            assertEquals(it, null, numericDraftError(NewQuestionFixtures.number, it, "", ""))
        }
        assertEquals(R.string.numeric_invalid_integer, numericDraftError(NewQuestionFixtures.fraction, "", "1.5", "3"))
        assertEquals(R.string.numeric_zero_denominator, numericDraftError(NewQuestionFixtures.fraction, "", "9", "0"))
        assertEquals(null, numericDraftError(NewQuestionFixtures.fraction, "", "9", "15"))
        assertEquals(null, numericDraftError(NewQuestionFixtures.fraction, "", "-", ""))
        assertEquals(R.string.numeric_too_long, numericDraftError(NewQuestionFixtures.number, "2".repeat(129), "", ""))
        assertEquals(R.string.numeric_too_long, numericDraftError(NewQuestionFixtures.fraction, "", "2".repeat(129), "3"))
        assertEquals(R.string.numeric_too_long, numericDraftError(NewQuestionFixtures.fraction, "", "3", "2".repeat(129)))
    }
}

@Serializable
private data class QuestionExamples(
    val answers: List<QuestionExample>,
)

@Serializable
private data class QuestionExample(
    val name: String,
    val question: Question,
    val answer: GivenAnswer,
    val correct: Boolean,
    val badAnswer: Boolean,
)
