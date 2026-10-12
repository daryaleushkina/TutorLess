package dev.greprepapp.app.feature.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import dev.greprepapp.api.ApiFailure
import dev.greprepapp.api.models.Exam
import dev.greprepapp.api.models.Section
import dev.greprepapp.api.models.TrainingMode
import dev.greprepapp.api.models.TrainingRequest
import dev.greprepapp.api.models.TrainingSource
import dev.greprepapp.app.R
import dev.greprepapp.app.feature.training.BuilderPrefill
import dev.greprepapp.app.feature.training.BuilderViewModel
import dev.greprepapp.app.feature.training.ContinueTraining
import dev.greprepapp.app.feature.training.StartProblem
import dev.greprepapp.app.feature.training.label
import dev.greprepapp.app.ui.StatusLine
import dev.greprepapp.app.ui.label
import dev.greprepapp.design.Gp
import dev.greprepapp.design.GpPrimaryButton
import greprep.design.GpLayout
import greprep.design.GpOpacity
import greprep.design.GpRadius
import greprep.design.GpSpace
import kotlin.math.roundToInt

/** Разумное умолчание только из доступных типов; история приходит с /home, без подмены статистики на устройстве. */
fun ShellState.startRequest(): TrainingRequest? {
    val available =
        options?.types?.filter {
            it.topics.sumOf { topic ->
                topic.available.easy + topic.available.medium + topic.available.hard
            } > 0
        }
            ?: return null
    val type = available.firstOrNull() ?: return null
    val selectedExam = exam ?: return null
    // История может пережить удаление контента; не предлагаем запуск недоступного раздела или другого экзамена.
    home
        ?.lastTraining
        ?.takeIf { last ->
            last.request.exam == selectedExam && last.request.questionTypes.isNotEmpty() &&
                last.request.questionTypes.all { questionType ->
                    available.any { it.section == last.request.section && it.questionType == questionType }
                }
        }?.let {
            return it.request.copy(
                source = null,
                count =
                    if (it.request.mode ==
                        TrainingMode.CHECK
                    ) {
                        BuilderViewModel.checkCount(options, it.request.section)
                    } else {
                        it.propertySize
                    },
            )
        }
    return TrainingRequest(
        selectedExam,
        type.section,
        setOf(type.questionType),
        minOf(
            options.maxQuestions,
            10,
            type.topics.sumOf {
                it.available.easy +
                    it.available.medium +
                    it.available.hard
            },
        ),
        TrainingMode.PRACTICE,
    )
}

@Composable
fun TrainingHome(
    state: ShellState,
    action: HomeAction,
    active: ContinueTraining?,
    onRefresh: () -> Unit,
    onStart: (TrainingRequest) -> Unit,
    onBuilder: (BuilderPrefill) -> Unit,
    onContinue: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth().testTag("training.home"), verticalArrangement = Arrangement.spacedBy(GpSpace.s24)) {
        if (state.home == null || state.options == null) {
            if (state.loading) {
                Column(Modifier.testTag("home.loading"), verticalArrangement = Arrangement.spacedBy(GpSpace.s16)) {
                    Surface(
                        color = Gp.colors.surface,
                        shape = RoundedCornerShape(GpRadius.l),
                        modifier =
                            Modifier.fillMaxWidth().height(GpSpace.s72 * 2),
                    ) {}
                    repeat(3) {
                        Surface(
                            color = Gp.colors.surface,
                            shape = RoundedCornerShape(GpRadius.m),
                            modifier = Modifier.fillMaxWidth().height(GpSpace.s64),
                        ) {}
                    }
                }
            } else {
                Column(Modifier.testTag("home.unavailable"), verticalArrangement = Arrangement.spacedBy(GpSpace.s12)) {
                    Text(
                        stringResource(
                            if (state.problem ==
                                ApiFailure.Offline
                            ) {
                                R.string.home_offline_title
                            } else {
                                R.string.home_failed_title
                            },
                        ),
                        style = Gp.type.h2,
                    )
                    Text(
                        stringResource(
                            if (state.problem ==
                                ApiFailure.Offline
                            ) {
                                R.string.home_offline_message
                            } else {
                                R.string.home_failed_message
                            },
                        ),
                        color = Gp.colors.text2,
                    )
                    TextButton(onRefresh, Modifier.testTag("home.retry")) { Text(stringResource(R.string.home_retry)) }
                }
            }
            return@Column
        }
        if (state.problem !=
            null
        ) {
            StatusLine(
                R.drawable.ic_wifi_off,
                stringResource(
                    if (state.problem ==
                        ApiFailure.Offline
                    ) {
                        R.string.home_stale_offline
                    } else {
                        R.string.home_stale_failed
                    },
                ),
                Modifier.testTag("home.stale"),
            )
        }
        val request = state.startRequest()
        val usingLast = state.home.lastTraining?.let { it.request.copy(source = null, count = it.propertySize) == request } == true
        val primary: @Composable () -> Unit = {
            Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s24)) {
                active?.let {
                    ShellRow(
                        stringResource(R.string.training_continue),
                        stringResource(
                            R.string.home_continue,
                            it.position + 1,
                            it.total,
                            it.types.joinToString(" · ") { type -> type.displayName() },
                        ),
                        "home.continue",
                        icon = R.drawable.ic_resume,
                        onClick = { onContinue(it.trainingId) },
                    )
                }
                if (request != null) {
                    Surface(color = Gp.colors.surface, shape = RoundedCornerShape(GpRadius.l)) {
                        Column(Modifier.fillMaxWidth().padding(GpSpace.s20), verticalArrangement = Arrangement.spacedBy(GpSpace.s12)) {
                            Text(
                                request.questionTypes.joinToString(" · ") { it.displayName() },
                                style = if (Gp.isWide) Gp.type.startTitleWide else Gp.type.startTitle,
                            )
                            val mode =
                                if (!usingLast) {
                                    ""
                                } else {
                                    " · " +
                                        stringResource(
                                            if (request.mode ==
                                                TrainingMode.PRACTICE
                                            ) {
                                                R.string.mode_practice
                                            } else {
                                                R.string.mode_check
                                            },
                                        )
                                }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(GpSpace.s8)) {
                                Dot(request.section)
                                Text(
                                    stringResource(
                                        R.string.home_start_meta,
                                        request.section.label(),
                                        androidx.compose.ui.res.pluralStringResource(
                                            R.plurals.home_questions,
                                            request.count,
                                            request.count,
                                        ),
                                        mode,
                                        BuilderViewModel.minutes(state.options, request),
                                    ),
                                    style = Gp.type.meta,
                                    color = Gp.colors.text2,
                                )
                            }
                            Text(
                                stringResource(
                                    if (!usingLast) {
                                        R.string.home_first_note
                                    } else {
                                        R.string.home_last_note
                                    },
                                ),
                                style = Gp.type.meta,
                                color = Gp.colors.text2,
                            )
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(GpSpace.s12)) {
                                GpPrimaryButton(
                                    stringResource(
                                        if (action.starting) R.string.training_starting else R.string.training_start,
                                    ),
                                    {
                                        onStart(request)
                                    },
                                    Modifier.weight(1f).testTag("home.start"),
                                    enabled = !action.starting,
                                )
                                IconButton({
                                    onBuilder(BuilderPrefill(request.section, request.questionTypes.firstOrNull(), request.exam))
                                }, Modifier.background(Gp.colors.surface2, CircleShape).testTag("home.configure")) {
                                    Icon(painterResource(R.drawable.ic_sliders), stringResource(R.string.home_configure))
                                }
                            }
                            action.problem?.let {
                                StatusLine(
                                    R.drawable.ic_wifi_off,
                                    stringResource(
                                        when (it) {
                                            StartProblem.Offline -> R.string.home_start_offline
                                            StartProblem.NoQuestions -> R.string.builder_no_questions
                                            StartProblem.Failed -> R.string.builder_start_failed
                                        },
                                    ),
                                    Modifier.testTag("home.startProblem"),
                                )
                            }
                        }
                    }
                } else if (state.exam == Exam.TOEFL) {
                    Text(
                        stringResource(R.string.home_empty_toefl),
                        style = Gp.type.lead,
                        color = Gp.colors.text2,
                        modifier = Modifier.widthIn(max = GpLayout.textMax),
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s12)) {
                    Text(stringResource(R.string.home_sections), style = Gp.type.h2, modifier = Modifier.semantics { heading() })
                    Surface(color = Gp.colors.surface, shape = RoundedCornerShape(GpRadius.l)) {
                        Column {
                            state.exams.firstOrNull { it.id == state.exam }?.sections?.filter { it != Section.WORDS }?.forEach { section ->
                                val types =
                                    state.options.types.filter {
                                        it.section == section &&
                                            it.topics.sumOf { topic ->
                                                topic.available.easy + topic.available.medium + topic.available.hard
                                            } >
                                            0
                                    }
                                val stats = state.home.sections.firstOrNull { it.section == section }
                                ShellRow(
                                    section.label(),
                                    if (types.isNotEmpty()) {
                                        types.joinToString(" · ") {
                                            it.questionType.displayName()
                                        }
                                    } else {
                                        stringResource(section.description())
                                    },
                                    "home.section.${section.value}",
                                    enabled = types.isNotEmpty(),
                                    dot = section,
                                    value = stats?.takeIf { it.total > 0 }?.let { "${(100.0 * it.correct / it.total).roundToInt()} %" },
                                    onClick = {
                                        onBuilder(
                                            BuilderPrefill(section, types.firstOrNull()?.questionType, state.exam ?: Exam.GRE),
                                        )
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
        val secondary: @Composable () -> Unit = {
            Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s24)) {
                if (state.home.mistakes > 0 && request != null) {
                    ShellRow(
                        stringResource(
                            R.string.home_mistakes,
                        ),
                        androidx.compose.ui.res.pluralStringResource(
                            R.plurals.home_mistakes_count,
                            state.home.mistakes,
                            state.home.mistakes,
                        ),
                        "home.mistakes",
                        icon = R.drawable.ic_repeat,
                        onClick = {
                            onStart(
                                request.copy(
                                    questionTypes =
                                        state.options.types
                                            .filter {
                                                it.section ==
                                                    request.section &&
                                                    it.topics.sumOf { topic ->
                                                        topic.available.easy + topic.available.medium + topic.available.hard
                                                    } >
                                                    0
                                            }.map { it.questionType }
                                            .toSet(),
                                    count = minOf(10, state.home.mistakes),
                                    source = TrainingSource.MISTAKES,
                                    topicIds = null,
                                    difficulty = null,
                                ),
                            )
                        },
                    )
                }
                state.home.weakSpot?.let { weak ->
                    ShellRow(
                        stringResource(
                            R.string.home_weak,
                            weak.questionType.displayName(),
                        ),
                        stringResource(R.string.home_accuracy, weak.section.label(), weak.accuracy.roundToInt()),
                        "home.weak",
                        icon = R.drawable.ic_target,
                        onClick = {
                            onBuilder(
                                BuilderPrefill(
                                    weak.section,
                                    weak.questionType,
                                    state.exam ?: Exam.GRE,
                                ),
                            )
                        },
                    )
                }
                if (state.home.sections.any { it.total > 0 }) {
                    Surface(
                        color = Gp.colors.surface,
                        shape = RoundedCornerShape(GpRadius.l),
                        modifier = Modifier.fillMaxWidth().testTag("home.week"),
                    ) {
                        Column(Modifier.padding(GpSpace.s20), verticalArrangement = Arrangement.spacedBy(GpSpace.s8)) {
                            Text(stringResource(R.string.home_week), style = Gp.type.meta, color = Gp.colors.text3)
                            Text(
                                stringResource(
                                    R.string.home_week_time,
                                    androidx.compose.ui.res
                                        .pluralStringResource(R.plurals.home_days, state.home.week.days, state.home.week.days),
                                    state.home.week.minutes,
                                ),
                                style = Gp.type.h2,
                            )
                            Text(
                                androidx.compose.ui.res.pluralStringResource(
                                    R.plurals.home_answers,
                                    state.home.week.answers,
                                    state.home.week.answers,
                                ),
                                style = Gp.type.meta,
                                color = Gp.colors.text3,
                            )
                        }
                    }
                }
            }
        }
        if (Gp.isWide && state.home.sections.any { it.total > 0 }) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(GpSpace.s28)) {
                Column(Modifier.weight(1f)) { primary() }
                Column(Modifier.width(GpLayout.textMax)) { secondary() }
            }
        } else {
            primary()
            secondary()
        }
    }
}

fun dev.greprepapp.api.models.QuestionType.displayName(): String =
    when (this) {
        dev.greprepapp.api.models.QuestionType.TEXT_COMPLETION -> "Text Completion"
        dev.greprepapp.api.models.QuestionType.SENTENCE_EQUIVALENCE -> "Sentence Equivalence"
        dev.greprepapp.api.models.QuestionType.QUANTITATIVE_COMPARISON -> "Quantitative Comparison"
        dev.greprepapp.api.models.QuestionType.MULTIPLE_CHOICE -> "Multiple Choice"
    }

private fun Section.description(): Int =
    when (this) {
        Section.VERBAL -> R.string.home_verbal_types
        Section.QUANT -> R.string.home_quant_types
        Section.ESSAY -> R.string.home_essay_types
        Section.READING -> R.string.home_reading_types
        Section.LISTENING -> R.string.home_listening_types
        Section.WRITING -> R.string.home_writing_types
        Section.SPEAKING -> R.string.home_speaking_types
        Section.WORDS -> R.string.placeholder_words
    }

@Composable
private fun Dot(
    section: Section,
    opacity: Float = 1f,
) {
    val color =
        when (section) {
            Section.VERBAL -> Gp.colors.verbal
            Section.QUANT -> Gp.colors.quant
            Section.ESSAY -> Gp.colors.essay
            Section.READING -> Gp.colors.reading
            Section.LISTENING -> Gp.colors.listening
            Section.WRITING -> Gp.colors.writing
            Section.SPEAKING -> Gp.colors.speaking
            Section.WORDS -> Gp.colors.words
        }
    Spacer(Modifier.size(GpSpace.s8).background(color.copy(alpha = opacity), CircleShape))
}

@Composable
fun ShellRow(
    title: String,
    subtitle: String,
    tag: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    dot: Section? = null,
    @androidx.annotation.DrawableRes icon: Int? = null,
    value: String? = null,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        color = Gp.colors.surface,
        shape = RoundedCornerShape(GpRadius.m),
        modifier = modifier.fillMaxWidth().testTag(tag),
    ) {
        Row(
            Modifier.padding(GpSpace.s16),
            horizontalArrangement = Arrangement.spacedBy(GpSpace.s12),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            dot?.let { Dot(it, if (enabled) 1f else GpOpacity.DISABLED) }
            icon?.let {
                Box(Modifier.size(GpSpace.s32).background(Gp.colors.surface2, CircleShape), contentAlignment = Alignment.Center) {
                    Icon(painterResource(it), null, modifier = Modifier.size(GpSpace.s20), tint = Gp.colors.text2)
                }
            }
            val opacity = if (enabled) 1f else GpOpacity.DISABLED
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(GpSpace.s4)) {
                Text(title, style = Gp.type.h3, color = Gp.colors.text.copy(alpha = opacity))
                Text(subtitle, style = Gp.type.meta, color = Gp.colors.text3.copy(alpha = opacity))
            }
            value?.let {
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        it,
                        style = Gp.type.h3,
                        color =
                            when (dot) {
                                Section.VERBAL -> Gp.colors.verbalInk
                                Section.QUANT -> Gp.colors.quantInk
                                Section.ESSAY -> Gp.colors.essayInk
                                Section.READING -> Gp.colors.readingInk
                                Section.LISTENING -> Gp.colors.listeningInk
                                Section.WRITING -> Gp.colors.writingInk
                                Section.SPEAKING -> Gp.colors.speakingInk
                                Section.WORDS -> Gp.colors.wordsInk
                                null -> Gp.colors.text
                            },
                    )
                    Text(stringResource(R.string.home_correct), style = Gp.type.caption, color = Gp.colors.text3)
                }
            }
            if (enabled) {
                Icon(
                    painterResource(R.drawable.ic_chevron_right),
                    null,
                    modifier = Modifier.size(GpSpace.s20),
                    tint = Gp.colors.text3,
                )
            }
        }
    }
}
