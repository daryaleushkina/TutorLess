package dev.greprepapp.app.feature.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import dev.greprepapp.api.ApiFailure
import dev.greprepapp.api.models.Exam
import dev.greprepapp.app.R
import dev.greprepapp.app.ui.StatusLine
import dev.greprepapp.app.ui.label
import dev.greprepapp.design.Gp
import dev.greprepapp.design.SectionBackground
import greprep.design.GpLayout
import greprep.design.GpRadius
import greprep.design.GpSpace

@Composable
fun ExamPicker(
    state: ShellState,
    onChoose: (Exam) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val content: @Composable () -> Unit = {
        Column(Modifier.widthIn(max = GpLayout.contentMax).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(GpSpace.s24)) {
            Text(stringResource(R.string.exam_pick_title), style = if (Gp.isWide) Gp.type.h1Wide else Gp.type.h1)
            Text(stringResource(R.string.exam_pick_message), style = Gp.type.lead, color = Gp.colors.text2)
            ExamChoices(state, false, onChoose)
            if (state.loading && state.exams.isEmpty()) PickerProgress(Modifier.size(GpSpace.s24))
            if (state.problem != null && state.exams.isEmpty()) TextButton(onRetry) { Text(stringResource(R.string.home_retry)) }
        }
    }
    SectionBackground(modifier = modifier) {
        if (Gp.isWide) {
            Box(
                Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(GpLayout.gutterWide),
                contentAlignment = Alignment.Center,
            ) {
                Box(Modifier.align(Alignment.TopStart)) { Brand() }
                Column(Modifier.widthIn(max = GpLayout.contentMax).fillMaxWidth().verticalScroll(rememberScrollState())) { content() }
            }
        } else {
            Column(
                Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(
                        WindowInsets.safeDrawing,
                    ).verticalScroll(rememberScrollState())
                    .padding(GpLayout.gutter),
            ) {
                Brand()
                Spacer(Modifier.heightIn(min = GpSpace.s48).weight(1f))
                content()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExamSheet(
    state: ShellState,
    onChoose: (Exam) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ModalBottomSheet(modifier = modifier, onDismissRequest = onDismiss, containerColor = Gp.colors.surface, contentColor = Gp.colors.text) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = GpLayout.gutter, vertical = GpSpace.s24),
            verticalArrangement = Arrangement.spacedBy(GpSpace.s20),
        ) {
            Text(stringResource(R.string.tab_exam), style = Gp.type.h2)
            ExamChoices(state, true, onChoose)
            Text(stringResource(R.string.exam_change_note), style = Gp.type.meta, color = Gp.colors.text3)
        }
    }
}

@Composable
private fun ExamChoices(
    state: ShellState,
    sheet: Boolean,
    onChoose: (Exam) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s12), modifier = Modifier.testTag("exam.picker")) {
        androidx.compose.foundation.layout.FlowRow(
            maxItemsInEachRow =
                if (Gp.isWide &&
                    !sheet
                ) {
                    2
                } else {
                    1
                },
            horizontalArrangement = Arrangement.spacedBy(GpSpace.s16),
            verticalArrangement = Arrangement.spacedBy(GpSpace.s12),
        ) {
            state.exams.forEach { info ->
                val selected = info.id == state.exam
                Surface(
                    onClick = { onChoose(info.id) },
                    enabled = state.choosing == null,
                    color = Gp.colors.surface,
                    shape = RoundedCornerShape(GpRadius.l),
                    modifier =
                        (
                            if (Gp.isWide &&
                                !sheet
                            ) {
                                Modifier.weight(1f)
                            } else {
                                Modifier.fillMaxWidth()
                            }
                        ).alpha(if (state.choosing != null && state.choosing != info.id) greprep.design.GpOpacity.DISABLED else 1f)
                            .testTag("exam.pick.${info.id.value}")
                            .semantics {
                                this.selected =
                                    selected
                            },
                ) {
                    Row(
                        Modifier.padding(GpSpace.s16),
                        horizontalArrangement = Arrangement.spacedBy(GpSpace.s16),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Surface(
                            color =
                                if (info.id ==
                                    Exam.GRE
                                ) {
                                    Gp.colors.examGre
                                } else {
                                    Gp.colors.examToefl
                                },
                            contentColor = Gp.colors.onAccent,
                            shape = RoundedCornerShape(GpRadius.m),
                        ) {
                            Box(Modifier.size(GpSpace.s72, GpSpace.s56), contentAlignment = Alignment.Center) {
                                Text(info.id.value.uppercase(), style = Gp.type.examName)
                            }
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(GpSpace.s4)) {
                            Text(
                                stringResource(
                                    if (info.id ==
                                        Exam.GRE
                                    ) {
                                        R.string.exam_gre_goal
                                    } else {
                                        R.string.exam_toefl_goal
                                    },
                                ),
                                style = Gp.type.h3,
                            )
                            val sectionNames = mutableListOf<String>()
                            for (section in info.sections) sectionNames += section.label()
                            Text(
                                sectionNames.joinToString(" · "),
                                style = Gp.type.meta,
                                color = Gp.colors.text3,
                            )
                        }
                        if (state.choosing == info.id) {
                            PickerProgress(Modifier.size(GpSpace.s20))
                        } else if (!sheet ||
                            selected
                        ) {
                            Icon(
                                painterResource(if (sheet) R.drawable.ic_check else R.drawable.ic_chevron_right),
                                null,
                                modifier = Modifier.size(GpSpace.s20),
                            )
                        }
                    }
                }
            }
        }
        state.choiceProblem?.let {
            StatusLine(
                R.drawable.ic_error,
                stringResource(
                    if (it ==
                        ApiFailure.Offline
                    ) {
                        R.string.exam_pick_offline
                    } else if (sheet) {
                        R.string.exam_change_failed
                    } else {
                        R.string.exam_pick_failed
                    },
                ),
                Modifier.testTag("exam.error"),
            )
        }
    }
}

@Composable
fun Brand(modifier: Modifier = Modifier) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(GpSpace.s8)) {
        Surface(color = Gp.colors.accent, shape = RoundedCornerShape(GpRadius.s), modifier = Modifier.size(GpSpace.s20)) {}
        Text(stringResource(R.string.app_name), style = Gp.type.h2)
    }
}

/** В эталоне нужна неподвижная форма индикатора; в приложении — системная анимация. */
@Composable
private fun PickerProgress(modifier: Modifier = Modifier) {
    if (androidx.compose.ui.platform.LocalInspectionMode.current) {
        CircularProgressIndicator(progress = { PREVIEW_PROGRESS }, modifier = modifier)
    } else {
        CircularProgressIndicator(modifier = modifier)
    }
}

private const val PREVIEW_PROGRESS = 0.5f
