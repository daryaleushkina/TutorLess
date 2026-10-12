package dev.greprepapp.app.feature.training

import dev.greprepapp.api.models.Exam
import dev.greprepapp.api.models.TrainingMode
import dev.greprepapp.api.models.TrainingRequest

/** Тип с наибольшим числом заданий этой темы в загруженной сессии; сам контент остаётся на сервере. */
internal fun topicPracticeRequest(
    training: StoredTraining,
    topicId: String,
): TrainingRequest? {
    val question =
        training.session.items
            .map { it.question }
            .filter { it.topicId == topicId }
            .groupBy { it.questionType }
            .maxByOrNull { it.value.size }
            ?.value
            ?.firstOrNull() ?: return null
    return TrainingRequest(
        exam = training.session.exam ?: Exam.GRE,
        section = question.section,
        questionTypes = setOf(question.questionType),
        count = TrainingDefaults.PRACTICE_QUESTIONS,
        mode = TrainingMode.PRACTICE,
        topicIds = listOf(topicId),
    )
}
