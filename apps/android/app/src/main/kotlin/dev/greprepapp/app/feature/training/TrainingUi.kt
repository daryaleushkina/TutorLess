package dev.greprepapp.app.feature.training

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.greprepapp.api.models.LocalizedText
import dev.greprepapp.api.models.Question
import dev.greprepapp.api.models.QuestionOption
import dev.greprepapp.api.models.QuestionType
import dev.greprepapp.api.models.Section
import dev.greprepapp.app.R
import dev.greprepapp.design.Gp
import dev.greprepapp.design.StudySection
import dev.greprepapp.design.pressScale
import greprep.design.GpRadius
import greprep.design.GpSize
import greprep.design.GpSpace

/** Текст задания и вариантов — английский: TalkBack читает его английским голосом. */
internal val English = LocaleList("en")

/** Пропуск в тексте задания (договор, Question.prompt). */
internal const val BLANK = "___"

/** Пустой пропуск в строке: четыре широких пробела, подчёркнутых, — видно место под слово. */
private const val BLANK_GAP = "    "

/** Римские номера пропусков, как в GRE: (i), (ii), (iii). */
internal val BLANK_NUMBERS = listOf("(i)", "(ii)", "(iii)")

fun Section.study(): StudySection = if (this == Section.QUANT) StudySection.Quant else StudySection.Verbal

@Composable
@ReadOnlyComposable
fun QuestionType.label(): String =
    stringResource(
        when (this) {
            QuestionType.TEXT_COMPLETION -> R.string.type_text_completion
            QuestionType.SENTENCE_EQUIVALENCE -> R.string.type_sentence_equivalence
            QuestionType.QUANTITATIVE_COMPARISON -> R.string.type_quantitative_comparison
            QuestionType.MULTIPLE_CHOICE -> R.string.type_multiple_choice
            QuestionType.MULTIPLE_CHOICE_MULTI -> R.string.type_multiple_choice_multi
            QuestionType.NUMERIC_ENTRY -> R.string.type_numeric_entry
            QuestionType.SELECT_IN_PASSAGE -> R.string.type_select_in_passage
        },
    )

/** «Text Completion · три пропуска», «Sentence Equivalence · два ответа» — над заданием (макеты R5, R6). */
@Composable
@ReadOnlyComposable
fun Question.typeLabel(): String {
    if (passage != null) return stringResource(R.string.type_reading_comprehension)
    if (numericEntry?.format == dev.greprepapp.api.models.NumericEntry.Format.FRACTION) return stringResource(R.string.type_fraction_entry)
    val note =
        when {
            questionType == QuestionType.TEXT_COMPLETION && groups.size == 2 -> R.string.type_two_blanks
            questionType == QuestionType.TEXT_COMPLETION && groups.size == 3 -> R.string.type_three_blanks
            questionType == QuestionType.SENTENCE_EQUIVALENCE -> R.string.type_two_answers
            else -> null
        } ?: return questionType.label()
    return stringResource(R.string.type_with_note, questionType.label(), stringResource(note))
}

fun LocalizedText.pick(english: Boolean): String = if (english) en else ru

/** Разметка разборов: *слово* — курсивом (английские слова в русском тексте, договор Explanation). */
fun richText(text: String): AnnotatedString =
    buildAnnotatedString {
        var rest = text
        while (true) {
            val start = rest.indexOf('*')
            val end = if (start >= 0) rest.indexOf('*', start + 1) else -1
            if (start < 0 || end < 0) {
                append(rest)
                break
            }
            append(rest.substring(0, start))
            withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(rest.substring(start + 1, end)) }
            rest = rest.substring(end + 1)
        }
    }

/** Отдельные латинские переменные курсивом; слова условия и числа остаются прямыми. */
internal fun mathText(value: String): AnnotatedString =
    buildAnnotatedString {
        append(value)
        Regex("(?<![A-Za-z])[A-Za-z](?![A-Za-z])").findAll(value).forEach {
            addStyle(
                SpanStyle(fontStyle = FontStyle.Italic, fontFamily = dev.greprepapp.design.MathFamily),
                it.range.first,
                it.range.last + 1,
            )
        }
    }

/** Как вариант отмечен на экране. */
enum class OptionMark { None, Selected, Correct, Wrong }

/**
 * Вариант ответа (компонент answer-option): строка на плотной поверхности; выбранный — спокойная подложка и
 * обводка цветом текста; после проверки — «верный» цветом right с галочкой и «ваш ответ» оранжевым с крестиком (DESIGN.md,
 * «Правило двух цветов ответа»).
 */
@Composable
fun OptionRow(
    option: QuestionOption,
    mark: OptionMark,
    modifier: Modifier = Modifier,
    chosen: Boolean = true,
    multiple: Boolean = false,
    onClick: (() -> Unit)? = null,
) {
    val colors = Gp.colors
    val selectionColor = colors.text
    val container =
        when (mark) {
            OptionMark.Selected -> colors.surface2
            OptionMark.Correct -> colors.rightSoft
            OptionMark.Wrong -> colors.wrongSoft
            else -> colors.surface
        }
    val interaction = remember { MutableInteractionSource() }
    val markText =
        when (mark) {
            OptionMark.Correct -> stringResource(R.string.question_correct_mark)
            OptionMark.Wrong -> stringResource(R.string.question_yours_mark)
            else -> null
        }
    val clickable =
        if (onClick != null) {
            Modifier.pressScale(interaction).then(
                if (multiple) {
                    Modifier.toggleable(
                        value = mark == OptionMark.Selected,
                        interactionSource = interaction,
                        indication = ripple(),
                        role = Role.Checkbox,
                        onValueChange = { onClick() },
                    )
                } else {
                    Modifier.selectable(
                        selected = mark == OptionMark.Selected,
                        interactionSource = interaction,
                        indication = ripple(),
                        role = Role.RadioButton,
                        onClick = onClick,
                    )
                },
            )
        } else {
            Modifier.semantics(mergeDescendants = true) { if (markText != null) stateDescription = markText }
        }
    Surface(
        color = container,
        shape = RoundedCornerShape(GpRadius.m),
        border =
            when (mark) {
                OptionMark.Selected -> BorderStroke(GpSize.hairline, selectionColor)
                OptionMark.Correct -> if (chosen) BorderStroke(GpSize.hairline, colors.right) else null
                OptionMark.Wrong -> BorderStroke(GpSize.hairline, colors.wrong)
                else -> null
            },
        modifier =
            modifier
                .fillMaxWidth()
                .then(clickable)
                .then(if (mark == OptionMark.Correct && !chosen) Modifier.dashedOutline(colors.right, GpRadius.m) else Modifier)
                .testTag("option.${option.id}"),
    ) {
        Row(
            modifier = Modifier.heightIn(min = GpSize.opt).padding(horizontal = GpSpace.s12, vertical = GpSpace.s8),
            horizontalArrangement = Arrangement.spacedBy(GpSpace.s12),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val checked = mark == OptionMark.Selected || (mark in listOf(OptionMark.Correct, OptionMark.Wrong) && chosen)
            if (multiple) {
                Checkbox(
                    checked = checked,
                    onCheckedChange = null,
                    colors = CheckboxDefaults.colors(checkedColor = colors.text, checkmarkColor = colors.bg, uncheckedColor = colors.text3),
                )
            } else {
                RadioButton(
                    selected = checked,
                    onClick = null,
                    colors = RadioButtonDefaults.colors(selectedColor = colors.text, unselectedColor = colors.text3),
                )
            }
            Text(
                text = option.text,
                style =
                    Gp.type.opt.copy(localeList = English),
                color = colors.text,
                modifier = Modifier.weight(1f),
            )
            if (markText != null) {
                val markColor = if (mark == OptionMark.Correct) colors.right else colors.wrong
                Text(text = markText, style = Gp.type.meta, color = markColor)
                MarkDot(correct = mark == OptionMark.Correct, color = markColor)
            }
        }
    }
}

/** Галочка или крестик в кружке — верно или неверно. */
@Composable
fun MarkDot(
    correct: Boolean,
    color: Color,
    modifier: Modifier = Modifier,
    size: Dp = GpSpace.s20,
) {
    Box(
        modifier = modifier.size(size).background(color, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(if (correct) R.drawable.ic_check else R.drawable.ic_close),
            contentDescription = null,
            tint = Gp.colors.surface,
            modifier = Modifier.size(size * 2 / 3),
        )
    }
}

/**
 * Текст задания с пропусками. Где пропусков несколько, выбранное слово сразу встаёт в свой пропуск — фраза
 * читается целиком (макет R5); выбранное слово видно и у одного пропуска.
 */
@Composable
fun PromptText(
    question: Question,
    selection: List<String>,
    modifier: Modifier = Modifier,
    revealed: Boolean = false,
) {
    val colors = Gp.colors
    val selectionColor = colors.text
    val blank = stringResource(R.string.question_blank)
    val parts = question.prompt.split(BLANK)
    val many = question.groups.size > 1
    val text =
        buildAnnotatedString {
            parts.forEachIndexed { i, part ->
                append(part)
                if (i == parts.lastIndex) return@forEachIndexed
                if (many) {
                    withStyle(SpanStyle(fontSize = Gp.type.caption.fontSize, color = colors.text2)) {
                        append(BLANK_NUMBERS.getOrElse(i) { "" })
                    }
                }
                val chosen =
                    question.groups
                        .getOrNull(i)
                        ?.options
                        ?.firstOrNull { it.id in selection }
                if (chosen != null) {
                    withStyle(
                        SpanStyle(
                            color =
                                if (!revealed) {
                                    selectionColor
                                } else if (chosen.id in question.answer) {
                                    colors.right
                                } else {
                                    colors.wrong
                                },
                            background =
                                if (!revealed) {
                                    androidx.compose.ui.graphics.Color.Transparent
                                } else if (chosen.id in
                                    question.answer
                                ) {
                                    colors.rightSoft
                                } else {
                                    colors.wrongSoft
                                },
                            textDecoration = if (revealed && chosen.id !in question.answer) TextDecoration.LineThrough else null,
                            fontWeight = Gp.type.opt.fontWeight,
                        ),
                    ) { append(chosen.text) }
                } else {
                    withStyle(SpanStyle(textDecoration = TextDecoration.Underline, color = colors.text2)) { append(BLANK_GAP) }
                }
            }
        }
    // Для TalkBack пропуск — словом, а не пробелами.
    val spoken =
        parts.foldIndexed("") { i, acc, part ->
            val chosen =
                question.groups
                    .getOrNull(i)
                    ?.options
                    ?.firstOrNull { it.id in selection }
                    ?.let { option ->
                        option.text +
                            if (revealed) {
                                ", " +
                                    stringResource(
                                        if (option.id in
                                            question.answer
                                        ) {
                                            R.string.review_correct
                                        } else {
                                            R.string.review_wrong
                                        },
                                    )
                            } else {
                                ""
                            }
                    }
            acc + part + if (i < parts.lastIndex) " ${chosen ?: blank} " else ""
        }
    Text(
        text = text,
        style = (if (Gp.isWide) Gp.type.qTextWide else Gp.type.qText).copy(localeList = English),
        color = colors.text,
        modifier = modifier.fillMaxWidth().semantics { contentDescription = spoken }.testTag("question.prompt"),
    )
}

/**
 * Разбор после ответа (макет R4): узел-вердикт на нити слева, одна фраза «Верно» или «Неверно. Верный ответ —
 * equivocal», объяснение ключа; второй уровень — «Почему не …?» по нажатию; язык — переключатель RU/EN рядом
 * (PRODUCT.md, «Разбор ошибок»).
 */
@Composable
fun ExplanationPanel(
    question: Question,
    answer: RecordedAnswer?,
    english: Boolean,
    whyNotOpen: Boolean,
    onLanguage: (Boolean) -> Unit,
    onToggleWhyNot: () -> Unit,
    modifier: Modifier = Modifier,
    onTopic: (() -> Unit)? = null,
    topicStarting: Boolean = false,
) {
    val colors = Gp.colors
    val chosen = answer?.optionIds.orEmpty()
    val wrongChosen = chosen.filterNot { it in question.answer }
    val whyNot = question.explanation.options.filter { it.optionId in wrongChosen }
    Column(modifier = modifier.fillMaxWidth().testTag("explanation"), verticalArrangement = Arrangement.spacedBy(GpSpace.s16)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.explanation_title), style = Gp.type.h2, modifier = Modifier.weight(1f))
            LanguageSwitch(english = english, onChange = onLanguage)
        }
        Text(
            text = richText(question.explanation.solution.pick(english)),
            style = Gp.type.explainBody.withLanguage(english),
            color = colors.text,
            modifier = Modifier.testTag("explanation.solution"),
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(GpSpace.s8),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (whyNot.isNotEmpty()) {
                WhyNotChip(
                    text = whyNotLabel(question, wrongChosen, english),
                    open = whyNotOpen,
                    onClick = onToggleWhyNot,
                    modifier = Modifier.weight(1f, fill = false),
                )
            }
        }
        if (whyNotOpen) {
            whyNot.forEach { item ->
                Surface(
                    color = colors.surface,
                    shape = RoundedCornerShape(GpRadius.l),
                    modifier = Modifier.fillMaxWidth().testTag("explanation.whyNot"),
                ) {
                    Text(
                        text = richText(item.text.pick(english)),
                        style = Gp.type.meta.withLanguage(english),
                        color = colors.text,
                        modifier = Modifier.padding(GpSpace.s16),
                    )
                }
            }
        }
        val topicText = stringResource(R.string.question_topic, question.topicTitle.pick(english))
        if (onTopic == null) {
            Text(topicText, style = Gp.type.action, modifier = Modifier.testTag("question.topic"))
        } else {
            LinkText(topicText, onTopic, Modifier.testTag("question.topic"), enabled = !topicStarting)
        }
    }
}

@Composable
fun AnswerVerdict(
    question: Question,
    answer: RecordedAnswer?,
    english: Boolean,
    modifier: Modifier = Modifier,
) {
    val correct = answer?.response?.let { it.isCorrect(question) } == true
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(GpSpace.s12), verticalAlignment = Alignment.CenterVertically) {
        if (answer?.dontKnow == true) {
            Icon(painterResource(R.drawable.ic_tab_words), null, tint = Gp.colors.text2)
        } else {
            MarkDot(correct, if (correct) Gp.colors.right else Gp.colors.wrong)
        }
        Text(
            text =
                if (answer?.dontKnow == true) {
                    buildAnnotatedString { append(stringResource(R.string.verdict_dont_know)) }
                } else {
                    verdict(question, correct, answer?.response?.isEmpty != false, english)
                },
            style = Gp.type.body,
            color = Gp.colors.text,
            modifier = Modifier.testTag("explanation.verdict"),
        )
    }
}

private fun TextStyle.withLanguage(english: Boolean): TextStyle = if (english) copy(localeList = English) else this

/** «Неверно. Верный ответ — equivocal.» на языке разбора. */
@Composable
private fun verdict(
    question: Question,
    correct: Boolean,
    unanswered: Boolean,
    english: Boolean,
): AnnotatedString {
    val lead =
        when {
            correct -> stringResource(if (english) R.string.verdict_correct_en else R.string.verdict_correct_ru)
            unanswered -> null
            else -> stringResource(if (english) R.string.verdict_wrong_en else R.string.verdict_wrong_ru)
        }
    val and = stringResource(if (english) R.string.verdict_and_en else R.string.verdict_and_ru)
    val keys = answerList(question, and)
    val key =
        stringResource(
            when {
                english && question.answer.size > 1 -> R.string.verdict_answers_en
                english -> R.string.verdict_answer_en
                question.answer.size > 1 -> R.string.verdict_answers_ru
                else -> R.string.verdict_answer_ru
            },
            keys,
        )
    return buildAnnotatedString {
        if (lead != null) {
            withStyle(SpanStyle(fontWeight = Gp.type.sectionName.fontWeight)) { append(lead) }
        }
        if (!correct) {
            if (lead != null) append(' ')
            append(key)
        }
    }
}

/** «equivocal», «A, intransigent и C, obdurate»; в Text Completion с пропусками — слова по порядку. */
private fun answerList(
    question: Question,
    and: String,
): String {
    if (question.numericAnswer != null) return NumericResponseComponent.keyText(question)
    if (question.questionType == QuestionType.SELECT_IN_PASSAGE) {
        return question.passage
            ?.paragraphs
            ?.flatMap { it.sentences }
            ?.firstOrNull { it.id in question.answer }
            ?.text
            .orEmpty()
    }
    val options = question.groups.flatMap { it.options }.associateBy { it.id }
    val items = question.answer.mapNotNull { id -> options[id]?.text }
    return if (items.size <= 1) items.joinToString() else items.dropLast(1).joinToString(", ") + " $and " + items.last()
}

@Composable
private fun whyNotLabel(
    question: Question,
    wrong: List<String>,
    english: Boolean,
): String {
    val options = question.groups.flatMap { it.options }.associateBy { it.id }
    val words = wrong.mapNotNull { options[it]?.text }.joinToString(", ")
    return stringResource(if (english) R.string.why_not_en else R.string.why_not_ru, words)
}

@Composable
private fun WhyNotChip(
    text: String,
    open: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Gp.colors
    val interaction = remember { MutableInteractionSource() }
    Surface(
        onClick = onClick,
        color = colors.surface2,
        shape = CircleShape,
        interactionSource = interaction,
        modifier =
            modifier
                .heightIn(min = GpSize.tapTarget)
                .pressScale(interaction)
                .testTag("explanation.whyNotToggle"),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = GpSpace.s16),
            horizontalArrangement = Arrangement.spacedBy(GpSpace.s6),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = text,
                style = Gp.type.eyebrow,
                color = colors.text,
                maxLines = 2,
                modifier = Modifier.weight(1f, fill = false),
            )
            Icon(
                painter = painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                tint = colors.text2,
                modifier = Modifier.size(GpSpace.s20).rotate(if (open) HALF_TURN else 0f),
            )
        }
    }
}

/** RU/EN — по сегменту в ширину кнопки: рядом остаётся место для «Почему не …?». */
private val LanguageSwitchWidth = GpSize.button * 2

/** Стрелка «развернуть» вверх, когда второй уровень разбора открыт. */
private const val HALF_TURN = 180f

@Composable
private fun LanguageSwitch(
    english: Boolean,
    onChange: (Boolean) -> Unit,
) {
    val label = stringResource(R.string.explanation_language)
    SegmentedChoice(
        options = listOf(stringResource(R.string.language_ru), stringResource(R.string.language_en)),
        selected = if (english) 1 else 0,
        onSelect = { onChange(it == 1) },
        modifier = Modifier.width(LanguageSwitchWidth).semantics { contentDescription = label }.testTag("explanation.language"),
    )
}

/**
 * Сегменты на surface2: выбранный — surface с текстом text в обеих темах.
 * Капсула без рамок и галочки (DESIGN.md, «Сегменты»).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SegmentedChoice(
    options: List<String>,
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    tags: List<String>? = null,
) {
    ContentChoices(options, selected, onSelect, modifier, tags.orEmpty())
}

/** Ширина каждого выбора следует за текстом, а FlowRow переносит целые кнопки при крупном шрифте. */
@Composable
internal fun ContentChoices(
    options: List<String>,
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    tags: List<String> = emptyList(),
) {
    FlowRow(
        modifier = modifier.background(Gp.colors.surface2, RoundedCornerShape(GpRadius.l)).selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(GpSpace.s4),
        verticalArrangement = Arrangement.spacedBy(GpSpace.s4),
    ) {
        options.forEachIndexed { index, text ->
            val interaction = remember { MutableInteractionSource() }
            Surface(
                color = if (selected == index) Gp.colors.surface else Gp.colors.surface2,
                shape = CircleShape,
                modifier =
                    Modifier
                        .width(IntrinsicSize.Min)
                        .widthIn(min = GpSize.tapTarget)
                        .selectable(
                            selected = selected == index,
                            role = Role.RadioButton,
                            interactionSource = interaction,
                            indication = ripple(),
                            onClick = { onSelect(index) },
                        ).then(tags.getOrNull(index)?.let { Modifier.testTag(it) } ?: Modifier),
            ) {
                Box(
                    Modifier.heightIn(min = GpSize.tapTarget).padding(horizontal = GpSpace.s12, vertical = GpSpace.s8),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text, style = Gp.type.seg, color = Gp.colors.text, softWrap = false)
                }
            }
        }
    }
}

/** Пунктир отличает верный невыбранный ответ и вопрос без ответа без опоры только на цвет. */
internal fun Modifier.dashedOutline(
    color: Color,
    radius: Dp,
): Modifier =
    drawWithContent {
        drawContent()
        val stroke = GpSize.hairline.toPx()
        drawRoundRect(
            color,
            topLeft = Offset(stroke / 2, stroke / 2),
            size = Size(size.width - stroke, size.height - stroke),
            cornerRadius = CornerRadius(radius.toPx()),
            style = Stroke(stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(GpSpace.s4.toPx(), GpSpace.s4.toPx()))),
        )
    }
