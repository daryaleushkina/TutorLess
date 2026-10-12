package dev.greprepapp.app.feature.training

import dev.greprepapp.api.models.NumericAnswer
import dev.greprepapp.api.models.NumericEntry
import dev.greprepapp.api.models.Question
import dev.greprepapp.api.models.QuestionType
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode

/** Компонент владеет полнотой, ключом и переключением; сессия только передаёт ему ответ. */
internal interface ResponseComponent {
    fun isComplete(
        question: Question,
        response: Response,
    ): Boolean

    fun isCorrect(
        question: Question,
        response: Response,
    ): Boolean

    fun missingGroups(
        question: Question,
        response: Response,
    ): List<Int> = emptyList()

    fun toggle(
        question: Question,
        response: Response,
        optionId: String,
    ): ResponseChange = ResponseChange(response)
}

data class ResponseChange(
    val response: Response,
    val limitHit: Boolean = false,
)

/** Правка применяется к последнему ответу, а не к захваченному кадру Compose. */
typealias ResponseEdit = (Response) -> ResponseChange

internal fun responseComponent(
    question: Question,
    response: Response = emptyResponse(question),
): ResponseComponent =
    when {
        question.numericEntry != null || response is Response.Numeric -> {
            NumericResponseComponent
        }

        response is Response.Sentence || (question.groups.isEmpty() && question.passage != null) -> {
            SentenceResponseComponent
        }

        else -> {
            when (question.questionType) {
                QuestionType.TEXT_COMPLETION -> CompletionResponseComponent
                QuestionType.SENTENCE_EQUIVALENCE -> EquivalenceResponseComponent
                QuestionType.QUANTITATIVE_COMPARISON -> ComparisonResponseComponent
                QuestionType.MULTIPLE_CHOICE -> ChoiceResponseComponent
            }
        }
    }

internal fun emptyResponse(question: Question): Response =
    when {
        question.numericEntry != null -> Response.Numeric(NumericAnswer())
        question.groups.isEmpty() && question.passage != null -> Response.Sentence("")
        else -> Response.Options()
    }

internal fun Response.isComplete(question: Question): Boolean = responseComponent(question, this).isComplete(question, this)

internal fun Response.isCorrect(question: Question): Boolean = responseComponent(question, this).isCorrect(question, this)

internal fun Response.missingGroups(question: Question): List<Int> = responseComponent(question, this).missingGroups(question, this)

internal fun Response.toggle(
    question: Question,
    optionId: String,
): ResponseChange = responseComponent(question, this).toggle(question, this, optionId)

internal open class OptionsResponseComponent(
    private val refuseExtra: Boolean = false,
) : ResponseComponent {
    override fun isComplete(
        question: Question,
        response: Response,
    ): Boolean {
        val ids = (response as? Response.Options)?.ids ?: return false
        val offered =
            question.groups
                .flatMap { it.options }
                .map { it.id }
                .toSet()
        return question.groups.isNotEmpty() && ids.isNotEmpty() && ids.size == ids.toSet().size &&
            ids.all { it in offered } && missingGroups(question, response).isEmpty()
    }

    override fun isCorrect(
        question: Question,
        response: Response,
    ): Boolean = isComplete(question, response) && (response as Response.Options).ids.toSet() == question.answer.toSet()

    override fun missingGroups(
        question: Question,
        response: Response,
    ): List<Int> {
        val ids = (response as? Response.Options)?.ids.orEmpty()
        // selectCount=0 у multi означает «все подходящие», а не разрешение пустого ответа.
        return question.groups.indices.filter { g -> question.groups[g].options.count { it.id in ids } < maxOf(1, question.selectCount) }
    }

    override fun toggle(
        question: Question,
        response: Response,
        optionId: String,
    ): ResponseChange {
        val selection = (response as? Response.Options)?.ids ?: return ResponseChange(response)
        val group = question.groups.firstOrNull { g -> g.options.any { it.id == optionId } } ?: return ResponseChange(response)
        val inGroup = group.options.map { it.id }.toSet()
        if (question.selectCount == 1) return ResponseChange(Response.Options(selection.filterNot { it in inGroup } + optionId))
        if (optionId in selection) return ResponseChange(Response.Options(selection - optionId))
        val chosen = selection.filter { it in inGroup }
        if (question.selectCount > 0 && chosen.size >= question.selectCount) {
            if (refuseExtra) return ResponseChange(response, limitHit = true)
            return ResponseChange(Response.Options(selection - chosen.first() + optionId))
        }
        return ResponseChange(Response.Options(selection + optionId))
    }
}

internal object CompletionResponseComponent : OptionsResponseComponent()

internal object EquivalenceResponseComponent : OptionsResponseComponent(refuseExtra = true)

internal object ComparisonResponseComponent : OptionsResponseComponent()

internal object ChoiceResponseComponent : OptionsResponseComponent()

/** Пока только модель; экран числа добавится вместе с частью 3б. */
internal object NumericResponseComponent : ResponseComponent {
    override fun isComplete(
        question: Question,
        response: Response,
    ): Boolean {
        val value = (response as? Response.Numeric)?.value ?: return false
        val format = question.numericEntry?.format ?: return false
        return when (format) {
            NumericEntry.Format.NUMBER -> {
                value.number != null && value.numerator == null && value.denominator == null &&
                    rational(value) != null
            }

            NumericEntry.Format.FRACTION -> {
                value.number == null && value.numerator != null && value.denominator != null &&
                    rational(value) != null
            }
        }
    }

    override fun isCorrect(
        question: Question,
        response: Response,
    ): Boolean {
        if (!isComplete(question, response)) return false
        val expected = question.numericAnswer?.let(::rational) ?: return false
        val actual = rational((response as Response.Numeric).value) ?: return false
        val places = question.numericEntry?.decimalPlaces
        if (places != null && places !in 0..MAX_DECIMAL_PLACES) return false
        val key =
            if (places == null) {
                expected
            } else {
                val rounded = BigDecimal(expected.first).divide(BigDecimal(expected.second), places, RoundingMode.HALF_UP)
                rounded.unscaledValue() to BigInteger.TEN.pow(places)
            }
        return actual.first * key.second == key.first * actual.second
    }

    private fun rational(value: NumericAnswer): Pair<BigInteger, BigInteger>? {
        val number = value.number
        if (number != null) {
            if (value.numerator != null || value.denominator != null || number.length > MAX_NUMERIC_LENGTH ||
                !DECIMAL.matches(number)
            ) {
                return null
            }
            val decimal = BigDecimal(number)
            return decimal.unscaledValue() to BigInteger.TEN.pow(decimal.scale())
        }
        val numerator = integer(value.numerator) ?: return null
        val denominator = integer(value.denominator) ?: return null
        if (denominator == BigInteger.ZERO) return null
        return numerator to denominator
    }

    private fun integer(text: String?): BigInteger? =
        text?.takeIf { it.length <= MAX_NUMERIC_LENGTH && INTEGER.matches(it) }?.toBigInteger()

    private const val MAX_NUMERIC_LENGTH = 128
    private const val MAX_DECIMAL_PLACES = 12
    private val DECIMAL = Regex("-?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)")
    private val INTEGER = Regex("-?[0-9]+")
}

/** Пока только модель; выбор предложения получит свой компонент в части 3б. */
internal object SentenceResponseComponent : ResponseComponent {
    override fun isComplete(
        question: Question,
        response: Response,
    ): Boolean {
        val id = (response as? Response.Sentence)?.sentenceId ?: return false
        return id.isNotBlank() && question.passage?.paragraphs?.any { p -> p.sentences.any { it.id == id } } == true
    }

    override fun isCorrect(
        question: Question,
        response: Response,
    ): Boolean = isComplete(question, response) && question.answer == listOf((response as Response.Sentence).sentenceId)
}
