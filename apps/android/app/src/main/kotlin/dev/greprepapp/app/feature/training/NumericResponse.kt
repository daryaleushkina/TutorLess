package dev.greprepapp.app.feature.training

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import dev.greprepapp.api.models.NumericAnswer
import dev.greprepapp.api.models.NumericEntry
import dev.greprepapp.api.models.Question
import dev.greprepapp.app.R
import dev.greprepapp.design.Gp
import dev.greprepapp.design.MathFamily
import greprep.design.GpLayout
import greprep.design.GpRadius
import greprep.design.GpSize
import greprep.design.GpSpace

/**
 * Сырой ввод принадлежит полю и переживает пересоздание. В ответ сессии попадает только валидное число
 * с точкой; иначе — пустой ответ. Поэтому «Проверка», сохраняющая каждый ввод, не отправит плохую вставку.
 * Ответ приходит снаружи: новый Numeric (в том числе из будущего калькулятора) обновляет поля.
 */
@Composable
internal fun NumericResponse(
    question: Question,
    response: Response,
    revealed: Boolean,
    onEdit: (ResponseEdit) -> Unit,
) {
    val format = checkNotNull(question.numericEntry).format
    val value = (response as? Response.Numeric)?.value ?: NumericAnswer()
    var number by rememberSaveable(question.id) { mutableStateOf(value.number.orEmpty()) }
    var numerator by rememberSaveable(question.id) { mutableStateOf(value.numerator.orEmpty()) }
    var denominator by rememberSaveable(question.id) { mutableStateOf(value.denominator.orEmpty()) }
    var emitted by remember(question.id) { mutableStateOf(response) }
    LaunchedEffect(response, revealed) {
        if (response != emitted || (revealed && response.isEmpty)) {
            number = value.number.orEmpty()
            numerator = value.numerator.orEmpty()
            denominator = value.denominator.orEmpty()
            emitted = response
        }
    }

    fun publish() {
        val candidate =
            Response.Numeric(
                if (format == NumericEntry.Format.NUMBER) {
                    NumericAnswer(number = number.replace(',', '.'))
                } else {
                    NumericAnswer(numerator = numerator, denominator = denominator)
                },
            )
        val next = if (candidate.isComplete(question)) candidate else Response.Options()
        emitted = next
        onEdit { ResponseChange(next) }
    }
    val errorId = numericDraftError(question, number, numerator, denominator)
    val errorText = errorId?.let { stringResource(it) }
    val correct = response.isCorrect(question)
    val feedbackColor =
        if (revealed && !response.isEmpty) {
            if (correct) {
                Gp.colors.right
            } else {
                Gp.colors.wrong
            }
        } else {
            null
        }
    val mark =
        if (feedbackColor !=
            null
        ) {
            stringResource(if (correct) R.string.question_correct_mark else R.string.question_yours_mark)
        } else {
            null
        }
    val denominatorFocus = remember { FocusRequester() }
    val focus = LocalFocusManager.current
    if (!revealed) {
        Text(
            stringResource(if (format == NumericEntry.Format.NUMBER) R.string.question_enter_number else R.string.question_enter_fraction),
            style = Gp.type.meta,
            color = Gp.colors.text2,
        )
    }
    PlainPrompt(question)
    Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s12), modifier = Modifier.fillMaxWidth()) {
        Column(
            Modifier.widthIn(max = minOf(GpLayout.textMax, GpSize.button * 3 * LocalDensity.current.fontScale.coerceAtLeast(1f))),
            verticalArrangement = Arrangement.spacedBy(GpSpace.s8),
        ) {
            if (format == NumericEntry.Format.NUMBER) {
                NumericField(
                    number,
                    { next ->
                        if (allowsNumericEdit(number, next, integer = false)) {
                            number = next
                            publish()
                        }
                    },
                    stringResource(R.string.numeric_answer),
                    "numeric.number",
                    KeyboardType.Decimal,
                    revealed,
                    errorText,
                    onDone = { focus.clearFocus() },
                    feedbackColor = feedbackColor,
                    mark = mark,
                )
            } else {
                NumericField(
                    numerator,
                    { next ->
                        if (allowsNumericEdit(numerator, next, integer = true)) {
                            numerator = next
                            publish()
                        }
                    },
                    stringResource(R.string.numeric_numerator),
                    "numeric.numerator",
                    KeyboardType.Number,
                    revealed,
                    errorText,
                    imeAction = ImeAction.Next,
                    onNext = { denominatorFocus.requestFocus() },
                    feedbackColor = feedbackColor,
                    mark = mark,
                )
                Box(Modifier.fillMaxWidth().height(GpSpace.s2).background(Gp.colors.text))
                NumericField(
                    denominator,
                    { next ->
                        if (allowsNumericEdit(denominator, next, integer = true)) {
                            denominator = next
                            publish()
                        }
                    },
                    stringResource(R.string.numeric_denominator),
                    "numeric.denominator",
                    KeyboardType.Number,
                    revealed,
                    errorText,
                    Modifier.focusRequester(denominatorFocus),
                    onDone = { focus.clearFocus() },
                    feedbackColor = feedbackColor,
                    mark = mark,
                )
            }
        }
        if (errorText != null && !revealed) {
            Text(
                errorText,
                color = Gp.colors.wrong,
                style = Gp.type.meta,
                modifier = Modifier.testTag("numeric.error").semantics { liveRegion = LiveRegionMode.Polite },
            )
        } else if (format == NumericEntry.Format.FRACTION && !revealed) {
            Text(stringResource(R.string.numeric_fraction_hint), color = Gp.colors.text2, style = Gp.type.caption)
        }
    }
}

@Composable
private fun NumericField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    tag: String,
    keyboard: KeyboardType,
    readOnly: Boolean,
    errorText: String?,
    modifier: Modifier = Modifier,
    imeAction: ImeAction = ImeAction.Done,
    onNext: () -> Unit = {},
    onDone: () -> Unit = {},
    feedbackColor: Color? = null,
    mark: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s4)) {
        // Подпись над полем может переноситься при 200%: плавающая Material-подпись обрезалась бы.
        Text(if (mark == null) label else "$label · $mark", style = Gp.type.meta, color = feedbackColor ?: Gp.colors.text2)
        OutlinedTextField(
            value,
            onValueChange,
            modifier =
                modifier.fillMaxWidth().testTag(tag).semantics {
                    contentDescription = label
                    if (errorText != null) error(errorText)
                    if (mark != null) stateDescription = mark
                },
            readOnly = readOnly,
            singleLine = true,
            isError = errorText != null,
            textStyle = Gp.type.sessionCount.copy(fontFamily = MathFamily, textAlign = TextAlign.Center),
            keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = imeAction),
            keyboardActions = KeyboardActions(onNext = { onNext() }, onDone = { onDone() }),
            shape = RoundedCornerShape(GpRadius.m),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = feedbackColor ?: Gp.colors.text,
                    unfocusedBorderColor = feedbackColor ?: Gp.colors.lineStrong,
                    errorBorderColor = Gp.colors.wrong,
                    errorCursorColor = Gp.colors.wrong,
                    cursorColor = Gp.colors.text,
                    focusedContainerColor = Gp.colors.surface,
                    unfocusedContainerColor = Gp.colors.surface,
                    errorContainerColor = Gp.colors.surface,
                ),
        )
    }
}

/** Одиночный набранный символ фильтруется; вставка целиком остаётся видна с объяснением ошибки. */
internal fun allowsNumericEdit(
    before: String,
    after: String,
    integer: Boolean,
): Boolean {
    val prefix = before.commonPrefixWith(after).length
    val suffix = before.drop(prefix).commonSuffixWith(after.drop(prefix)).length
    val inserted = after.substring(prefix, after.length - suffix)
    return inserted.length != 1 || (if (integer) INTEGER_DRAFT else NUMBER_DRAFT).matches(after)
}

internal fun numericDraftError(
    question: Question,
    number: String,
    numerator: String,
    denominator: String,
): Int? =
    if (question.numericEntry?.format == NumericEntry.Format.NUMBER) {
        if (number in listOf("", "-", ".", ",", "-.", "-,") ||
            Response.Numeric(NumericAnswer(number = number.replace(',', '.'))).isComplete(question)
        ) {
            null
        } else {
            R.string.numeric_invalid_number
        }
    } else {
        when {
            listOf(numerator, denominator).any { it != "" && it != "-" && !NumericResponseComponent.validInteger(it) } -> {
                R.string.numeric_invalid_integer
            }

            NumericResponseComponent.zeroInteger(denominator) -> {
                R.string.numeric_zero_denominator
            }

            else -> {
                null
            }
        }
    }

private val NUMBER_DRAFT = Regex("-?[0-9]*(?:[.,][0-9]*)?")
private val INTEGER_DRAFT = Regex("-?[0-9]*")
