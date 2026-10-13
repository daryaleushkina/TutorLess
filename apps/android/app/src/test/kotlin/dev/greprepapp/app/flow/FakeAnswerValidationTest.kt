package dev.greprepapp.app.flow

import dev.greprepapp.api.ApiJson
import dev.greprepapp.api.models.AnswerBatch
import dev.greprepapp.api.models.GivenAnswer
import dev.greprepapp.app.feature.training.RecordedAnswer
import dev.greprepapp.app.feature.training.emptyResponse
import dev.greprepapp.app.testing.Fixtures
import dev.greprepapp.app.testing.questionTypeExamples
import kotlinx.serialization.json.jsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FakeAnswerValidationTest {
    @Test fun requestValidationMatchesEverySharedExample() {
        val examples = examples()
        assertTrue(examples.any { it.badAnswer })
        examples.forEach { assertEquals(it.name, !it.badAnswer, acceptsAnswer(it.question, it.answer)) }
    }

    @Test fun fakeServerRejectsBadFormsOverHttp() {
        val server = FakeServer()
        val client = OkHttpClient()
        try {
            server.issue("token")
            examples().forEach { example ->
                server.nextSession = Fixtures.session(example.question)
                val request =
                    Request
                        .Builder()
                        .url(server.url.resolve("api/trainings/${server.nextSession.id}/answers")!!)
                        .header("Authorization", "Bearer token")
                        .post(ApiJson.encodeToString(AnswerBatch(listOf(example.answer))).toRequestBody("application/json".toMediaType()))
                        .build()
                client.newCall(request).execute().use { assertEquals(example.name, if (example.badAnswer) 400 else 204, it.code) }
            }
        } finally {
            server.close()
            client.connectionPool.evictAll()
            client.dispatcher.executorService.shutdown()
        }
    }

    @Test fun emptyResponsesOmitTypedFormsForEverySharedQuestion() {
        examples().forEach { example ->
            val answer = RecordedAnswer(0, emptyResponse(example.question), false, true, "2026-10-13T00:00:00Z", 1200).toGivenAnswer()
            assertNull(example.name, answer.numericAnswer)
            assertNull(example.name, answer.sentenceId)
            val json = ApiJson.parseToJsonElement(ApiJson.encodeToString(GivenAnswer.serializer(), answer)).jsonObject
            assertFalse(example.name, "numericAnswer" in json)
            assertFalse(example.name, "sentenceId" in json)
            assertTrue(example.name, acceptsAnswer(example.question, answer))
            assertTrue(answer.flagged)
            assertEquals(1200, answer.elapsedMs)
        }
    }

    private fun examples() = questionTypeExamples() + questionTypeExamples("/training-rules.json")
}
