package dev.greprepapp.app.feature.training

import dev.greprepapp.api.ApiJson
import dev.greprepapp.api.models.GivenAnswer
import dev.greprepapp.api.models.NumericAnswer
import dev.greprepapp.api.models.NumericEntry
import dev.greprepapp.api.models.Passage
import dev.greprepapp.api.models.PassageParagraph
import dev.greprepapp.api.models.PassageSentence
import dev.greprepapp.app.testing.Fixtures
import kotlinx.serialization.SerializationException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ResponseComponentsTest {
    @Test fun multiRequiresAtLeastOneAndSeRefusesTheThirdWord() {
        val multi = Fixtures.mc.copy(selectCount = 0)
        assertFalse(Response.Options().isComplete(multi))
        val one = Response.Options(listOf("A"))
        assertTrue(one.isComplete(multi))
        assertEquals(Response.Options(listOf("A", "B")), one.toggle(multi, "B").response)
        val pair = Response.Options(listOf("A", "C"))
        assertEquals(ResponseChange(pair, true), pair.toggle(Fixtures.se, "F"))
        assertEquals(Response.Options(listOf("C")), pair.toggle(Fixtures.se, "A").response)
        assertFalse(Response.Options(listOf("A", "A")).isComplete(Fixtures.se))
        assertFalse(Response.Options(listOf("unknown")).isCorrect(Fixtures.tc1))
        assertEquals(pair, pair.toggle(Fixtures.se, "unknown").response)
    }

    @Test fun numbersUseExactRationalsAndTheContractRounding() {
        val q =
            Fixtures.mc.copy(
                groups = emptyList(),
                selectCount = 0,
                answer = emptyList(),
                numericEntry = NumericEntry(NumericEntry.Format.NUMBER),
                numericAnswer = NumericAnswer(numerator = "1", denominator = "2"),
            )
        assertTrue(Response.Numeric(NumericAnswer(number = ".50")).isCorrect(q))
        assertFalse(Response.Numeric(NumericAnswer(number = "0.51")).isCorrect(q))
        assertFalse(Response.Options().isComplete(q))
        assertFalse(Response.Numeric(NumericAnswer(number = "0.5")).isComplete(q.copy(numericEntry = null)))
        for (text in listOf("", "-", "1e2", "NaN", " 1", "1".repeat(129))) {
            assertFalse(text, Response.Numeric(NumericAnswer(number = text)).isComplete(q))
        }
        val fraction = q.copy(numericEntry = NumericEntry(NumericEntry.Format.FRACTION))
        assertTrue(Response.Numeric(NumericAnswer(numerator = "-2", denominator = "-4")).isCorrect(fraction))
        for (value in listOf(
            NumericAnswer(),
            NumericAnswer(numerator = "1"),
            NumericAnswer(numerator = "x", denominator = "2"),
            NumericAnswer(numerator = "1", denominator = "0"),
            NumericAnswer(number = "0.5", numerator = "1", denominator = "2"),
        )) {
            assertFalse(Response.Numeric(value).isComplete(fraction))
        }
        val rounded = q.copy(numericEntry = NumericEntry(NumericEntry.Format.NUMBER, 2), numericAnswer = NumericAnswer(number = "-1.235"))
        assertTrue(Response.Numeric(NumericAnswer(number = "-1.24")).isCorrect(rounded))
        assertFalse(Response.Numeric(NumericAnswer(number = "-1.235")).isCorrect(rounded))
        for (places in listOf(-1, 13)) {
            assertFalse(
                Response
                    .Numeric(
                        NumericAnswer(number = "0.5"),
                    ).isCorrect(q.copy(numericEntry = NumericEntry(NumericEntry.Format.NUMBER, places))),
            )
        }
        assertFalse(Response.Numeric(NumericAnswer(number = "1")).isCorrect(q.copy(numericAnswer = null)))
        assertFalse(Response.Numeric(NumericAnswer(number = "1")).isCorrect(q.copy(numericAnswer = NumericAnswer(denominator = "0"))))
    }

    @Test fun sentenceUsesThePassageIdentityAndTheKey() {
        val q = sentenceQuestion()
        assertTrue(Response.Sentence("sentence-1").isCorrect(q))
        assertTrue(Response.Sentence("sentence-2").isComplete(q))
        assertFalse(Response.Sentence("sentence-2").isCorrect(q))
        assertFalse(Response.Sentence("unknown").isComplete(q))
        assertFalse(Response.Sentence("").isComplete(q))
        assertFalse(Response.Options(listOf("sentence-1")).isComplete(q))
        assertFalse(Response.Sentence("sentence-1").isComplete(q.copy(passage = null)))
        assertTrue(emptyResponse(q) is Response.Sentence)
    }

    @Test fun legacyFilesAndEveryResponseRoundTripWithoutLosingMetadata() {
        for (response in listOf(
            Response.Options(listOf("A")),
            Response.Numeric(NumericAnswer(number = "-0.50")),
            Response.Numeric(NumericAnswer(numerator = "-3", denominator = "7")),
            Response.Sentence("sentence-1"),
        )) {
            val answer = RecordedAnswer(2, response, false, true, "2026-10-12T00:00:00Z", 1234)
            val wire = answer.toGivenAnswer()
            val legacy = ApiJson.encodeToString(GivenAnswer.serializer(), wire)
            assertEquals(answer, ApiJson.decodeFromString(RecordedAnswer.serializer(), legacy))
            assertEquals(
                wire,
                ApiJson.decodeFromString(GivenAnswer.serializer(), ApiJson.encodeToString(RecordedAnswer.serializer(), answer)),
            )
            assertEquals(response, ApiJson.decodeFromString(Response.serializer(), ApiJson.encodeToString(Response.serializer(), response)))
        }
        assertTrue(Response.Options().isEmpty)
        assertTrue(Response.Numeric(NumericAnswer()).isEmpty)
        assertTrue(Response.Sentence("").isEmpty)
        assertFalse(Response.Numeric(NumericAnswer(numerator = "1")).isEmpty)
    }

    @Test(expected = SerializationException::class)
    fun ambiguousWireAnswerIsRejectedInsteadOfDroppingFields() {
        GivenAnswer(0, listOf("A"), false, false, "2026-10-12T00:00:00Z", 0, numericAnswer = NumericAnswer(number = "1")).toRecordedAnswer()
    }

    @Test(expected = SerializationException::class)
    fun twoNonOptionAnswersCannotBecomeOne() {
        GivenAnswer(
            0,
            emptyList(),
            false,
            false,
            "2026-10-12T00:00:00Z",
            0,
            numericAnswer = NumericAnswer(number = "1"),
            sentenceId = "sentence-1",
        ).toRecordedAnswer()
    }
}

internal fun sentenceQuestion() =
    Fixtures.mc.copy(
        groups = emptyList(),
        selectCount = 0,
        answer = listOf("sentence-1"),
        passage =
            Passage(
                "passage-fixture",
                listOf(
                    PassageParagraph(
                        listOf(
                            PassageSentence("sentence-1", "First fixture sentence."),
                            PassageSentence("sentence-2", "Second fixture sentence."),
                        ),
                    ),
                ),
            ),
    )
