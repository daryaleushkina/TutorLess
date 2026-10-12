package dev.greprepapp.app.feature.training

import dev.greprepapp.api.models.GivenAnswer
import dev.greprepapp.api.models.NumericAnswer
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/** Ответ компонента: сессия и очередь не зависят от формы ввода. */
@Serializable
sealed interface Response {
    @Serializable
    data class Options(
        val ids: List<String> = emptyList(),
    ) : Response

    @Serializable
    data class Numeric(
        val value: NumericAnswer,
    ) : Response

    @Serializable
    data class Sentence(
        val sentenceId: String,
    ) : Response

    val isEmpty: Boolean
        get() =
            when (this) {
                is Options -> ids.isEmpty()
                is Numeric -> listOf(value.number, value.numerator, value.denominator).all { it.isNullOrBlank() }
                is Sentence -> sentenceId.isBlank()
            }
}

@Serializable(with = RecordedAnswerSerializer::class)
data class RecordedAnswer(
    val position: Int,
    val response: Response,
    val dontKnow: Boolean,
    val flagged: Boolean,
    val answeredAt: String,
    val elapsedMs: Int,
) {
    /** Представление вариантов нужно только компонентам четырёх прежних типов. */
    val optionIds: List<String> get() = (response as? Response.Options)?.ids.orEmpty()

    fun toGivenAnswer(): GivenAnswer =
        GivenAnswer(
            position,
            optionIds,
            dontKnow,
            flagged,
            answeredAt,
            elapsedMs,
            numericAnswer = (response as? Response.Numeric)?.value,
            sentenceId = (response as? Response.Sentence)?.sentenceId,
        )
}

fun GivenAnswer.toRecordedAnswer(): RecordedAnswer {
    val numeric = numericAnswer
    val sentence = sentenceId
    if ((numericAnswer != null && (sentenceId != null || optionIds.isNotEmpty())) ||
        (sentenceId != null && optionIds.isNotEmpty())
    ) {
        throw SerializationException("Several response forms in one answer")
    }
    val response =
        when {
            numeric != null -> Response.Numeric(numeric)
            sentence != null -> Response.Sentence(sentence)
            else -> Response.Options(optionIds)
        }
    return RecordedAnswer(position, response, dontKnow, flagged, answeredAt, elapsedMs)
}

/** Формат на диске остаётся форматом GivenAnswer: прежние файлы читаются без перезаписи и потерь. */
object RecordedAnswerSerializer : KSerializer<RecordedAnswer> {
    private val wire = GivenAnswer.serializer()
    override val descriptor: SerialDescriptor = wire.descriptor

    override fun serialize(
        encoder: Encoder,
        value: RecordedAnswer,
    ) = wire.serialize(encoder, value.toGivenAnswer())

    override fun deserialize(decoder: Decoder): RecordedAnswer = wire.deserialize(decoder).toRecordedAnswer()
}
