package dev.greprepapp.app.feature.training

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import dev.greprepapp.api.models.Question
import dev.greprepapp.api.models.QuestionType
import greprep.design.GpSize

/** Компонент получает весь ответ и применяет правку к свежему состоянию сессии. */
@Composable
internal fun QuestionContent(
    question: Question,
    response: Response,
    revealed: Boolean,
    onEditResponse: (ResponseEdit) -> Unit = {},
    selectionLimitHit: Boolean = false,
    includePassage: Boolean = true,
) = when (question.questionType) {
    QuestionType.TEXT_COMPLETION -> {
        CompletionResponse(question, response, revealed, onEditResponse, selectionLimitHit)
    }

    QuestionType.SENTENCE_EQUIVALENCE -> {
        EquivalenceResponse(question, response, revealed, onEditResponse, selectionLimitHit)
    }

    QuestionType.QUANTITATIVE_COMPARISON -> {
        ComparisonResponse(question, response, revealed, onEditResponse, selectionLimitHit)
    }

    QuestionType.MULTIPLE_CHOICE, QuestionType.MULTIPLE_CHOICE_MULTI -> {
        if (includePassage) question.passage?.let { PassageText(it) }
        SingleChoiceResponse(question, response, revealed, onEditResponse, selectionLimitHit)
    }

    QuestionType.NUMERIC_ENTRY -> {
        NumericResponse(question, response, revealed, onEditResponse)
    }

    QuestionType.SELECT_IN_PASSAGE -> {
        SentenceResponse(question, response, revealed, onEditResponse)
    }
}

private fun Response.options(): List<String> = (this as? Response.Options)?.ids ?: error("Unsupported response for option component")

@Composable
private fun CompletionResponse(
    question: Question,
    response: Response,
    revealed: Boolean,
    onEdit: (ResponseEdit) -> Unit,
    limitHit: Boolean,
) {
    if (!revealed) SelectionInstruction(question, limitHit)
    PromptText(question, response.options(), revealed = revealed)
    AnswerOptions(question, response, revealed, onEdit)
}

@Composable
private fun EquivalenceResponse(
    question: Question,
    response: Response,
    revealed: Boolean,
    onEdit: (ResponseEdit) -> Unit,
    limitHit: Boolean,
) {
    if (!revealed) SelectionInstruction(question, limitHit)
    PromptText(question, response.options(), revealed = revealed)
    AnswerOptions(question, response, revealed, onEdit)
}

@Composable
private fun ComparisonResponse(
    question: Question,
    response: Response,
    revealed: Boolean,
    onEdit: (ResponseEdit) -> Unit,
    limitHit: Boolean,
) {
    if (!revealed) SelectionInstruction(question, limitHit)
    Quantities(question)
    AnswerOptions(question, response, revealed, onEdit)
}

@Composable
private fun SingleChoiceResponse(
    question: Question,
    response: Response,
    revealed: Boolean,
    onEdit: (ResponseEdit) -> Unit,
    limitHit: Boolean,
) {
    if (!revealed) SelectionInstruction(question, limitHit)
    PlainPrompt(question)
    AnswerOptions(question, response, revealed, onEdit)
}

@Composable
private fun SelectionInstruction(
    question: Question,
    limitHit: Boolean,
) {
    androidx.compose.material3.Text(
        if (question.questionType == QuestionType.MULTIPLE_CHOICE_MULTI && limitHit) {
            androidx.compose.ui.res
                .stringResource(dev.greprepapp.app.R.string.question_multi_limit)
        } else if (question.questionType == QuestionType.MULTIPLE_CHOICE_MULTI && question.selectCount > 0) {
            androidx.compose.ui.res.pluralStringResource(
                dev.greprepapp.app.R.plurals.question_select_choices,
                question.selectCount,
                question.selectCount,
            )
        } else {
            androidx.compose.ui.res.stringResource(
                when {
                    limitHit -> {
                        dev.greprepapp.app.R.string.question_selection_limit
                    }

                    question.questionType == QuestionType.MULTIPLE_CHOICE_MULTI && question.selectCount == 0 -> {
                        dev.greprepapp.app.R.string.question_select_all
                    }

                    question.selectCount > 1 -> {
                        dev.greprepapp.app.R.string.question_select_two
                    }

                    question.groups.size > 1 -> {
                        dev.greprepapp.app.R.string.question_select_blanks
                    }

                    else -> {
                        dev.greprepapp.app.R.string.question_select_one
                    }
                },
            )
        },
        style = dev.greprepapp.design.Gp.type.meta,
        color = if (limitHit) dev.greprepapp.design.Gp.colors.wrong else dev.greprepapp.design.Gp.colors.text2,
        modifier = Modifier.testTag("question.instruction").semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite },
    )
}

@Composable
private fun AnswerOptions(
    question: Question,
    response: Response,
    revealed: Boolean,
    onEdit: (ResponseEdit) -> Unit,
) {
    if (revealed) {
        RevealedOptions(question, response.options())
    } else {
        ChoosableOptions(question, response.options()) { id -> onEdit { current -> current.toggle(question, id) } }
    }
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
