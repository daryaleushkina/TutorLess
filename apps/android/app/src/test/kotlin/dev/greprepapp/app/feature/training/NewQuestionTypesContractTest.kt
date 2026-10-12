package dev.greprepapp.app.feature.training

import dev.greprepapp.api.ApiJson
import dev.greprepapp.api.models.Question
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** Серверные формы читаются без подмены enum: иначе объявление возможностей обещает недоступный экран. */
@RunWith(Parameterized::class)
class NewQuestionTypesContractTest(
    private val wireType: String,
) {
    @Test
    fun readsQuestionsFromSharedContractExamples() {
        val resource = checkNotNull(javaClass.getResourceAsStream("/question-types.json"))
        val examples =
            resource.bufferedReader(Charsets.UTF_8).use {
                ApiJson
                    .parseToJsonElement(it.readText())
                    .jsonObject
                    .getValue("answers")
                    .jsonArray
            }
        val questions =
            examples.map { it.jsonObject.getValue("question").jsonObject }.filter {
                it.getValue("questionType").jsonPrimitive.content == wireType && "figure" !in it
            }
        assertTrue("Общие примеры должны содержать $wireType", questions.isNotEmpty())
        questions.forEach { json ->
            val question = ApiJson.decodeFromJsonElement<Question>(json)
            assertEquals(wireType, question.questionType.value)
        }
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun types() =
            listOf(
                arrayOf("multiple_choice_multi"),
                arrayOf("numeric_entry"),
                arrayOf("select_in_passage"),
                arrayOf("multiple_choice"),
            )
    }
}
