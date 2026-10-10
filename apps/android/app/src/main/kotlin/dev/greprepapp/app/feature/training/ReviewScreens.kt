package dev.greprepapp.app.feature.training

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.greprepapp.api.models.QuestionReport
import dev.greprepapp.api.models.QuestionType
import dev.greprepapp.app.R
import dev.greprepapp.app.ui.EmptyState
import dev.greprepapp.app.ui.NestedScreen
import dev.greprepapp.app.ui.label
import dev.greprepapp.design.Gp
import dev.greprepapp.design.GpPrimaryButton
import dev.greprepapp.design.StudySection
import greprep.design.GpLayout
import greprep.design.GpSize
import greprep.design.GpSpace
import kotlinx.coroutines.flow.first

/** Разбор всей тренировки (макет R16): все вопросы или только ошибки; вопрос открывается с разбором. */
@Composable
fun ReviewScreen(
    trainingId: String,
    onBack: () -> Unit,
    onOpen: (Int) -> Unit,
    modifier: Modifier = Modifier,
    onReport: (ReportTarget) -> Unit = {},
    viewModel: ReviewViewModel =
        hiltViewModel<ReviewViewModel, ReviewViewModel.Factory>(key = trainingId) { it.create(trainingId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ReviewContent(state = state, onBack = onBack, onOpen = onOpen, onReport = onReport, modifier = modifier)
}

@Composable
fun ReviewContent(
    state: ReviewViewModel.UiState,
    onBack: () -> Unit,
    onOpen: (Int) -> Unit,
    modifier: Modifier = Modifier,
    onReport: (ReportTarget) -> Unit = {},
) {
    val ready = state as? ReviewViewModel.UiState.Ready
    val title =
        stringResource(if (ready?.training?.isCheck == true) R.string.review_title_check else R.string.review_title_practice)
    NestedScreen(
        title = title,
        onBack = onBack,
        modifier = modifier,
    ) { padding ->
        when (state) {
            ReviewViewModel.UiState.Loading -> Box(Modifier.fillMaxSize())
            ReviewViewModel.UiState.Missing -> MissingTraining(padding, onBack)
            is ReviewViewModel.UiState.Ready -> ReviewPanes(state, padding, onOpen, onReport)
        }
    }
}

@Composable
private fun MissingTraining(
    padding: PaddingValues,
    onBack: () -> Unit,
) {
    EmptyState(
        title = stringResource(R.string.training_missing_title),
        message = stringResource(R.string.training_missing_message),
        action = stringResource(R.string.summary_done),
        onAction = onBack,
        modifier = Modifier.padding(padding).testTag("review.missing"),
    )
}

/** Как ответил человек на вопрос: верно, неверно или без ответа. */
private enum class Outcome { Correct, Wrong, Unanswered }

private fun outcome(
    training: StoredTraining,
    position: Int,
): Outcome {
    val chosen = training.answer(position)?.optionIds.orEmpty()
    return when {
        chosen.isEmpty() -> Outcome.Unanswered
        TrainingRules.isCorrect(training.question(position), chosen) -> Outcome.Correct
        else -> Outcome.Wrong
    }
}

@Composable
private fun ReviewPanes(
    state: ReviewViewModel.UiState.Ready,
    padding: PaddingValues,
    onOpen: (Int) -> Unit,
    onReport: (ReportTarget) -> Unit,
) {
    var onlyMistakes by rememberSaveable(state.training.id) { mutableStateOf(false) }
    var selected by rememberSaveable(state.training.id) { mutableStateOf(0) }
    val shown =
        state.training.session.items
            .filter { !onlyMistakes || outcome(state.training, it.position) != Outcome.Correct }
    val position = selected.takeIf { chosen -> shown.any { it.position == chosen } } ?: shown.firstOrNull()?.position
    val wide = Gp.isWide
    TrainingKeyboard(onKey = { key ->
        val index = shown.indexOfFirst { it.position == position }
        when {
            wide && position != null && (key == Key.DirectionUp || key == Key.DirectionDown) -> {
                selected = shown[(index + if (key == Key.DirectionDown) 1 else -1).coerceIn(0, shown.lastIndex)].position
                true
            }

            else -> {
                false
            }
        }
    }) {
        val list: @Composable () -> Unit = {
            ReviewList(
                state,
                if (wide) PaddingValues() else padding,
                onlyMistakes,
                { onlyMistakes = it },
                position,
                { if (wide) selected = it else onOpen(it) },
                wide,
            )
        }
        if (wide) {
            TrainingSplit(padding, "review", left = list, right = {
                if (position != null) ReviewQuestion(state.training, position, { onReport(state.training.reportTarget(position)) })
            }, leftScrollable = false)
        } else {
            list()
        }
    }
}

@Composable
private fun ReviewList(
    state: ReviewViewModel.UiState.Ready,
    padding: PaddingValues,
    onlyMistakes: Boolean,
    onFilter: (Boolean) -> Unit,
    selected: Int?,
    onOpen: (Int) -> Unit,
    wide: Boolean,
) {
    val training = state.training
    val result = state.result
    val mistakes = training.session.items.filter { outcome(training, it.position) != Outcome.Correct }
    val shown = if (onlyMistakes) mistakes else training.session.items
    val english = LocalConfiguration.current.locales[0].language == "en"
    val scroll = rememberLazyListState()
    LaunchedEffect(selected, onlyMistakes, wide) {
        // На телефоне rememberLazyListState восстанавливает позицию после возврата из вопроса.
        if (wide) {
            val index = shown.indexOfFirst { it.position == selected }
            if (index >= 0) revealReviewRow(scroll, index + 1, shown.size + 1)
        }
    }
    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
        LazyColumn(
            state = scroll,
            modifier = Modifier.widthIn(max = GpLayout.contentMax + GpLayout.gutter * 2).fillMaxWidth().testTag("review.list"),
            contentPadding = PaddingValues(horizontal = GpLayout.gutter, vertical = GpSpace.s8),
            verticalArrangement = Arrangement.spacedBy(GpSpace.s4),
        ) {
            item(key = "head") {
                Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s16), modifier = Modifier.padding(bottom = GpSpace.s12)) {
                    val numberStyle = (if (wide) Gp.type.numMWide else Gp.type.numL).toSpanStyle().merge(SpanStyle(color = Gp.colors.text))
                    val scoreLabel = pluralStringResource(R.plurals.summary_correct_of, result.total, result.total)
                    Text(
                        text =
                            buildAnnotatedString {
                                withStyle(numberStyle) {
                                    append(result.correct.toString())
                                }
                                append(" ")
                                append(scoreLabel)
                            },
                        style = Gp.type.numLabel.copy(fontFeatureSettings = "tnum"),
                        color = Gp.colors.text2,
                    )
                    SegmentedChoice(
                        options =
                            listOf(
                                stringResource(R.string.review_all, training.total),
                                stringResource(R.string.review_mistakes, mistakes.size),
                            ),
                        selected = if (onlyMistakes) 1 else 0,
                        onSelect = { onFilter(it == 1) },
                        tags = listOf("review.filter.all", "review.filter.mistakes"),
                    )
                    if (wide) KeyHint("↑ / ↓", stringResource(R.string.keyboard_review))
                }
            }
            if (shown.isEmpty()) {
                item(key = "none") { Text(stringResource(R.string.review_no_mistakes), style = Gp.type.body, color = Gp.colors.text) }
            }
            items(shown, key = { it.position }) { item ->
                ReviewRow(
                    selected = wide && item.position == selected,
                    number = item.position + 1,
                    type = item.question.questionType,
                    topic = item.question.topicTitle.pick(english),
                    outcome = outcome(training, item.position),
                    onClick = { onOpen(item.position) },
                )
            }
        }
    }
}

/** Видимая строка остаётся на месте; частично скрытую сдвигаем ровно на недостающую высоту. */
internal suspend fun revealReviewRow(
    scroll: LazyListState,
    index: Int,
    itemCount: Int,
) {
    val layout = snapshotFlow { scroll.layoutInfo }.first { it.totalItemsCount == itemCount && it.visibleItemsInfo.isNotEmpty() }
    val item = layout.visibleItemsInfo.firstOrNull { it.index == index }
    if (item == null) {
        val below = index > layout.visibleItemsInfo.last().index
        val height =
            layout.visibleItemsInfo
                .last()
                .size
                .coerceAtLeast(1)
        val offset = if (below) -(layout.viewportEndOffset - height).coerceAtLeast(0) else 0
        scroll.scrollToItem(index, offset)
        // Высота новой строки может отличаться: после измерения подводим её точно к ближайшему краю.
        val measured = snapshotFlow { scroll.layoutInfo }.first { it.visibleItemsInfo.any { row -> row.index == index } }
        val row = measured.visibleItemsInfo.first { it.index == index }
        val delta = if (below) row.offset + row.size - measured.viewportEndOffset else row.offset - measured.viewportStartOffset
        if (delta != 0) scroll.scrollBy(delta.toFloat())
        return
    }
    val delta =
        when {
            item.offset < layout.viewportStartOffset -> item.offset - layout.viewportStartOffset
            item.offset + item.size > layout.viewportEndOffset -> item.offset + item.size - layout.viewportEndOffset
            else -> 0
        }
    if (delta != 0) scroll.scrollBy(delta.toFloat())
}

@Composable
private fun ReviewRow(
    selected: Boolean,
    number: Int,
    type: QuestionType,
    topic: String,
    outcome: Outcome,
    onClick: () -> Unit,
) {
    val colors = Gp.colors
    val state =
        stringResource(
            when (outcome) {
                Outcome.Correct -> R.string.review_correct
                Outcome.Wrong -> R.string.review_wrong
                Outcome.Unanswered -> R.string.review_unanswered
            },
        )
    val typeLabel = type.label()
    val description = "${stringResource(R.string.review_question, number)}, $state, $typeLabel, $topic"
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(if (selected) colors.accentSoft else androidx.compose.ui.graphics.Color.Transparent)
                .clickable(role = Role.Button, onClick = onClick)
                .heightIn(min = GpSize.opt)
                .padding(vertical = GpSpace.s8)
                .semantics(mergeDescendants = true) { contentDescription = description }
                .testTag("review.item.${number - 1}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(GpSpace.s14),
    ) {
        val (bg, fg) =
            when (outcome) {
                Outcome.Correct -> colors.rightSoft to colors.right
                Outcome.Wrong -> colors.wrongSoft to colors.wrong
                Outcome.Unanswered -> colors.surface to colors.text2
            }
        Box(
            modifier =
                Modifier
                    .size(GpSize.icon)
                    .background(bg, CircleShape)
                    .then(if (outcome == Outcome.Unanswered) Modifier.border(GpSize.hairline, colors.line, CircleShape) else Modifier),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = number.toString(), style = Gp.type.seg, color = fg)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(GpSpace.s2)) {
            Text(text = typeLabel, style = Gp.type.answer.copy(localeList = English), color = colors.text)
            Text(text = topic, style = Gp.type.meta, color = colors.text2)
        }
        Icon(
            painter = painterResource(R.drawable.ic_chevron_right),
            contentDescription = null,
            tint = colors.text2,
            modifier = Modifier.size(GpSpace.s20),
        )
    }
}

/** Один вопрос с разбором — из итога тренировки; можно сообщить об ошибке. */
@Composable
fun ReviewItemScreen(
    trainingId: String,
    position: Int,
    onBack: () -> Unit,
    onReport: (ReportTarget) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ReviewViewModel =
        hiltViewModel<ReviewViewModel, ReviewViewModel.Factory>(key = trainingId) { it.create(trainingId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ReviewItemContent(
        state = state,
        position = position,
        onBack = onBack,
        onReport = { (state as? ReviewViewModel.UiState.Ready)?.training?.let { onReport(it.reportTarget(position)) } },
        modifier = modifier,
    )
}

@Composable
fun ReviewItemContent(
    state: ReviewViewModel.UiState,
    position: Int,
    onBack: () -> Unit,
    onReport: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val systemEnglish = LocalConfiguration.current.locales[0].language == "en"
    var english by rememberSaveable { mutableStateOf(systemEnglish) }
    var whyNotOpen by rememberSaveable { mutableStateOf(false) }
    NestedScreen(
        title = stringResource(R.string.review_question, position + 1),
        onBack = onBack,
        modifier = modifier,
    ) { padding ->
        when (state) {
            ReviewViewModel.UiState.Loading -> {
                Box(Modifier.fillMaxSize())
            }

            ReviewViewModel.UiState.Missing -> {
                MissingTraining(padding, onBack)
            }

            is ReviewViewModel.UiState.Ready -> {
                val training = state.training
                val question = training.question(position.coerceIn(0, training.total - 1))
                val section = training.session.section.study()
                val answer = training.answer(position)
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
                    Column(
                        modifier =
                            Modifier
                                .widthIn(max = GpLayout.contentMax + GpLayout.gutter * 2)
                                .fillMaxWidth()
                                .verticalScroll(rememberScrollState())
                                .padding(horizontal = GpLayout.gutter, vertical = GpSpace.s8)
                                .testTag("reviewItem"),
                        verticalArrangement = Arrangement.spacedBy(GpSpace.s20),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = question.typeLabel(),
                                style = Gp.type.meta,
                                color = section.color(Gp.colors),
                                modifier = Modifier.weight(1f),
                            )
                            TextButton(onClick = onReport, modifier = Modifier.testTag("question.report")) {
                                Text(stringResource(R.string.question_report), style = Gp.type.caption, color = Gp.colors.text2)
                            }
                        }
                        when (question.questionType) {
                            QuestionType.QUANTITATIVE_COMPARISON -> {
                                Quantities(question)
                            }

                            QuestionType.MULTIPLE_CHOICE -> {
                                Text(
                                    question.prompt,
                                    style = (if (Gp.isWide) Gp.type.qTextWide else Gp.type.qText).copy(localeList = English),
                                    color = Gp.colors.text,
                                )
                            }

                            else -> {
                                PromptText(question = question, selection = question.answer)
                            }
                        }
                        RevealedOptions(question, answer?.optionIds.orEmpty())
                        ExplanationPanel(
                            question = question,
                            answer = answer,
                            english = english,
                            whyNotOpen = whyNotOpen,
                            onLanguage = { english = it },
                            onToggleWhyNot = { whyNotOpen = !whyNotOpen },
                            modifier = Modifier.padding(bottom = GpSpace.s32),
                        )
                    }
                }
            }
        }
    }
}

/** Выбранное задание остаётся рядом со списком; язык и раскрытие сбрасываются при смене строки. */
@Composable
private fun ReviewQuestion(
    training: StoredTraining,
    position: Int,
    onReport: () -> Unit,
) {
    val systemEnglish = LocalConfiguration.current.locales[0].language == "en"
    var english by rememberSaveable(training.id, position) { mutableStateOf(systemEnglish) }
    var whyNotOpen by rememberSaveable(training.id, position) { mutableStateOf(false) }
    val question = training.question(position)
    val section = training.session.section.study()
    val answer = training.answer(position)
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(GpSpace.s20)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                stringResource(R.string.review_question, position + 1),
                style = Gp.type.h2,
                color = Gp.colors.text,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = onReport, modifier = Modifier.testTag("question.report")) {
                Text(stringResource(R.string.question_report), style = Gp.type.caption, color = Gp.colors.text2)
            }
        }
        Text(question.typeLabel(), style = Gp.type.meta, color = section.color(Gp.colors))
        when (question.questionType) {
            QuestionType.QUANTITATIVE_COMPARISON -> {
                Quantities(question)
            }

            QuestionType.MULTIPLE_CHOICE -> {
                Text(
                    question.prompt,
                    style = (if (Gp.isWide) Gp.type.qTextWide else Gp.type.qText).copy(localeList = English),
                    color = Gp.colors.text,
                )
            }

            else -> {
                PromptText(question, question.answer)
            }
        }
        RevealedOptions(question, answer?.optionIds.orEmpty())
        ExplanationPanel(
            question = question,
            answer = answer,
            english = english,
            whyNotOpen = whyNotOpen,
            onLanguage = { english = it },
            onToggleWhyNot = { whyNotOpen = !whyNotOpen },
            modifier = Modifier.padding(bottom = GpSpace.s32),
        )
    }
}

/** «Сообщить об ошибке» (макет R17): где ошибка, что не так, «Отправить»; после — «Спасибо». */
@Composable
fun ReportScreen(
    questionId: String,
    trainingId: String,
    position: Int,
    typeLabel: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ReportViewModel =
        hiltViewModel<ReportViewModel, ReportViewModel.Factory>(key = "$trainingId/$position") { it.create(questionId, trainingId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ReportContent(
        state = state,
        position = position,
        typeLabel = typeLabel,
        onKind = viewModel::setKind,
        onText = viewModel::setText,
        onSend = viewModel::send,
        onBack = onBack,
        modifier = modifier,
    )
}

private val REPORT_KINDS =
    listOf(
        QuestionReport.Kind.QUESTION to R.string.report_kind_question,
        QuestionReport.Kind.ANSWER to R.string.report_kind_answer,
        QuestionReport.Kind.EXPLANATION to R.string.report_kind_explanation,
        QuestionReport.Kind.TRANSLATION to R.string.report_kind_translation,
        QuestionReport.Kind.OTHER to R.string.report_kind_other,
    )

@Composable
fun ReportContent(
    state: ReportViewModel.UiState,
    position: Int,
    typeLabel: String,
    onKind: (QuestionReport.Kind) -> Unit,
    onText: (String) -> Unit,
    onSend: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Gp.colors
    NestedScreen(title = stringResource(R.string.report_title), onBack = onBack, modifier = modifier) { padding ->
        if (state.sent) {
            EmptyState(
                title = stringResource(R.string.report_thanks),
                message = stringResource(R.string.report_note),
                action = stringResource(R.string.report_back),
                onAction = onBack,
                modifier = Modifier.padding(padding).testTag("report.sent"),
            )
            return@NestedScreen
        }
        Column(modifier = Modifier.fillMaxSize().padding(padding).imePadding()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
                Column(
                    modifier =
                        Modifier
                            .widthIn(max = GpLayout.contentMax + GpLayout.gutter * 2)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = GpLayout.gutter, vertical = GpSpace.s8)
                            .testTag("report"),
                    verticalArrangement = Arrangement.spacedBy(GpSpace.s16),
                ) {
                    Text(
                        text = stringResource(R.string.report_context, position + 1, typeLabel),
                        style = Gp.type.meta,
                        color = colors.text2,
                    )
                    Text(
                        text = stringResource(R.string.report_kind),
                        style = Gp.type.opt,
                        color = colors.text,
                    )
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(GpSpace.s8),
                        verticalArrangement = Arrangement.spacedBy(GpSpace.s8),
                    ) {
                        REPORT_KINDS.forEach { (kind, label) ->
                            FilterChip(
                                selected = state.kind == kind,
                                onClick = { onKind(kind) },
                                label = { Text(stringResource(label), style = Gp.type.seg) },
                                shape = CircleShape,
                                border = null,
                                colors =
                                    FilterChipDefaults.filterChipColors(
                                        containerColor = if (Gp.isDark) colors.surface2 else colors.surface,
                                        labelColor = colors.text,
                                        selectedContainerColor = colors.accentSoft,
                                        selectedLabelColor = colors.accent,
                                    ),
                                modifier = Modifier.heightIn(min = GpSize.tapTarget).testTag("report.kind.${kind.value}"),
                            )
                        }
                    }
                    OutlinedTextField(
                        value = state.text,
                        onValueChange = onText,
                        label = { Text(stringResource(R.string.report_text)) },
                        minLines = 3,
                        textStyle = Gp.type.body,
                        colors =
                            OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = colors.surface,
                                unfocusedContainerColor = colors.surface,
                                focusedBorderColor = colors.focus,
                                unfocusedBorderColor = colors.line,
                                focusedTextColor = colors.text,
                                unfocusedTextColor = colors.text,
                                cursorColor = colors.text,
                                focusedLabelColor = colors.text2,
                                unfocusedLabelColor = colors.text2,
                            ),
                        modifier = Modifier.fillMaxWidth().testTag("report.text"),
                    )
                    Text(
                        text = stringResource(R.string.report_note),
                        style = Gp.type.meta,
                        color = colors.text2,
                        textAlign = TextAlign.Start,
                    )
                }
            }
            BottomActions(
                note =
                    if (state.failed) {
                        {
                            dev.greprepapp.app.ui.StatusLine(
                                icon = R.drawable.ic_error,
                                text = stringResource(R.string.report_save_failed),
                                modifier = Modifier.testTag("report.problem").semantics { liveRegion = LiveRegionMode.Polite },
                            )
                        }
                    } else {
                        null
                    },
            ) {
                GpPrimaryButton(
                    text = stringResource(R.string.report_send),
                    onClick = onSend,
                    enabled = state.kind != null,
                    busy = state.sending,
                    modifier = Modifier.fillMaxWidth().testTag("report.send"),
                )
            }
        }
    }
}
