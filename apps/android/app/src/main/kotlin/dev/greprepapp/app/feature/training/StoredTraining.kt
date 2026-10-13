package dev.greprepapp.app.feature.training

import dev.greprepapp.api.models.LocalizedText
import dev.greprepapp.api.models.Question
import dev.greprepapp.api.models.TrainingFinish
import dev.greprepapp.api.models.TrainingMode
import dev.greprepapp.api.models.TrainingSession
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.format.DateTimeParseException
import kotlin.math.ceil
import kotlin.math.roundToInt

/**
 * Тренировка на устройстве: сессия с сервера как есть (задания, ключи, разборы — чтобы дожить без сети) и то,
 * что человек сделал: ответы, где остановился, конец. Ответы копятся здесь и уходят на сервер очередью
 * (TrainingRepository.sync); unsent — позиции, ответ на которые сервер ещё не подтвердил.
 */
@Serializable
data class StoredTraining(
    val session: TrainingSession,
    /** Начало по часам устройства: от него идёт таймер «Проверки». Часы сервера здесь не помогут — нет сети. */
    val startedAtMillis: Long,
    val answers: Map<Int, RecordedAnswer> = emptyMap(),
    val unsent: Set<Int> = emptySet(),
    val position: Int = 0,
    val finish: TrainingFinish? = null,
    val finishSent: Boolean = false,
    /** Сервер подтвердил, что тренировки больше нет: новые локальные действия не оживляют её очередь. */
    val rejected: Boolean = false,
    /** Порядок запуска на устройстве сохраняется и при совпадении часов, и после перезапуска. */
    val creationOrder: Long = 0,
) {
    val id: String get() = session.id
    val total: Int get() = session.items.size
    val isCheck: Boolean get() = session.mode == TrainingMode.CHECK
    val isFinished: Boolean get() = finish != null

    /** Всё ли дошло до сервера: тогда тренировку можно убрать с устройства, когда она станет старой. */
    val isSynced: Boolean get() = unsent.isEmpty() && (finish == null || finishSent)

    fun question(position: Int): Question = session.items[position].question

    fun answer(position: Int): RecordedAnswer? = answers[position]
}

/** Тема из «Что повторить» (макет R15). positions — с нуля, на экране — с единицы. */
data class TopicReview(
    val topicId: String,
    val title: LocalizedText,
    val mistakes: Int,
    val positions: List<Int>,
)

/** Итог тренировки (макет R15). Считается на устройстве — без сети тоже. */
data class TrainingResult(
    val correct: Int,
    val total: Int,
    val unanswered: Int,
    val durationSeconds: Int,
    val review: List<TopicReview>,
)

/**
 * Правила тренировки — те же, что на сервере (server/internal/training): что считается полным и верным ответом,
 * что идёт в «Что повторить», сколько осталось времени. Сервер всё равно перепроверяет ответы сам.
 */
object TrainingRules {
    /** Сколько тем в «Что повторить» (PRODUCT.md: 1–3 темы). */
    const val MAX_REVIEW = 3

    /** Сколько вопросов в «Повторить»: по два на ошибку, но не меньше пяти и не больше десяти. */
    fun repeatCount(mistakes: Int): Int = (mistakes * 2).coerceIn(5, 10)

    /** Осталось секунд у «Проверки»; null — в «Практике» таймера нет. Не меньше нуля. */
    fun remainingSeconds(
        training: StoredTraining,
        nowMillis: Long,
    ): Int? {
        val limit = training.session.timeLimitSeconds ?: return null
        if (!training.isCheck) return null
        val elapsed = ((nowMillis - training.startedAtMillis) / MILLIS).toInt()
        return (limit - elapsed).coerceAtLeast(0)
    }

    /**
     * Итог. Ошибка для «Что повторить» — неверный ответ, «Не знаю» и пропуск. Когда время «Проверки» вышло,
     * неотвеченное — «не успел»: это не ошибка темы (решение Даши 06.10.2026).
     */
    fun result(training: StoredTraining): TrainingResult {
        val timedOut = training.isCheck && training.finish?.timedOut == true
        var correct = 0
        var unanswered = 0
        val byTopic = LinkedHashMap<String, TopicReview>()
        training.session.items.forEach { item ->
            val answer = training.answers[item.position]
            val response = answer?.response ?: emptyResponse(item.question)
            if (!response.isEmpty && response.isCorrect(item.question)) {
                correct++
                return@forEach
            }
            val dontKnow = answer?.dontKnow == true
            if (response.isEmpty) {
                unanswered++
                if (timedOut && !dontKnow) return@forEach
            }
            val q = item.question
            val prev = byTopic[q.topicId]
            byTopic[q.topicId] =
                if (prev == null) {
                    TopicReview(q.topicId, q.topicTitle, 1, listOf(item.position))
                } else {
                    prev.copy(mistakes = prev.mistakes + 1, positions = prev.positions + item.position)
                }
        }
        // Больше ошибок — выше; поровну — какая встретилась раньше (сортировка устойчивая).
        val review = byTopic.values.sortedByDescending { it.mistakes }.take(MAX_REVIEW)
        return TrainingResult(
            correct = correct,
            total = training.total,
            unanswered = unanswered,
            durationSeconds = durationSeconds(training),
            review = review,
        )
    }

    /** Минуты для итога: сколько шла и (у «Проверки») из скольких. */
    fun summaryMinutes(
        durationSeconds: Int,
        limitSeconds: Int?,
    ): Pair<Int, Int?> {
        // Лимит — вверх, как «~12 мин» в конструкторе; прошло — по округлению, но не больше лимита: «8 минут из 7»
        // при честном ограничении времени быть не может.
        val limit = limitSeconds?.let { ceil(it / SECONDS_PER_MINUTE).toInt() }
        val minutes = (durationSeconds / SECONDS_PER_MINUTE).roundToInt().coerceAtLeast(1)
        return (if (limit != null) minutes.coerceAtMost(limit) else minutes) to limit
    }

    /** Сколько шла тренировка: от начала на устройстве до конца; у «Проверки» — не больше её времени. */
    fun durationSeconds(training: StoredTraining): Int {
        val end = training.finish?.let { parseMillis(it.finishedAt) } ?: return 0
        val seconds = ((end - training.startedAtMillis) / MILLIS).toInt().coerceAtLeast(0)
        val limit = training.session.timeLimitSeconds
        return if (training.isCheck && limit != null) seconds.coerceAtMost(limit) else seconds
    }

    private fun parseMillis(iso: String): Long? =
        try {
            Instant.parse(iso).toEpochMilli()
        } catch (_: DateTimeParseException) {
            null
        }

    private const val MILLIS = 1000L
    private const val SECONDS_PER_MINUTE = 60.0
}
