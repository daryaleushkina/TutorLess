package dev.greprepapp.app.feature.training

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.greprepapp.api.models.Question
import dev.greprepapp.api.models.QuestionType
import dev.greprepapp.app.R
import dev.greprepapp.app.feature.training.SessionViewModel.Screen
import dev.greprepapp.app.feature.training.SessionViewModel.UiState
import dev.greprepapp.app.ui.EmptyState
import dev.greprepapp.app.ui.StatusLine
import dev.greprepapp.app.ui.label
import dev.greprepapp.design.Gp
import dev.greprepapp.design.GpPrimaryButton
import dev.greprepapp.design.GpSecondaryButton
import dev.greprepapp.design.MathFamily
import dev.greprepapp.design.SectionBackground
import dev.greprepapp.design.StudySection
import greprep.design.GpLayout
import greprep.design.GpRadius
import greprep.design.GpSize
import greprep.design.GpSpace
import kotlin.math.roundToInt

private const val SECONDS_PER_MINUTE = 60
private const val TIMER_FORMAT = "%d:%02d"
private const val NBSP = '\u00A0'

/** Действия экрана сессии — одним набором, чтобы снимки экранов подставляли пустые. */
@Immutable
class SessionActions(
    val onClose: () -> Unit = {},
    val onSelect: (String) -> Unit = {},
    val onEditResponse: (ResponseEdit) -> Unit = {},
    val onCheck: () -> Unit = {},
    val onDontKnow: () -> Unit = {},
    val onNext: () -> Unit = {},
    val onPrevious: () -> Unit = {},
    val onPastExplanation: () -> Unit = {},
    val onFlag: () -> Unit = {},
    val onOverview: () -> Unit = {},
    val onCloseOverview: () -> Unit = {},
    val onGoTo: (Int) -> Unit = {},
    val onFinish: () -> Unit = {},
    val onLanguage: (Boolean) -> Unit = {},
    val onToggleWhyNot: () -> Unit = {},
    val onReport: (Int) -> Unit = {},
    val onReview: () -> Unit = {},
    val onRepeat: () -> Unit = {},
    val onTopic: (String) -> Unit = {},
)

/** Сессия тренировки: вопрос за вопросом, а в конце — итог (макеты R3–R6, R9, R14, R15). */
@Composable
fun SessionScreen(
    trainingId: String,
    onClose: () -> Unit,
    onReview: () -> Unit,
    onReport: (ReportTarget) -> Unit,
    onRepeatStarted: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SessionViewModel =
        hiltViewModel<SessionViewModel, SessionViewModel.Factory>(key = trainingId) { it.create(trainingId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val interfaceEnglish = LocalConfiguration.current.locales[0].language == "en"
    val repeat by viewModel.repeat.collectAsStateWithLifecycle()
    LaunchedEffect(repeat.started) {
        repeat.started?.let {
            viewModel.consumeRepeat()
            onRepeatStarted(it)
        }
    }
    val overview = (state as? UiState.Active)?.screen?.overview == true
    // «Назад» со списка вопросов — к вопросу, а не прочь из тренировки.
    BackHandler(enabled = overview, onBack = viewModel::closeOverview)
    SessionContent(
        state = state,
        repeat = repeat,
        actions =
            SessionActions(
                onClose = {
                    viewModel.saveVisitTime()
                    onClose()
                },
                onSelect = viewModel::select,
                onEditResponse = viewModel::editResponse,
                onCheck = viewModel::check,
                onDontKnow = viewModel::dontKnow,
                onNext = viewModel::next,
                onPrevious = viewModel::previous,
                onPastExplanation = viewModel::showPastExplanation,
                onFlag = viewModel::toggleFlag,
                onOverview = viewModel::openOverview,
                onCloseOverview = viewModel::closeOverview,
                onGoTo = viewModel::goTo,
                onFinish = viewModel::finish,
                onLanguage = viewModel::setEnglish,
                onToggleWhyNot = viewModel::toggleWhyNot,
                onReport = { position ->
                    (state as? UiState.Active)?.screen?.training?.let {
                        onReport(
                            it.reportTarget(position).copy(
                                translationAllowed =
                                    (state as? UiState.Active)?.screen?.let { screen ->
                                        screen.revealed && screen.english != null &&
                                            screen.english != interfaceEnglish
                                    } ==
                                        true,
                            ),
                        )
                    }
                },
                onReview = onReview,
                onRepeat = viewModel::repeatMistakes,
                onTopic = viewModel::repeatTopic,
            ),
        modifier = modifier,
    )
}

@Composable
fun SessionContent(
    state: UiState,
    repeat: SessionViewModel.RepeatState,
    actions: SessionActions,
    modifier: Modifier = Modifier,
) {
    val screen = (state as? UiState.Active)?.screen
    var exitConfirmation by rememberSaveable { mutableStateOf(false) }
    var finishConfirmation by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(screen?.training?.isFinished) {
        if (screen?.training?.isFinished == true) {
            // Время идёт и в подтверждении: окончание сессии убирает все её модальные действия.
            exitConfirmation = false
            finishConfirmation = false
        }
    }

    fun close() {
        if (screen?.training?.isCheck == true && !screen.training.isFinished) exitConfirmation = true else actions.onClose()
    }

    fun finish() {
        if (screen != null && unansweredCount(screen) > 0) finishConfirmation = true else actions.onFinish()
    }
    val guarded =
        SessionActions(
            onClose = ::close,
            onSelect = actions.onSelect,
            onEditResponse = actions.onEditResponse,
            onCheck = actions.onCheck,
            onDontKnow = actions.onDontKnow,
            onNext = actions.onNext,
            onPrevious = actions.onPrevious,
            onPastExplanation = actions.onPastExplanation,
            onFlag = actions.onFlag,
            onOverview = actions.onOverview,
            onCloseOverview = actions.onCloseOverview,
            onGoTo = actions.onGoTo,
            onFinish = ::finish,
            onLanguage = actions.onLanguage,
            onToggleWhyNot = actions.onToggleWhyNot,
            onReport = actions.onReport,
            onReview = actions.onReview,
            onRepeat = actions.onRepeat,
            onTopic = actions.onTopic,
        )
    BackHandler(enabled = screen != null && !screen.training.isFinished && !screen.overview) { close() }
    TrainingKeyboard(onKey = { key ->
        screen != null && !exitConfirmation && !finishConfirmation && sessionKey(key, screen, repeat, guarded)
    }, modifier = modifier) {
        SessionBody(state, repeat, guarded)
    }
    if (screen?.overview == true && !screen.training.isFinished) {
        TrainingSheet(onDismiss = actions.onCloseOverview, tag = "overview") {
            screen.remainingSeconds?.let { TimerPill(it, screen.position, screen.training.total) }
            OverviewDetails(
                screen,
                screen.training.session.section
                    .study(),
                guarded,
            )
            GpPrimaryButton(
                stringResource(R.string.overview_finish),
                ::finish,
                modifier = Modifier.fillMaxWidth().testTag("overview.finish"),
            )
        }
    }
    if (exitConfirmation) {
        AlertDialog(
            onDismissRequest = { exitConfirmation = false },
            title = { Text(stringResource(R.string.check_exit_title)) },
            text = { Text(stringResource(R.string.check_exit_message)) },
            confirmButton = {
                TextButton(onClick = {
                    exitConfirmation = false
                    actions.onClose()
                }, modifier = Modifier.testTag("session.exit")) { Text(stringResource(R.string.check_exit)) }
            },
            dismissButton = {
                TextButton(onClick = {
                    exitConfirmation = false
                }, modifier = Modifier.testTag("session.stay")) { Text(stringResource(R.string.check_stay)) }
            },
            modifier = Modifier.testTag("session.exit.confirm"),
        )
    }
    if (finishConfirmation && screen != null && !screen.training.isFinished) {
        AlertDialog(
            onDismissRequest = { finishConfirmation = false },
            title = { Text(stringResource(R.string.check_finish_title, unansweredCount(screen))) },
            confirmButton = {
                TextButton(onClick = {
                    finishConfirmation = false
                    actions.onFinish()
                }, modifier = Modifier.testTag("overview.confirm.finish")) { Text(stringResource(R.string.overview_finish)) }
            },
            dismissButton = {
                TextButton(onClick = {
                    finishConfirmation = false
                }, modifier = Modifier.testTag("overview.cancel")) { Text(stringResource(R.string.check_stay)) }
            },
            modifier = Modifier.testTag("overview.confirm"),
        )
    }
}

private fun sessionKey(
    key: Key,
    s: Screen,
    repeat: SessionViewModel.RepeatState,
    actions: SessionActions,
): Boolean {
    if (key == Key.DirectionLeft && s.result == null && s.position > 0) {
        actions.onPrevious()
        return true
    }
    if (key == Key.Enter) {
        when {
            s.result != null -> {
                if (!repeat.starting) {
                    if (s.result!!.review.isEmpty()) actions.onClose() else actions.onRepeat()
                }
            }

            s.overview -> {
                actions.onFinish()
            }

            s.training.isCheck || s.revealed -> {
                actions.onNext()
            }

            s.canCheck -> {
                actions.onCheck()
            }

            else -> {
                return false
            }
        }
        return true
    }
    if (key == Key.DirectionRight && s.result == null && !s.overview && (s.training.isCheck || s.revealed)) {
        actions.onNext()
        return true
    }
    if (s.result != null || s.overview || s.revealed) return false
    val group = s.keyboardGroup
    val index = AnswerKeys.indexOf(key)
    val option = group?.options?.getOrNull(index) ?: return false
    actions.onSelect(option.id)
    return true
}

@Composable
private fun SessionBody(
    state: UiState,
    repeat: SessionViewModel.RepeatState,
    actions: SessionActions,
    modifier: Modifier = Modifier,
) {
    when (state) {
        UiState.Loading -> {
            // Чтение файла с устройства — миллисекунды: крутилка только мигнула бы.
            SectionBackground(modifier = modifier.testTag("session.loading")) {}
        }

        UiState.Missing -> {
            SectionBackground(modifier = modifier) {
                EmptyState(
                    title = stringResource(R.string.training_missing_title),
                    message = stringResource(R.string.training_missing_message),
                    action = stringResource(R.string.summary_done),
                    onAction = actions.onClose,
                    modifier = Modifier.testTag("session.missing"),
                )
            }
        }

        is UiState.Active -> {
            val s = state.screen
            val section =
                s.training.session.section
                    .study()
            val result = s.result
            var timeoutSeen by rememberSaveable(s.training.id) { mutableStateOf(false) }
            SectionBackground(modifier = modifier) {
                when {
                    s.training.finish?.timedOut == true && !timeoutSeen -> {
                        TimeoutPane(s, onSummary = { timeoutSeen = true })
                    }

                    result != null -> {
                        SummaryPane(s, result, section, repeat, actions)
                    }

                    else -> {
                        QuestionPane(s, section, actions, repeat)
                    }
                }
            }
        }
    }
}

/** Окончание времени — отдельный шаг, с той же закреплённой нижней панелью (R14-timeout). */
@Composable
private fun TimeoutPane(
    screen: Screen,
    onSummary: () -> Unit,
) {
    Scaffold(
        containerColor = Color.Transparent,
        modifier = Modifier.testTag("session.timeout"),
        bottomBar = {
            BottomActions {
                GpPrimaryButton(
                    stringResource(R.string.timeout_summary),
                    onSummary,
                    modifier = Modifier.fillMaxWidth().testTag("timeout.summary"),
                )
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
            Column(
                Modifier.widthIn(max = GpLayout.contentMax).fillMaxWidth().padding(GpLayout.gutter),
                verticalArrangement = Arrangement.spacedBy(GpSpace.s12),
            ) {
                Surface(color = Gp.colors.surface2, shape = RoundedCornerShape(GpRadius.m)) {
                    Icon(
                        painterResource(R.drawable.ic_timer),
                        contentDescription = null,
                        tint = Gp.colors.text2,
                        modifier = Modifier.padding(GpSpace.s8),
                    )
                }
                Text(stringResource(R.string.timeout_title), style = Gp.type.h1, modifier = Modifier.semantics { heading() })
                Text(
                    stringResource(R.string.timeout_message, screen.training.total - unansweredCount(screen), screen.training.total),
                    style = Gp.type.body,
                    color = Gp.colors.text2,
                )
            }
        }
    }
}

/** Язык разбора: выбранный на разборе или язык интерфейса. */
@Composable
private fun Screen.explanationInEnglish(): Boolean = english ?: (LocalConfiguration.current.locales[0].language == "en")

@Composable
private fun QuestionPane(
    s: Screen,
    section: StudySection,
    actions: SessionActions,
    repeat: SessionViewModel.RepeatState,
) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = { SessionHeader(s, section, actions) },
        bottomBar = {
            Column(Modifier.imePadding()) {
                repeat.problem?.let { StatusLine(R.drawable.ic_error, startProblemText(it), Modifier.testTag("topic.problem")) }
                QuestionActions(s, actions)
            }
        },
    ) { padding ->
        val question: @Composable () -> Unit = {
            if (s.browsingPast) {
                StatusLine(
                    R.drawable.ic_resume,
                    stringResource(R.string.question_past_notice, s.position + 1, s.frontier + 1),
                )
            }
            if (s.revealed) AnswerVerdict(s.question, s.training.answer(s.position), s.explanationInEnglish())
            QuestionHeading(s.question, section, onReport = { actions.onReport(s.position) })
            QuestionBody(s, actions)
        }

        val companion: @Composable () -> Unit = {
            if (s.revealed && (!s.browsingPast || s.pastExplanation)) {
                ExplanationPanel(
                    question = s.question,
                    answer = s.training.answer(s.position),
                    english = s.explanationInEnglish(),
                    whyNotOpen = s.whyNotOpen,
                    onLanguage = actions.onLanguage,
                    onToggleWhyNot = actions.onToggleWhyNot,
                    onTopic = null,
                    topicStarting = repeat.starting,
                    modifier = Modifier.padding(top = GpSpace.s8),
                )
            } else if (s.browsingPast) {
                LinkText(
                    stringResource(R.string.question_show_explanation),
                    actions.onPastExplanation,
                    Modifier.testTag("question.showExplanation"),
                )
            }
        }
        if (s.question.passage != null && s.question.questionType != QuestionType.SELECT_IN_PASSAGE) {
            ReadingQuestionLayout(
                padding = padding,
                question = s.question,
                firstForPassage =
                    s.training.session.items
                        .take(s.position)
                        .none { it.question.passage?.id == s.question.passage?.id },
                revealed = s.revealed,
            ) {
                question()
                if (s.revealed) companion()
            }
        } else if (Gp.isWide && s.revealed && s.question.questionType != QuestionType.SELECT_IN_PASSAGE) {
            TrainingSplit(padding, "question", question, companion)
        } else {
            SessionColumn(padding = padding, tag = "question") {
                question()
                if (s.revealed) companion()
            }
        }
    }
}

/** Колонка сессии: на планшете — не шире 720 и по центру (режим фокуса, DESIGN.md «Навигация»). */
@Composable
private fun SessionColumn(
    padding: PaddingValues,
    tag: String,
    content: @Composable () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(
            modifier =
                Modifier
                    .widthIn(max = GpLayout.contentMax + GpLayout.gutter * 2)
                    .fillMaxWidth()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = GpLayout.gutter, vertical = GpSpace.s8)
                    .testTag(tag),
            verticalArrangement = Arrangement.spacedBy(GpSpace.s20),
        ) {
            content()
        }
    }
}

@Composable
private fun QuestionHeading(
    question: Question,
    section: StudySection,
    onReport: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = question.typeLabel(),
            style = Gp.type.meta,
            color = section.ink(Gp.colors),
            modifier = Modifier.weight(1f),
        )
        TextButton(onClick = onReport, modifier = Modifier.testTag("question.report")) {
            Text(text = stringResource(R.string.question_report), style = Gp.type.caption, color = Gp.colors.text2)
        }
    }
}

@Composable
private fun QuestionBody(
    s: Screen,
    actions: SessionActions,
) {
    QuestionContent(
        s.question,
        if (s.revealed) s.training.answer(s.position)?.response ?: emptyResponse(s.question) else s.response,
        revealed = s.revealed,
        onEditResponse = actions.onEditResponse,
        selectionLimitHit = s.selectionLimitHit,
        includePassage = false,
    )
}

@Composable
internal fun PlainPrompt(question: Question) {
    Text(
        text =
            if (question.questionType ==
                QuestionType.MULTIPLE_CHOICE_MULTI
            ) {
                mathText(question.prompt)
            } else {
                androidx.compose.ui.text
                    .AnnotatedString(question.prompt)
            },
        style = (if (Gp.isWide) Gp.type.qTextWide else Gp.type.qText).copy(localeList = English),
        color = Gp.colors.text,
        modifier = Modifier.testTag("question.prompt"),
    )
}

/** Quantitative Comparison (макет R9): условие по центру, две величины рядом. */
@Composable
fun Quantities(
    question: Question,
    modifier: Modifier = Modifier,
) {
    val colors = Gp.colors
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(GpSpace.s16)) {
        question.condition?.let {
            Text(
                text = mathText(it),
                style = (if (Gp.isWide) Gp.type.senseEn else Gp.type.lead).copy(localeList = English, fontFamily = MathFamily),
                color = colors.text,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().testTag("question.condition"),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(GpSpace.s12)) {
            Quantity(stringResource(R.string.quantity_a), question.quantityA.orEmpty(), Modifier.weight(1f))
            Quantity(stringResource(R.string.quantity_b), question.quantityB.orEmpty(), Modifier.weight(1f))
        }
    }
}

@Composable
private fun Quantity(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Surface(color = Gp.colors.surface, shape = RoundedCornerShape(GpRadius.l), modifier = modifier) {
        Column(
            modifier = Modifier.padding(GpSpace.s16),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(GpSpace.s8),
        ) {
            Text(text = label, style = Gp.type.eyebrow, color = Gp.colors.text3)
            Text(
                text = mathText(value),
                style = (if (Gp.isWide) Gp.type.qTextWide else Gp.type.qText).copy(localeList = English, fontFamily = MathFamily),
                color = Gp.colors.text,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** Варианты до ответа: одна группа — строки с системным выбором; несколько пропусков — группы (i), (ii), (iii). */
@Composable
internal fun ChoosableOptions(
    question: Question,
    selection: List<String>,
    onSelect: (String) -> Unit,
) {
    val many = question.groups.size > 1
    Column(verticalArrangement = Arrangement.spacedBy(if (many) GpSpace.s16 else GpSpace.s8)) {
        question.groups.forEachIndexed { g, group ->
            if (many) {
                Text(
                    text = BLANK_NUMBERS.getOrElse(g) { "" },
                    style = Gp.type.seg,
                    color = Gp.colors.text2,
                )
            }
            if (many) {
                // Каждый пропуск — отдельная группа полного ответа (макет R5).
                Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s8)) {
                    group.options.forEach { option ->
                        OptionRow(
                            option,
                            if (option.id in
                                selection
                            ) {
                                OptionMark.Selected
                            } else {
                                OptionMark.None
                            },
                            onClick = { onSelect(option.id) },
                        )
                    }
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s8)) {
                    group.options.forEach { option ->
                        OptionRow(
                            option = option,
                            mark = if (option.id in selection) OptionMark.Selected else OptionMark.None,
                            multiple = question.questionType == QuestionType.MULTIPLE_CHOICE_MULTI || question.selectCount > 1,
                            onClick = { onSelect(option.id) },
                        )
                    }
                }
            }
        }
    }
}

/**
 * Варианты после ответа (макет R4): рядом только верный и ваш, остальные — одной тихой строкой. Условие, ваш и
 * верный ответ видны вместе — держать в памяти нечего (PRODUCT.md, «Accessibility»).
 */
@Composable
fun RevealedOptions(
    question: Question,
    chosen: List<String>,
    modifier: Modifier = Modifier,
) {
    val many = question.groups.size > 1
    var all by rememberSaveable(question.id) { mutableStateOf(false) }
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(GpSpace.s8)) {
        question.groups.forEachIndexed { g, group ->
            if (many) Text(BLANK_NUMBERS.getOrElse(g) { "" }, style = Gp.type.meta, color = Gp.colors.text2)
            val shown = group.options.filter { all || it.id in question.answer || it.id in chosen }

            shown.forEach { option ->
                OptionRow(
                    option = option,
                    mark =
                        when (option.id) {
                            in question.answer -> OptionMark.Correct
                            in chosen -> OptionMark.Wrong
                            else -> OptionMark.None
                        },
                    multiple = question.questionType == QuestionType.MULTIPLE_CHOICE_MULTI || question.selectCount > 1,
                    chosen = option.id in chosen,
                )
            }
        }
        if (!all && question.groups.flatMap { it.options }.any { it.id !in question.answer && it.id !in chosen }) {
            LinkText(stringResource(R.string.question_all_options), { all = true }, Modifier.testTag("question.allOptions"))
        }
    }
}

/** Шапка сессии: счётчик или таймер, инструменты, под ними полоса прогресса (R3, R14). */
@Composable
private fun SessionHeader(
    s: Screen,
    section: StudySection,
    actions: SessionActions,
) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = GpLayout.sessionMax).fillMaxWidth().statusBarsPadding()) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = GpSize.opt)
                        .padding(horizontal = GpSpace.s4),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = actions.onClose, modifier = Modifier.testTag("session.close")) {
                    Icon(
                        painter = painterResource(R.drawable.ic_close),
                        contentDescription = stringResource(R.string.question_close),
                        tint = Gp.colors.text,
                    )
                }
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    val remaining = s.remainingSeconds
                    if (remaining != null) {
                        TimerPill(remaining, s.position, s.training.total)
                    } else {
                        ProgressDots(s, section)
                    }
                }
                if (s.training.isCheck && !s.overview) {
                    IconButton(onClick = actions.onFlag, modifier = Modifier.testTag("question.flag")) {
                        Icon(
                            painter = painterResource(if (s.flagged) R.drawable.ic_flag_filled else R.drawable.ic_flag),
                            contentDescription = stringResource(if (s.flagged) R.string.question_unflag else R.string.question_flag),
                            tint = if (s.flagged) section.ink(Gp.colors) else Gp.colors.text,
                        )
                    }
                    IconButton(onClick = actions.onOverview, modifier = Modifier.testTag("question.overview")) {
                        Icon(
                            painter = painterResource(R.drawable.ic_grid_view),
                            contentDescription = stringResource(R.string.question_overview),
                            tint = Gp.colors.text,
                        )
                    }
                } else if (s.position > 0) {
                    PreviousButton(s, actions)
                } else {
                    Spacer(Modifier.size(GpSize.tapTarget))
                }
            }
            // Счётчик уже озвучивает номер: декоративная полоса не дублирует его для TalkBack.
            Box(
                Modifier
                    .padding(horizontal = GpLayout.gutter)
                    .fillMaxWidth()
                    .height(GpSpace.s2)
                    .background(Gp.colors.line)
                    .clearAndSetSemantics {},
            ) {
                Box(
                    Modifier
                        .fillMaxWidth((s.position + 1).toFloat() / s.training.total)
                        .height(GpSpace.s2)
                        .background(Gp.colors.text),
                )
            }
        }
    }
}

/** Конец сессии виден заранее (DESIGN.md, «Правило одной задачи»): «4 из 10». */

@Composable
private fun ProgressDots(
    s: Screen,
    section: StudySection,
) {
    val colors = Gp.colors
    val total = s.training.total
    val description = stringResource(R.string.question_progress_description, s.position + 1, total)
    Row(
        modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = description }.testTag("session.progress"),
        horizontalArrangement = Arrangement.spacedBy(GpSpace.s8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text =
                s.training.session.section
                    .label(),
            style = Gp.type.meta,
            color = section.ink(Gp.colors),
        )
        Text(
            text = stringResource(R.string.question_of, s.position + 1, total),
            style = (if (Gp.isWide) Gp.type.sessionCountWide else Gp.type.sessionCount).copy(fontFeatureSettings = "tnum"),
            color = colors.text2,
        )
    }
}

/** Таймер «Проверки» (макет R14): виден всегда, без красного — спокойно, но честно. */
@Composable
private fun TimerPill(
    remaining: Int,
    position: Int,
    total: Int,
) {
    val minutes = remaining / SECONDS_PER_MINUTE
    val seconds = remaining % SECONDS_PER_MINUTE
    val description =
        if (minutes > 0) {
            pluralStringResource(R.plurals.timer_minutes_description, minutes, minutes, position + 1, total)
        } else {
            stringResource(R.string.timer_less_minute_description, position + 1, total)
        }
    Surface(
        color = Gp.colors.surface2,
        shape = CircleShape,
        modifier =
            Modifier.testTag("session.timer").clearAndSetSemantics {
                contentDescription = description
                liveRegion = LiveRegionMode.Polite
            },
    ) {
        // При крупном шрифте переносим целиком подпись прогресса под таймер:
        // цифры и слова остаются целыми, а шапка растёт вместе с пилюлей.
        FlowRow(
            modifier = Modifier.padding(horizontal = GpSpace.s14, vertical = GpSpace.s6),
            horizontalArrangement = Arrangement.spacedBy(GpSpace.s8, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(GpSpace.s4),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(GpSpace.s8),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.width(IntrinsicSize.Max).align(Alignment.CenterVertically),
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_timer),
                    contentDescription = null,
                    tint = Gp.colors.text2,
                    modifier = Modifier.size(GpSpace.s20),
                )
                Text(
                    text = TIMER_FORMAT.format(minutes, seconds),
                    style = Gp.type.scoreNum.copy(fontFeatureSettings = "tnum"),
                    color = if (remaining <= SECONDS_PER_MINUTE) Gp.colors.wrong else Gp.colors.text,
                    softWrap = false,
                )
            }
            Text(
                text = stringResource(R.string.question_of, position + 1, total),
                style = Gp.type.meta.copy(fontFeatureSettings = "tnum"),
                color = Gp.colors.text2,
                softWrap = false,
                modifier = Modifier.align(Alignment.CenterVertically),
            )
        }
    }
}

/** Нижняя панель на bg: одна главная кнопка в одном месте, без затухания (каталог сессии). */
@Composable
fun BottomActions(
    modifier: Modifier = Modifier,
    note: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val bg = Gp.colors.bg
    Column(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(bg)
                    .navigationBarsPadding()
                    .padding(start = GpLayout.gutter, end = GpLayout.gutter, bottom = GpSpace.s12),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(GpSpace.s12),
        ) {
            note?.invoke()
            Box(modifier = Modifier.widthIn(max = GpLayout.sessionMax).fillMaxWidth()) { content() }
        }
    }
}

@Composable
private fun QuestionActions(
    s: Screen,
    actions: SessionActions,
) {
    val total = s.training.total
    val nextLabel =
        if (s.isLast) {
            stringResource(if (s.training.isCheck) R.string.question_to_list else R.string.question_result)
        } else {
            stringResource(R.string.question_next_plain)
        }
    when {
        s.browsingPast -> {
            BottomActions {
                GpPrimaryButton(
                    stringResource(R.string.question_return, s.frontier + 1),
                    actions.onNext,
                    modifier = Modifier.fillMaxWidth().testTag("question.return"),
                )
            }
        }

        s.training.isCheck -> {
            BottomActions {
                Row(horizontalArrangement = Arrangement.spacedBy(GpSpace.s12), verticalAlignment = Alignment.CenterVertically) {
                    PreviousButton(s, actions)
                    GpPrimaryButton(
                        text =
                            if (s.isLast) {
                                stringResource(R.string.question_to_list)
                            } else if (s.canCheck) {
                                stringResource(R.string.question_next_plain)
                            } else {
                                stringResource(R.string.question_skip)
                            },
                        onClick = actions.onNext,
                        modifier = Modifier.weight(1f).testTag("question.next"),
                    )
                }
            }
        }

        s.revealed -> {
            BottomActions {
                GpPrimaryButton(
                    text = nextLabel,
                    onClick = actions.onNext,
                    modifier = Modifier.fillMaxWidth().testTag("question.next"),
                )
            }
        }

        else -> {
            BottomActions(note = missingNote(s)?.let { text -> { Note(text) } }) {
                ActionRow(
                    secondary = stringResource(R.string.question_dont_know) to actions.onDontKnow,
                    primary = stringResource(R.string.question_check),
                    onPrimary = actions.onCheck,
                    primaryEnabled = s.canCheck,
                    primaryTag = "question.check",
                    secondaryTag = "question.dontKnow",
                )
            }
        }
    }
}

/** Что ещё выбрать, чтобы «Проверить» включилась (макет R5); пока не выбрано ничего — молчим. */
@Composable
private fun missingNote(s: Screen): String? {
    val q = s.question
    if (s.selection.isEmpty()) return null
    val missing = s.missing
    if (missing.isEmpty()) return null
    if (q.questionType == QuestionType.MULTIPLE_CHOICE_MULTI && q.selectCount > 0) {
        val remaining = q.selectCount - s.selection.size
        return pluralStringResource(R.plurals.question_missing_choices, remaining, remaining)
    }
    return when {
        q.groups.size > 1 && missing.size == 1 -> stringResource(R.string.question_missing_blank, BLANK_NUMBERS[missing[0]])
        q.groups.size > 1 -> stringResource(R.string.question_missing_blanks, missing.joinToString(", ") { BLANK_NUMBERS[it] })
        q.selectCount > 1 -> stringResource(R.string.question_pick_one_more)
        else -> null
    }
}

@Composable
private fun Note(text: String) {
    Text(
        text = text,
        style = Gp.type.meta,
        color = Gp.colors.text2,
        textAlign = TextAlign.Center,
        modifier = Modifier.testTag("session.note"),
    )
}

@Composable
private fun ActionRow(
    secondary: Pair<String, () -> Unit>,
    primary: String,
    onPrimary: () -> Unit,
    primaryTag: String,
    primaryEnabled: Boolean = true,
    primaryBusy: Boolean = false,
    secondaryTag: String = "session.secondary",
) {
    Row(horizontalArrangement = Arrangement.spacedBy(GpSpace.s12)) {
        // Вторичная — по своей ширине, главная — всё остальное: длинная подпись главной не переносится.
        GpSecondaryButton(
            text = secondary.first,
            onClick = secondary.second,
            modifier = Modifier.testTag(secondaryTag),
        )
        GpPrimaryButton(
            text = primary,
            onClick = onPrimary,
            enabled = primaryEnabled,
            busy = primaryBusy,
            modifier = Modifier.weight(1f).testTag(primaryTag),
        )
    }
}

@Composable
private fun OverviewDetails(
    s: Screen,
    section: StudySection,
    actions: SessionActions,
) {
    val colors = Gp.colors
    val answered =
        s.training.session.items
            .count {
                (s.training.answer(it.position)?.response ?: emptyResponse(it.question)).isComplete(it.question)
            }
    val flagged = (0 until s.training.total).count { s.flaggedAt(it) }
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(GpSpace.s20)) {
        Text(
            text = stringResource(R.string.question_overview),
            style = Gp.type.h2,
            color = colors.text,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = stringResource(R.string.overview_summary, answered, s.training.total, flagged),
            style = Gp.type.meta,
            color = colors.text2,
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(GpSpace.s12),
            verticalArrangement = Arrangement.spacedBy(GpSpace.s12),
        ) {
            repeat(s.training.total) { i -> OverviewCell(s, i, onClick = { actions.onGoTo(i) }) }
        }
    }
}

@Composable
private fun OverviewCell(
    s: Screen,
    position: Int,
    onClick: () -> Unit,
) {
    val colors = Gp.colors
    val answer = s.training.answer(position)
    val isAnswered = (answer?.response ?: emptyResponse(s.training.question(position))).isComplete(s.training.question(position))
    val isFlagged = s.flaggedAt(position)
    val state =
        listOfNotNull(
            stringResource(if (isAnswered) R.string.overview_answered else R.string.overview_empty),
            if (isFlagged) stringResource(R.string.overview_flagged) else null,
        ).joinToString(", ")
    val description = stringResource(R.string.overview_item, position + 1, state)
    Surface(
        onClick = onClick,
        color = if (isAnswered) colors.surface3 else colors.surface,
        shape = RoundedCornerShape(GpRadius.m),
        border =
            if (position ==
                s.position
            ) {
                BorderStroke(GpSize.hairline, colors.text)
            } else if (isAnswered) {
                BorderStroke(GpSize.hairline, colors.line)
            } else {
                null
            },
        modifier =
            Modifier
                .size(GpSize.button)
                .then(if (!isAnswered && position != s.position) Modifier.dashedOutline(colors.lineStrong, GpRadius.m) else Modifier)
                .semantics { contentDescription = description }
                .testTag("overview.$position"),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = (position + 1).toString(),
                style = Gp.type.action.copy(fontFeatureSettings = "tnum"),
                color = colors.text,
            )
            if (isFlagged) {
                Icon(
                    painter = painterResource(R.drawable.ic_flag_filled),
                    contentDescription = null,
                    tint = colors.text,
                    modifier = Modifier.align(Alignment.TopEnd).size(GpSpace.s14),
                )
            }
        }
    }
}

/** Итог (макет R15): «7 из 10 верно», сколько шла, что повторить; дальше — повтор по ошибкам или «Готово». */
@Composable
private fun SummaryPane(
    s: Screen,
    result: TrainingResult,
    section: StudySection,
    repeat: SessionViewModel.RepeatState,
    actions: SessionActions,
) {
    val colors = Gp.colors
    val mistakes = result.review.sumOf { it.mistakes }
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            Row(modifier = Modifier.statusBarsPadding().height(GpSize.opt).padding(horizontal = GpSpace.s4)) {
                IconButton(onClick = actions.onClose, modifier = Modifier.testTag("session.close")) {
                    Icon(
                        painter = painterResource(R.drawable.ic_close),
                        contentDescription = stringResource(R.string.summary_done),
                        tint = colors.text,
                    )
                }
            }
        },
        bottomBar = {
            BottomActions(note = repeat.problem?.let { p -> { Note(startProblemText(p)) } }) {
                if (result.review.isEmpty()) {
                    GpPrimaryButton(
                        text = stringResource(R.string.summary_done),
                        onClick = actions.onClose,
                        modifier = Modifier.fillMaxWidth().testTag("summary.done"),
                    )
                } else {
                    val count = TrainingRules.repeatCount(mistakes)
                    Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s8)) {
                        GpPrimaryButton(
                            text = stringResource(R.string.summary_repeat, pluralStringResource(R.plurals.questions_count, count, count)),
                            onClick = actions.onRepeat,
                            busy = repeat.starting,
                            modifier = Modifier.fillMaxWidth().testTag("summary.repeat"),
                        )
                        TextButton(onClick = actions.onClose, modifier = Modifier.fillMaxWidth().testTag("summary.done")) {
                            Text(stringResource(R.string.summary_done), style = Gp.type.action)
                        }
                    }
                }
            }
        },
    ) { padding ->
        val score: @Composable () -> Unit = {
            Surface(color = colors.surface, shape = RoundedCornerShape(GpRadius.l), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(GpSpace.s24), verticalArrangement = Arrangement.spacedBy(GpSpace.s16)) {
                    Text(text = summaryLine(s, result), style = Gp.type.meta, color = colors.text2)
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(GpSpace.s12)) {
                        Text(
                            text = result.correct.toString(),
                            style = (if (Gp.isWide) Gp.type.numXxlWide else Gp.type.numXxl).copy(fontFeatureSettings = "tnum"),
                            color = section.ink(colors),
                            modifier = Modifier.testTag("summary.correct"),
                        )
                        Text(
                            text = pluralStringResource(R.plurals.summary_correct_of, result.total, result.total),
                            style = if (Gp.isWide) Gp.type.numLabelWide else Gp.type.numLabel,
                            color = colors.text2,
                            modifier = Modifier.padding(bottom = GpSpace.s6),
                        )
                    }
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(GpSpace.s8),
                        verticalArrangement = Arrangement.spacedBy(GpSpace.s8),
                    ) {
                        s.training.session.items.forEach { item ->
                            val correct =
                                s.training
                                    .answer(item.position)
                                    ?.response
                                    ?.let { it.isCorrect(item.question) } == true
                            val summaryAnswerDescription =
                                stringResource(R.string.review_question, item.position + 1) + ", " +
                                    stringResource(if (correct) R.string.review_correct else R.string.review_wrong)
                            MarkDot(
                                correct,
                                if (correct) colors.right else colors.wrong,
                                Modifier.semantics { contentDescription = summaryAnswerDescription }.testTag(
                                    "summary.answer.${item.position}",
                                ),
                            )
                        }
                    }
                }
            }
            LinkText(stringResource(R.string.summary_all_answers), actions.onReview, Modifier.testTag("summary.review"))
            if (s.training.finish?.timedOut == true) {
                StatusLine(icon = R.drawable.ic_timer, text = stringResource(R.string.summary_timed_out))
            }
        }
        val review: @Composable () -> Unit = {
            if (result.review.isEmpty()) {
                // Ошибок темы нет, но вопросы могли остаться «не успел» — «без ошибок» при 1 из 3 звучало бы фальшиво.
                val text =
                    if (result.unanswered > 0) {
                        stringResource(
                            R.string.summary_ran_out,
                            pluralStringResource(R.plurals.questions_count, result.unanswered, result.unanswered),
                        )
                    } else {
                        stringResource(R.string.summary_perfect)
                    }
                Text(text = text, style = Gp.type.body, color = colors.text, modifier = Modifier.testTag("summary.noMistakes"))
            } else {
                Text(
                    text = stringResource(R.string.summary_review),
                    style = Gp.type.h2,
                    color = colors.text,
                    modifier = Modifier.padding(top = GpSpace.s8).semantics { heading() },
                )
                result.review.forEach { topic -> ReviewTopic(topic, section, { actions.onTopic(topic.topicId) }, repeat.starting) }
            }
        }
        if (Gp.isWide) {
            TrainingSplit(padding, "summary", score, review)
        } else {
            SessionColumn(padding = padding, tag = "summary") {
                score()
                review()
            }
        }
    }
}

@Composable
private fun ReviewTopic(
    topic: TopicReview,
    section: StudySection,
    onClick: () -> Unit,
    busy: Boolean,
) {
    val english = LocalConfiguration.current.locales[0].language == "en"
    val and = stringResource(R.string.summary_and)
    val numbers = topic.positions.map { (it + 1).toString() }
    val list = if (numbers.size == 1) numbers[0] else numbers.dropLast(1).joinToString(", ") + " $and " + numbers.last()
    val where =
        if (numbers.size == 1) stringResource(R.string.summary_question, list) else stringResource(R.string.summary_questions, list)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = GpSize.tapTarget)
                .clickable(enabled = !busy, role = Role.Button, onClick = onClick)
                .testTag("summary.topic.${topic.topicId}"),
        horizontalArrangement = Arrangement.spacedBy(GpSpace.s12),
        verticalAlignment = Alignment.Top,
    ) {
        Box(Modifier.padding(top = GpSpace.s8).size(GpSpace.s8).background(section.color(Gp.colors), CircleShape))
        Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s2)) {
            Text(text = topic.title.pick(english), style = Gp.type.h3, color = Gp.colors.text)
            Text(
                text = pluralStringResource(R.plurals.summary_mistakes, topic.mistakes, topic.mistakes) + " · " + where,
                style = Gp.type.meta,
                color = Gp.colors.text2,
            )
        }
    }
}

/** «Verbal · Text Completion · 11 минут», у «Проверки» — «Проверка · Verbal · 17 минут из 18». */
@Composable
private fun summaryLine(
    s: Screen,
    result: TrainingResult,
): String {
    val session = s.training.session
    val (minutes, limit) =
        TrainingRules.summaryMinutes(result.durationSeconds, if (s.training.isCheck) session.timeLimitSeconds else null)
    // «11 минут» не разрывается переносом строки.
    val duration = pluralStringResource(R.plurals.training_minutes, minutes, minutes).replace(' ', NBSP)
    val sectionLabel = session.section.label()
    return if (limit != null) {
        listOf(
            stringResource(R.string.mode_check),
            sectionLabel,
            stringResource(R.string.summary_of_limit, duration, limit),
        ).joinToString(" · ")
    } else {
        (listOf(sectionLabel) + session.questionTypes.map { it.label() } + duration).joinToString(" · ")
    }
}

/** Ссылка-действие — цветом текста; томатный остаётся у главной кнопки (DESIGN.md). */
@Composable
fun LinkText(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = GpSize.tapTarget)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(text = text, style = Gp.type.action, color = Gp.colors.text)
    }
}

@Composable
internal fun startProblemText(problem: StartProblem): String =
    stringResource(
        when (problem) {
            StartProblem.NoQuestions -> R.string.builder_no_questions
            StartProblem.Offline -> R.string.builder_start_offline
            StartProblem.Failed -> R.string.builder_start_failed
        },
    )

private fun unansweredCount(s: Screen): Int =
    s.training.session.items.count {
        !(s.training.answer(it.position)?.response ?: emptyResponse(it.question)).isComplete(it.question)
    }

@Composable
private fun PreviousButton(
    s: Screen,
    actions: SessionActions,
) {
    IconButton(onClick = actions.onPrevious, enabled = s.position > 0, modifier = Modifier.testTag("question.previous")) {
        Icon(painterResource(R.drawable.ic_arrow_back), stringResource(R.string.question_previous), tint = Gp.colors.text)
    }
}
