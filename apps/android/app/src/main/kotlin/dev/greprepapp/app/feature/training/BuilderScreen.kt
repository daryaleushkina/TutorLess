package dev.greprepapp.app.feature.training

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.greprepapp.api.models.Difficulty
import dev.greprepapp.api.models.Section
import dev.greprepapp.api.models.TrainingMode
import dev.greprepapp.api.models.TrainingOptions
import dev.greprepapp.api.models.TrainingPreset
import dev.greprepapp.app.R
import dev.greprepapp.app.feature.training.BuilderViewModel.Content
import dev.greprepapp.app.feature.training.BuilderViewModel.UiState
import dev.greprepapp.app.ui.EmptyState
import dev.greprepapp.app.ui.LoadingState
import dev.greprepapp.app.ui.NestedScreen
import dev.greprepapp.app.ui.StatusLine
import dev.greprepapp.app.ui.label
import dev.greprepapp.design.Gp
import dev.greprepapp.design.GpPrimaryButton
import greprep.design.GpLayout
import greprep.design.GpRadius
import greprep.design.GpSize
import greprep.design.GpSpace

/** Действия конструктора одним набором — снимки экранов подставляют пустые. */
class BuilderActions(
    val onBack: () -> Unit = {},
    val onRetry: () -> Unit = {},
    val onPreset: (Int) -> Unit = {},
    val onSection: (Section) -> Unit = {},
    val onType: (dev.greprepapp.api.models.QuestionType) -> Unit = {},
    val onMixed: () -> Unit = {},
    val onToggleAllTopics: () -> Unit = {},
    val onCount: (String) -> Unit = {},
    val onMode: (TrainingMode) -> Unit = {},
    val onTopics: () -> Unit = {},
    val onCloseTopics: () -> Unit = {},
    val onToggleTopic: (String) -> Unit = {},
    val onDifficulty: (Difficulty?) -> Unit = {},
    val onStart: () -> Unit = {},
)

/** Конструктор тренировки (макеты R1, R2). */
@Composable
fun BuilderScreen(
    prefill: BuilderPrefill?,
    onBack: () -> Unit,
    onStarted: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: BuilderViewModel =
        hiltViewModel<BuilderViewModel, BuilderViewModel.Factory>(key = prefill.toString()) { it.create(prefill) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.started) {
        state.started?.let {
            viewModel.consumeStarted()
            onStarted(it)
        }
    }
    BackHandler(enabled = state.editingTopics, onBack = viewModel::closeTopics)
    BuilderContent(
        state = state,
        actions =
            BuilderActions(
                onBack = onBack,
                onRetry = viewModel::load,
                onPreset = viewModel::selectPreset,
                onSection = viewModel::setSection,
                onType = viewModel::setType,
                onMixed = viewModel::setMixed,
                onToggleAllTopics = viewModel::toggleAllTopics,
                onCount = viewModel::setCount,
                onMode = viewModel::setMode,
                onTopics = viewModel::openTopics,
                onCloseTopics = viewModel::closeTopics,
                onToggleTopic = viewModel::toggleTopic,
                onDifficulty = viewModel::setDifficulty,
                onStart = viewModel::start,
            ),
        modifier = modifier,
    )
}

@Composable
fun BuilderContent(
    state: UiState,
    actions: BuilderActions,
    modifier: Modifier = Modifier,
) {
    TrainingKeyboard(onKey = { key ->
        if (key == Key.Enter && !state.starting && state.content is Content.Ready) {
            if (state.editingTopics && BuilderViewModel.available(state.content.options, state.content.form) > 0) {
                actions.onCloseTopics()
            } else if (BuilderViewModel.requestOf(state.content) != null) {
                actions.onStart()
            }
            true
        } else {
            false
        }
    }, modifier = modifier) {
        val content = state.content
        if (state.editingTopics && content is Content.Ready) {
            TopicsContent(content, actions)
            return@TrainingKeyboard
        }
        NestedScreen(title = stringResource(R.string.training_new), onBack = actions.onBack) { padding ->
            when (content) {
                Content.Loading -> {
                    LoadingState(
                        text = stringResource(R.string.training_loading),
                        modifier = Modifier.padding(padding).testTag("builder.loading"),
                    )
                }

                is Content.Unavailable -> {
                    val offline = content.problem == TrainingProblem.Offline
                    EmptyState(
                        title = stringResource(if (offline) R.string.training_offline_title else R.string.training_failed_title),
                        message = stringResource(if (offline) R.string.training_offline_message else R.string.training_failed_message),
                        icon = if (offline) R.drawable.ic_wifi_off else R.drawable.ic_error,
                        action = stringResource(R.string.training_retry),
                        onAction = actions.onRetry,
                        modifier = Modifier.padding(padding).testTag("builder.unavailable"),
                    )
                }

                is Content.Ready -> {
                    BuilderForm(content, state, actions, padding)
                }
            }
        }
    }
}

@Composable
private fun BuilderForm(
    c: Content.Ready,
    state: UiState,
    actions: BuilderActions,
    padding: PaddingValues,
) {
    val request = BuilderViewModel.requestOf(c)
    Column(modifier = Modifier.fillMaxSize().padding(padding).imePadding()) {
        Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            Column(
                modifier =
                    Modifier
                        .widthIn(max = GpLayout.contentMax + GpLayout.gutter * 2)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = GpLayout.gutter, vertical = GpSpace.s8)
                        .testTag("builder.form"),
                verticalArrangement = Arrangement.spacedBy(GpSpace.s24),
            ) {
                CustomCard(c, actions)
            }
        }

        BottomActions(note = state.problem?.let { problem -> { BuilderProblem(problem) } }) {
            val label =
                if (request == null) {
                    stringResource(R.string.builder_nothing)
                } else {
                    stringResource(
                        R.string.builder_start,
                        pluralStringResource(R.plurals.questions_count, request.count, request.count),
                        BuilderViewModel.minutes(c.options, request),
                    )
                }
            GpPrimaryButton(
                text = if (state.starting) stringResource(R.string.builder_starting) else label,
                onClick = actions.onStart,
                enabled = request != null && !state.starting,
                modifier = Modifier.fillMaxWidth().testTag("builder.start"),
            )
        }
    }
}

@Composable
private fun BuilderProblem(problem: StartProblem) {
    StatusLine(
        icon = if (problem == StartProblem.Offline) R.drawable.ic_wifi_off else R.drawable.ic_error,
        text = startProblemText(problem),
        modifier = Modifier.testTag("builder.problem"),
    )
}

/** Своя сборка: без рубрики, поля показывают то, что выбрано (макет R1). */
@Composable
private fun CustomCard(
    c: Content.Ready,
    actions: BuilderActions,
) {
    val f = c.form
    Group {
        FieldRow(label = stringResource(R.string.builder_section)) {
            val sections =
                c.options.types
                    .filter { t ->
                        t.topics.any { it.available.easy + it.available.medium + it.available.hard > 0 }
                    }.map { it.section }
                    .distinct()
            SegmentedChoice(
                options = sections.map { it.label() },
                selected = sections.indexOf(f.section),
                onSelect = { actions.onSection(sections[it]) },
                tags = sections.map { "builder.section.${it.value}" },
            )
        }
        Divider()
        TypeRow(c, actions)
        Divider()
        if (f.mode == TrainingMode.PRACTICE) {
            FieldRow(label = stringResource(R.string.builder_count)) {
                ContentChoices(
                    options = BuilderViewModel.PRACTICE_COUNTS.map(Int::toString),
                    selected = BuilderViewModel.PRACTICE_COUNTS.map(Int::toString).indexOf(f.countText),
                    onSelect = { actions.onCount(BuilderViewModel.PRACTICE_COUNTS.map(Int::toString)[it]) },
                    modifier = Modifier.testTag("builder.count"),
                    tags = BuilderViewModel.PRACTICE_COUNTS.map(Int::toString).map { "builder.count.$it" },
                )
            }
            Divider()
        }
        Column(modifier = Modifier.padding(bottom = GpSpace.s12)) {
            FieldRow(label = stringResource(R.string.builder_mode)) {
                SegmentedChoice(
                    options = listOf(stringResource(R.string.mode_practice), stringResource(R.string.mode_check)),
                    selected = if (f.mode == TrainingMode.CHECK) 1 else 0,
                    onSelect = { actions.onMode(if (it == 1) TrainingMode.CHECK else TrainingMode.PRACTICE) },
                    tags = listOf("builder.mode.practice", "builder.mode.check"),
                )
            }
            Text(
                text =
                    if (f.mode == TrainingMode.CHECK) {
                        val r = BuilderViewModel.requestOf(c)
                        val minutes = r?.let { BuilderViewModel.minutes(c.options, it) } ?: 0
                        val count = r?.count ?: 0
                        stringResource(
                            R.string.mode_check_section_hint,
                            pluralStringResource(R.plurals.training_minutes, minutes, minutes),
                            pluralStringResource(R.plurals.questions_count, count, count),
                        )
                    } else {
                        stringResource(R.string.mode_practice_hint)
                    },
                style = Gp.type.meta,
                color = Gp.colors.text2,
                modifier = Modifier.padding(horizontal = GpSpace.s16),
            )
        }
        Divider()
        val topics = BuilderViewModel.topicsOf(c.options, f)
        val selected = f.topicIds?.size ?: topics.size
        LinkRow(
            label = stringResource(R.string.builder_topics),
            value =
                listOf(
                    if (f.topicIds ==
                        null
                    ) {
                        stringResource(R.string.builder_topics_all)
                    } else {
                        stringResource(R.string.builder_topics_some, selected, topics.size)
                    },
                    stringResource(
                        when (f.difficulty) {
                            null -> R.string.difficulty_any
                            Difficulty.EASY -> R.string.difficulty_easy
                            Difficulty.MEDIUM -> R.string.difficulty_medium
                            Difficulty.HARD -> R.string.difficulty_hard
                        },
                    ).lowercase(LocalConfiguration.current.locales[0]),
                ).joinToString(" · "),
            onClick = actions.onTopics,
            enabled = topics.isNotEmpty(),
            tag = "builder.topics",
        )
    }
}

/** «Тип» — меню Material у строки: на Android это родной выбор из короткого списка. */
@Composable
private fun TypeRow(
    c: Content.Ready,
    actions: BuilderActions,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    val types =
        c.options.types.filter {
            it.section == c.form.section &&
                it.topics.any { topic -> topic.available.easy + topic.available.medium + topic.available.hard > 0 }
        }
    Box {
        LinkRow(
            label = stringResource(R.string.builder_type),
            value = if (c.form.mixed) stringResource(R.string.builder_all_types) else c.form.type.label(),
            onClick = { open = true },
            tag = "builder.type",
            valueStyle = Gp.type.explainBody.copy(localeList = English),
        )
        if (open) {
            TrainingSheet(onDismiss = { open = false }, tag = "builder.types.sheet") {
                Text(stringResource(R.string.builder_type), style = Gp.type.h2)
                types.filter { it.topics.isNotEmpty() }.forEach { t ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = !c.form.mixed && c.form.type == t.questionType,
                                role = Role.RadioButton,
                                onClick = {
                                    open = false
                                    actions.onType(t.questionType)
                                },
                            ).heightIn(min = GpSize.opt)
                            .testTag("builder.type.${t.questionType.value}"),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = !c.form.mixed && c.form.type == t.questionType, onClick = null)
                        Text(t.questionType.label(), style = Gp.type.opt)
                    }
                }
                if (c.form.mode == TrainingMode.CHECK) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = c.form.mixed,
                                role = Role.RadioButton,
                                onClick = {
                                    open = false
                                    actions.onMixed()
                                },
                            ).heightIn(min = GpSize.opt)
                            .testTag("builder.type.all"),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = c.form.mixed, onClick = null)
                        Text(stringResource(R.string.builder_all_types), style = Gp.type.opt)
                    }
                }
            }
        }
    }
}

/** Секция-список на плотной поверхности (компонент card). */
@Composable
private fun Group(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Surface(color = Gp.colors.surface, shape = RoundedCornerShape(GpRadius.l), modifier = modifier.fillMaxWidth()) {
        Column { content() }
    }
}

@Composable
private fun Divider() {
    HorizontalDivider(thickness = GpSize.hairline / 2, color = Gp.colors.line, modifier = Modifier.padding(start = GpSpace.s16))
}

@Composable
internal fun FieldRow(
    label: String,
    control: @Composable () -> Unit,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth().heightIn(min = GpSize.opt).padding(horizontal = GpSpace.s16, vertical = GpSpace.s8),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalArrangement = Arrangement.spacedBy(GpSpace.s8),
    ) {
        // FlowRow оставляет короткую подпись целой, перенося управление. Если даже сама
        // подпись шире строки, обычный перенос по словам сохраняет весь текст.
        Text(
            text = label,
            style = Gp.type.opt,
            color = Gp.colors.text,
            modifier = Modifier.padding(end = GpSpace.s12).align(Alignment.CenterVertically),
        )
        Box(Modifier.align(Alignment.CenterVertically)) { control() }
    }
}

/** Строка, открывающая выбор: значение справа и стрелка — она ведёт дальше (DESIGN.md, «Ссылки»). */
@Composable
private fun LinkRow(
    label: String,
    value: String,
    onClick: () -> Unit,
    tag: String,
    enabled: Boolean = true,
    valueStyle: TextStyle = Gp.type.explainBody,
) {
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .heightIn(min = GpSize.opt)
            .padding(horizontal = GpSpace.s16, vertical = GpSpace.s8)
            .semantics(mergeDescendants = true) { contentDescription = "$label: $value" }
            .testTag(tag),
    ) {
        val needed =
            with(density) {
                (
                    measurer.measure(label, Gp.type.opt, maxLines = 1).size.width +
                        measurer.measure(value, valueStyle, maxLines = 1).size.width
                ).toDp()
            } + GpSpace.s20 + GpSpace.s16
        if (needed > maxWidth) {
            Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s4)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(label, style = Gp.type.opt, modifier = Modifier.weight(1f))
                    Icon(painterResource(R.drawable.ic_chevron_right), null, tint = Gp.colors.text2, modifier = Modifier.size(GpSpace.s20))
                }
                Text(value, style = valueStyle, color = Gp.colors.text2)
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(GpSpace.s8)) {
                Text(label, style = Gp.type.opt, modifier = Modifier.weight(1f))
                Text(value, style = valueStyle, color = Gp.colors.text2)
                Icon(painterResource(R.drawable.ic_chevron_right), null, tint = Gp.colors.text2, modifier = Modifier.size(GpSpace.s20))
            }
        }
    }
}

/** «Темы и сложность» (макет R2): галочки тем с числом заданий и сложность; «Готово» — сколько заданий выйдет. */
@Composable
private fun TopicsContent(
    c: Content.Ready,
    actions: BuilderActions,
    modifier: Modifier = Modifier,
) {
    val f = c.form
    val topics = BuilderViewModel.topicsOf(c.options, f)
    val available = BuilderViewModel.available(c.options, f)
    val english = LocalConfiguration.current.locales[0].language == "en"
    val topicList: @Composable () -> Unit = {
        Text(
            text = (listOf(f.section.label(), f.type.label())).joinToString(" · "),
            style = Gp.type.meta,
            color = Gp.colors.text2,
        )
        Text(
            text =
                if (available < (f.count ?: 0)) {
                    pluralStringResource(R.plurals.topics_available_short, available, available, available)
                } else {
                    pluralStringResource(R.plurals.topics_available, available, available)
                },
            style = Gp.type.meta,
            color = Gp.colors.text2,
            modifier = Modifier.testTag("topics.available"),
        )
        LinkText(
            text = stringResource(if (f.topicIds?.isEmpty() == true) R.string.topics_select_all else R.string.topics_clear_all),
            onClick = actions.onToggleAllTopics,
            modifier = Modifier.testTag("topics.toggleAll"),
        )
        Group {
            topics.forEachIndexed { i, topic ->
                if (i > 0) Divider()
                val checked = f.topicIds == null || topic.id in f.topicIds
                val count =
                    when (f.difficulty) {
                        null -> topic.available.easy + topic.available.medium + topic.available.hard
                        Difficulty.EASY -> topic.available.easy
                        Difficulty.MEDIUM -> topic.available.medium
                        Difficulty.HARD -> topic.available.hard
                    }
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .toggleable(
                                value = checked,
                                role = Role.Checkbox,
                                onValueChange = { actions.onToggleTopic(topic.id) },
                            ).heightIn(min = GpSize.opt)
                            .padding(start = GpSpace.s16, end = GpSpace.s8)
                            .testTag("topic.${topic.id}"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(GpSpace.s8),
                ) {
                    Text(
                        text = topic.title.pick(english),
                        style = Gp.type.opt,
                        color = Gp.colors.text,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = count.toString(),
                        style = Gp.type.meta.copy(fontFeatureSettings = "tnum"),
                        color = Gp.colors.text2,
                    )
                    Checkbox(
                        checked = checked,
                        onCheckedChange = null,
                        colors = CheckboxDefaults.colors(checkedColor = Gp.colors.text, checkmarkColor = Gp.colors.bg),
                    )
                }
            }
        }
    }
    val difficulty: @Composable () -> Unit = {
        Text(text = stringResource(R.string.topics_difficulty), style = Gp.type.meta, color = Gp.colors.text2)
        SegmentedChoice(
            options =
                listOf(
                    stringResource(R.string.difficulty_any),
                    stringResource(R.string.difficulty_easy),
                    stringResource(R.string.difficulty_medium),
                    stringResource(R.string.difficulty_hard),
                ),
            selected = DIFFICULTIES.indexOf(f.difficulty),
            onSelect = { actions.onDifficulty(DIFFICULTIES[it]) },
            modifier = Modifier.fillMaxWidth(),
            tags = DIFFICULTIES.map { "topics.difficulty.${it?.value ?: "any"}" },
        )
    }
    NestedScreen(title = stringResource(R.string.builder_topics), onBack = actions.onCloseTopics, modifier = modifier) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
                if (Gp.isWide) {
                    TrainingSplit(PaddingValues(), "topics", topicList, difficulty)
                } else {
                    Column(
                        Modifier
                            .widthIn(max = GpLayout.contentMax + GpLayout.gutter * 2)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = GpLayout.gutter, vertical = GpSpace.s8)
                            .testTag("topics"),
                        verticalArrangement = Arrangement.spacedBy(GpSpace.s16),
                    ) {
                        topicList()
                        difficulty()
                    }
                }
            }
            BottomActions(
                note =
                    if (f.topicIds?.isEmpty() ==
                        true
                    ) {
                        { Text(stringResource(R.string.topics_choose_one), style = Gp.type.meta) }
                    } else {
                        null
                    },
            ) {
                GpPrimaryButton(
                    text = stringResource(R.string.topics_done, pluralStringResource(R.plurals.tasks_count, available, available)),
                    onClick = actions.onCloseTopics,
                    enabled = available > 0,
                    modifier = Modifier.fillMaxWidth().testTag("topics.done"),
                )
            }
        }
    }
}

private val DIFFICULTIES: List<Difficulty?> = listOf(null, Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD)
