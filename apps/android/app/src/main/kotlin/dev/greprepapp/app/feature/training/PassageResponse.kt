package dev.greprepapp.app.feature.training

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.movableContentOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextLayoutResult
import dev.greprepapp.api.models.Passage
import dev.greprepapp.api.models.Question
import dev.greprepapp.app.R
import dev.greprepapp.design.Gp
import greprep.design.GpLayout
import greprep.design.GpRadius
import greprep.design.GpSize
import greprep.design.GpSpace

/** У текста и вопроса свои состояния прокрутки; смена вкладки не удаляет сохранённое место. */
@Composable
internal fun ReadingQuestionLayout(
    padding: PaddingValues,
    question: Question,
    firstForPassage: Boolean,
    revealed: Boolean,
    tag: String = "question",
    content: @Composable () -> Unit,
) {
    val passage = checkNotNull(question.passage)
    val textScroll = rememberSaveable(passage.id, saver = ScrollState.Saver) { ScrollState(0) }
    val questionScroll = rememberSaveable(question.id, saver = ScrollState.Saver) { ScrollState(0) }
    var tab by rememberSaveable(question.id) { mutableIntStateOf(if (firstForPassage && !revealed) 0 else 1) }
    val currentContent by rememberUpdatedState(content)
    // Один экземпляр переносится между раскладками: поворот не сбрасывает состояние компонента ответа.
    val questionContent = remember { movableContentOf { currentContent() } }
    LaunchedEffect(revealed) { if (revealed) tab = 1 }
    if (Gp.isWide) {
        TrainingSplit(
            padding,
            tag,
            left = { PassageText(passage) },
            right = questionContent,
            leftScroll = textScroll,
            rightScroll = questionScroll,
        )
    } else {
        Column(Modifier.fillMaxSize().padding(padding)) {
            ReadingTabs(tab, onSelect = { tab = it })
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(if (tab == 0) textScroll else questionScroll)
                    .padding(horizontal = GpLayout.gutter, vertical = GpSpace.s8)
                    .testTag(if (tab == 0) "reading.text.scroll" else tag),
                verticalArrangement = Arrangement.spacedBy(GpSpace.s20),
            ) {
                if (tab == 0) PassageText(passage) else questionContent()
            }
        }
    }
}

@Composable
private fun ReadingTabs(
    selected: Int,
    onSelect: (Int) -> Unit,
) {
    Surface(
        color = Gp.colors.surface2,
        shape = RoundedCornerShape(GpRadius.full),
        modifier = Modifier.fillMaxWidth().padding(horizontal = GpLayout.gutter, vertical = GpSpace.s12),
    ) {
        Row(Modifier.fillMaxWidth().padding(GpSpace.s4).selectableGroup()) {
            listOf(stringResource(R.string.reading_text), stringResource(R.string.reading_question)).forEachIndexed { index, label ->
                Tab(
                    selected = index == selected,
                    onClick = { onSelect(index) },
                    modifier =
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(GpRadius.full))
                            .background(if (index == selected) Gp.colors.text else androidx.compose.ui.graphics.Color.Transparent)
                            .testTag(if (index == 0) "reading.text" else "reading.question"),
                    selectedContentColor = Gp.colors.bg,
                    unselectedContentColor = Gp.colors.text2,
                    text = { Text(label, style = Gp.type.meta) },
                )
            }
        }
    }
}

@Composable
internal fun PassageText(passage: Passage) {
    Column(Modifier.fillMaxWidth().testTag("passage"), verticalArrangement = Arrangement.spacedBy(GpSpace.s14)) {
        passage.paragraphs.forEachIndexed { index, paragraph ->
            Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s2)) {
                Text(stringResource(R.string.reading_paragraph, index + 1), style = Gp.type.caption, color = Gp.colors.text3)
                Text(
                    paragraph.sentences.joinToString(" ") { it.text },
                    style = Gp.type.lead.copy(localeList = English, lineHeight = Gp.type.explainBody.lineHeight),
                    color = Gp.colors.text,
                    modifier = Modifier.testTag("passage.paragraph.$index"),
                )
            }
        }
    }
}

/** В R8 ответ находится в тексте: каждая фраза — отдельная доступная цель, весь текст листается вместе. */
@Composable
internal fun SentenceResponse(
    question: Question,
    response: Response,
    revealed: Boolean,
    onEdit: (ResponseEdit) -> Unit,
) {
    val selected = (response as? Response.Sentence)?.sentenceId
    if (!revealed) Text(stringResource(R.string.question_select_sentence), style = Gp.type.meta, color = Gp.colors.text2)
    PlainPrompt(question)
    val passage = checkNotNull(question.passage)
    Column(
        Modifier.fillMaxWidth().selectableGroup().testTag("passage"),
        verticalArrangement = Arrangement.spacedBy(GpSpace.s14),
    ) {
        passage.paragraphs.forEachIndexed { paragraphIndex, paragraph ->
            Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s4)) {
                Text(stringResource(R.string.reading_paragraph, paragraphIndex + 1), style = Gp.type.caption, color = Gp.colors.text3)
                paragraph.sentences.forEachIndexed { sentenceIndex, sentence ->
                    var textLayout by remember(sentence.id) { mutableStateOf<TextLayoutResult?>(null) }
                    val underline = Gp.colors.lineStrong
                    val chosen = sentence.id == selected
                    val correct = revealed && sentence.id in question.answer
                    val wrong = revealed && chosen && !correct
                    val mark =
                        when {
                            correct -> stringResource(R.string.question_correct_mark)
                            wrong -> stringResource(R.string.question_yours_mark)
                            else -> null
                        }
                    val description = stringResource(R.string.reading_sentence, paragraphIndex + 1, sentenceIndex + 1, sentence.text)
                    val color =
                        if (correct) {
                            Gp.colors.right
                        } else if (wrong) {
                            Gp.colors.wrong
                        } else {
                            Gp.colors.text
                        }
                    Surface(
                        color =
                            when {
                                correct -> Gp.colors.rightSoft
                                wrong -> Gp.colors.wrongSoft
                                chosen -> Gp.colors.highlight
                                else -> androidx.compose.ui.graphics.Color.Transparent
                            },
                        shape = RoundedCornerShape(GpRadius.s),
                        border = if (chosen) BorderStroke(GpSize.hairline, color) else null,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .then(if (correct && !chosen) Modifier.dashedOutline(color, GpRadius.s) else Modifier)
                                .then(
                                    if (!revealed) {
                                        Modifier.selectable(chosen, role = Role.RadioButton) {
                                            onEdit { ResponseChange(Response.Sentence(sentence.id)) }
                                        }
                                    } else {
                                        Modifier
                                    },
                                ).semantics(mergeDescendants = true) {
                                    contentDescription = description
                                    if (mark != null) stateDescription = mark
                                }.testTag("sentence.${sentence.id}"),
                    ) {
                        Column(
                            Modifier.heightIn(min = GpSize.tapTarget).padding(horizontal = GpSpace.s4, vertical = GpSpace.s4),
                            verticalArrangement = Arrangement.spacedBy(GpSpace.s4),
                        ) {
                            Text(
                                sentence.text,
                                style =
                                    Gp.type.lead.copy(
                                        localeList = English,
                                        lineHeight = Gp.type.explainBody.lineHeight,
                                    ),
                                color = Gp.colors.text,
                                onTextLayout = { textLayout = it },
                                modifier =
                                    Modifier.drawWithContent {
                                        drawContent()
                                        // Пунктир R8 идёт под каждой строкой, в том числе после переноса крупного текста.
                                        if (!revealed && !chosen) {
                                            textLayout?.let { layout ->
                                                repeat(layout.lineCount) { line ->
                                                    val y = layout.getLineBaseline(line) + GpSpace.s2.toPx()
                                                    drawLine(
                                                        color = underline,
                                                        start = Offset(layout.getLineLeft(line), y),
                                                        end = Offset(layout.getLineRight(line), y),
                                                        strokeWidth = GpSize.hairline.toPx(),
                                                        pathEffect =
                                                            PathEffect.dashPathEffect(
                                                                floatArrayOf(GpSpace.s2.toPx(), GpSpace.s2.toPx()),
                                                            ),
                                                    )
                                                }
                                            }
                                        }
                                    },
                            )
                            if (mark != null) Text(mark, style = Gp.type.meta, color = color)
                        }
                    }
                }
            }
        }
    }
}
