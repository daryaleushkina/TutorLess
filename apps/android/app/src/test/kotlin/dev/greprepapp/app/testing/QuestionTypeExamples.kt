package dev.greprepapp.app.testing

import dev.greprepapp.api.ApiJson
import dev.greprepapp.api.models.GivenAnswer
import dev.greprepapp.api.models.Question
import kotlinx.serialization.Serializable

@Serializable
data class QuestionTypeExamples(
    val answers: List<QuestionTypeExample>,
)

@Serializable
data class QuestionTypeExample(
    val name: String,
    val question: Question,
    val answer: GivenAnswer,
    val correct: Boolean,
    val badAnswer: Boolean,
)

fun questionTypeExamples(resource: String = "/question-types.json"): List<QuestionTypeExample> =
    checkNotNull(QuestionTypeExamples::class.java.getResourceAsStream(resource))
        .bufferedReader()
        .use { ApiJson.decodeFromString<QuestionTypeExamples>(it.readText()).answers }
