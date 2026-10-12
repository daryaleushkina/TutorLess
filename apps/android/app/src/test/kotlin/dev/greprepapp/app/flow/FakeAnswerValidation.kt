package dev.greprepapp.app.flow

import dev.greprepapp.api.models.GivenAnswer
import dev.greprepapp.api.models.NumericEntry
import dev.greprepapp.api.models.Question
import dev.greprepapp.api.models.QuestionType

/** Проверка формы запроса независимо от зачёта: неверный, но допустимый ответ сервер принимает. */
internal fun acceptsAnswer(
    question: Question,
    answer: GivenAnswer,
): Boolean {
    val forms = listOf(answer.optionIds.isNotEmpty(), answer.numericAnswer != null, answer.sentenceId != null).count { it }
    if (forms == 0) return true
    if (forms > 1 || answer.dontKnow) return false
    return when (question.questionType) {
        QuestionType.NUMERIC_ENTRY -> {
            val value = answer.numericAnswer ?: return false
            when (question.numericEntry?.format) {
                NumericEntry.Format.NUMBER -> {
                    val number = value.number ?: return false
                    value.numerator == null && value.denominator == null && number.length <= 128 &&
                        Regex("-?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)").matches(number)
                }

                NumericEntry.Format.FRACTION -> {
                    val numerator = value.numerator ?: return false
                    val denominator = value.denominator ?: return false
                    value.number == null &&
                        listOf(numerator, denominator).all {
                            it.length <= 128 && Regex("-?[0-9]+").matches(it)
                        } && denominator.toBigInteger().signum() != 0
                }

                null -> {
                    false
                }
            }
        }

        QuestionType.SELECT_IN_PASSAGE -> {
            answer.sentenceId?.let { id ->
                id.isNotEmpty() && question.passage
                    ?.paragraphs
                    ?.flatMap { it.sentences }
                    ?.any { it.id == id } == true
            } == true
        }

        else -> {
            val ids = answer.optionIds
            ids.isNotEmpty() && ids.distinct().size == ids.size &&
                ids.all { id -> question.groups.any { group -> group.options.any { it.id == id } } } &&
                question.groups.all { group ->
                    question.selectCount == 0 || group.options.count { it.id in ids } <= question.selectCount
                }
        }
    }
}
