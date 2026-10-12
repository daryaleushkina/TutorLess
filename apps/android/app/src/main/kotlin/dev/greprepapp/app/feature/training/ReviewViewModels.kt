package dev.greprepapp.app.feature.training

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import dev.greprepapp.api.models.QuestionReport
import dev.greprepapp.app.core.report.takeCodePoints
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Тренировка для экранов разбора (макет R16) — только чтение. null — её нет на устройстве. */
@HiltViewModel(assistedFactory = ReviewViewModel.Factory::class)
class ReviewViewModel
    @AssistedInject
    constructor(
        @Assisted trainingId: String,
        private val repository: TrainingRepository,
    ) : ViewModel() {
        @AssistedFactory
        interface Factory {
            fun create(trainingId: String): ReviewViewModel
        }

        sealed interface UiState {
            data object Loading : UiState

            data object Missing : UiState

            data class Ready(
                val training: StoredTraining,
                val result: TrainingResult,
            ) : UiState
        }

        val state: StateFlow<UiState> =
            repository
                .training(trainingId)
                .map { t -> if (t == null) UiState.Missing else UiState.Ready(t, TrainingRules.result(t)) }
                .stateIn(viewModelScope, SharingStarted.Eagerly, UiState.Loading)
        private val mutableStart = MutableStateFlow(SessionViewModel.RepeatState())
        val topicStart: StateFlow<SessionViewModel.RepeatState> = mutableStart.asStateFlow()

        fun startTopic(topicId: String) {
            val training = (state.value as? UiState.Ready)?.training ?: return
            val request = topicPracticeRequest(training, topicId) ?: return
            if (mutableStart.value.starting) return
            mutableStart.value = SessionViewModel.RepeatState(starting = true)
            viewModelScope.launch {
                mutableStart.value =
                    when (val started = repository.start(request)) {
                        is StartResult.Started -> {
                            SessionViewModel.RepeatState(started = started.trainingId)
                        }

                        StartResult.NoQuestions -> {
                            SessionViewModel.RepeatState(problem = StartProblem.NoQuestions)
                        }

                        is StartResult.Failed -> {
                            SessionViewModel.RepeatState(
                                problem =
                                    if (started.problem ==
                                        TrainingProblem.Offline
                                    ) {
                                        StartProblem.Offline
                                    } else {
                                        StartProblem.Failed
                                    },
                            )
                        }
                    }
            }
        }

        fun consumeStarted() {
            mutableStart.value = SessionViewModel.RepeatState()
        }
    }

/**
 * «Сообщить об ошибке» (макет R17): где ошибка и что не так. Отправка — через очередь: без сети жалоба уйдёт
 * потом, а человек сразу видит «Спасибо».
 */
@HiltViewModel(assistedFactory = ReportViewModel.Factory::class)
class ReportViewModel
    @AssistedInject
    constructor(
        @Assisted("question") private val questionId: String,
        @Assisted("training") private val trainingId: String,
        private val repository: TrainingRepository,
    ) : ViewModel() {
        @AssistedFactory
        interface Factory {
            fun create(
                @Assisted("question") questionId: String,
                @Assisted("training") trainingId: String,
            ): ReportViewModel
        }

        data class UiState(
            val kind: QuestionReport.Kind? = null,
            val text: String = "",
            val sending: Boolean = false,
            val sent: Boolean = false,
            val failed: Boolean = false,
        ) {
            val canSend: Boolean get() = kind != null && (kind != QuestionReport.Kind.OTHER || text.isNotBlank()) && !sending && !sent
        }

        private val mutableState = MutableStateFlow(UiState())
        val state: StateFlow<UiState> = mutableState.asStateFlow()

        fun setKind(kind: QuestionReport.Kind) = mutableState.update { it.copy(kind = kind) }

        fun setText(text: String) = mutableState.update { it.copy(text = text.takeCodePoints(QuestionReportLimits.TEXT_CODE_POINTS)) }

        fun send() {
            val s = mutableState.value
            val kind = s.kind ?: return
            if (!s.canSend) return
            // Жалоба — в очередь области приложения: «Назад» сразу после «Отправить» её не теряет.
            val text = s.text.trim().takeIf { it.isNotEmpty() }
            mutableState.update { it.copy(sending = true, failed = false) }
            val saved = repository.recordReport(questionId, QuestionReport(kind = kind, text = text, trainingId = trainingId))
            viewModelScope.launch {
                val success = saved.await()
                mutableState.update { it.copy(sending = false, sent = success, failed = !success) }
            }
        }

        fun prepareNextReport() {
            if (mutableState.value.sent) mutableState.value = UiState()
        }
    }
