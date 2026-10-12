package dev.greprepapp.app.feature.training

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import dev.greprepapp.api.models.Question
import dev.greprepapp.api.models.QuestionType
import greprep.design.GpSize

/** Сессия знает только выбор и переходы; новый тип получает собственный компонент здесь. */
@Composable
internal fun QuestionContent(
    question: Question,
    selection: List<String>,
    revealed: Boolean,
    onSelect: (String) -> Unit = {},
) {
    when (question.questionType) {
        QuestionType.TEXT_COMPLETION -> CompletionResponse(question, selection, revealed, onSelect)
        QuestionType.SENTENCE_EQUIVALENCE -> EquivalenceResponse(question, selection, revealed, onSelect)
        QuestionType.QUANTITATIVE_COMPARISON -> ComparisonResponse(question, selection, revealed, onSelect)
        QuestionType.MULTIPLE_CHOICE -> SingleChoiceResponse(question, selection, revealed, onSelect)
    }
}

@Composable
private fun CompletionResponse(
    question: Question,
    selection: List<String>,
    revealed: Boolean,
    onSelect: (String) -> Unit,
) {
    PromptText(question, if (revealed && selection.isEmpty()) question.answer else selection)
    AnswerOptions(question, selection, revealed, onSelect)
}

@Composable
private fun EquivalenceResponse(
    question: Question,
    selection: List<String>,
    revealed: Boolean,
    onSelect: (String) -> Unit,
) {
    PromptText(question, if (revealed && selection.isEmpty()) question.answer else selection)
    AnswerOptions(question, selection, revealed, onSelect)
}

@Composable
private fun ComparisonResponse(
    question: Question,
    selection: List<String>,
    revealed: Boolean,
    onSelect: (String) -> Unit,
) {
    Quantities(question)
    AnswerOptions(question, selection, revealed, onSelect)
}

@Composable
private fun SingleChoiceResponse(
    question: Question,
    selection: List<String>,
    revealed: Boolean,
    onSelect: (String) -> Unit,
) {
    PlainPrompt(question)
    AnswerOptions(question, selection, revealed, onSelect)
}

@Composable
private fun AnswerOptions(
    question: Question,
    selection: List<String>,
    revealed: Boolean,
    onSelect: (String) -> Unit,
) {
    if (revealed) RevealedOptions(question, selection) else ChoosableOptions(question, selection, onSelect)
}

/** Горизонтальный жест имеет те же переходы, что кнопки; вертикальная прокрутка остаётся списку. */
internal fun Modifier.reviewSwipe(
    onNext: () -> Unit,
    onPrevious: () -> Unit,
): Modifier =
    pointerInput(onNext, onPrevious) {
        var distance = 0f
        val threshold = GpSize.button.toPx()
        detectHorizontalDragGestures(
            onDragStart = { distance = 0f },
            onHorizontalDrag = { _, amount -> distance += amount },
            onDragEnd = {
                if (distance < -threshold) {
                    onNext()
                } else if (distance > threshold) {
                    onPrevious()
                }
            },
        )
    }
