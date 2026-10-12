package dev.greprepapp.app.feature.shell

import dev.greprepapp.api.ApiFailure
import dev.greprepapp.api.ApiResult
import dev.greprepapp.api.apiCall
import dev.greprepapp.api.apis.AccountApi
import dev.greprepapp.api.apis.PublicApi
import dev.greprepapp.api.apis.TrainingsApi
import dev.greprepapp.api.models.Exam
import dev.greprepapp.api.models.ExamChoice
import dev.greprepapp.api.models.ExamInfo
import dev.greprepapp.api.models.Home
import dev.greprepapp.api.models.Locale
import dev.greprepapp.api.models.LocaleChoice
import dev.greprepapp.api.models.TrainingOptions
import dev.greprepapp.api.models.User
import dev.greprepapp.app.core.AppForeground
import dev.greprepapp.app.core.AppScope
import dev.greprepapp.app.core.NetworkStatus
import dev.greprepapp.app.core.report.ClientErrorReporter
import dev.greprepapp.app.core.session.SessionManager
import dev.greprepapp.app.core.session.SessionState
import dev.greprepapp.app.core.session.TokenHolder
import dev.greprepapp.app.feature.training.TrainingRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject
import javax.inject.Singleton

/** Один источник экзамена и языка для всех вкладок; данные главной никогда не смешиваются между экзаменами. */
data class ShellState(
    val user: User? = null,
    val exams: List<ExamInfo> = emptyList(),
    val home: Home? = null,
    val options: TrainingOptions? = null,
    val loading: Boolean = true,
    val problem: ApiFailure? = null,
    val choosing: Exam? = null,
    val localeBusy: Boolean = false,
    val choiceProblem: ApiFailure? = null,
    val localeProblem: ApiFailure? = null,
) {
    val exam: Exam? get() = user?.activeExam?.value?.let(Exam::decode)
    val initial: String? get() =
        user
            ?.name
            ?.trim()
            ?.takeIf {
                it.isNotEmpty()
            }?.let { String(Character.toChars(it.codePointAt(0))).uppercase() }
}

@Singleton
class ShellRepository
    @Inject
    constructor(
        private val account: AccountApi,
        private val public: PublicApi,
        private val api: TrainingsApi,
        private val session: SessionManager,
        private val holder: TokenHolder,
        private val cache: ShellCache,
        private val reporter: ClientErrorReporter,
        private val network: NetworkStatus,
        foreground: AppForeground,
        @param:AppScope private val scope: CoroutineScope,
    ) {
        private val mutableState = MutableStateFlow(ShellState())
        val state = mutableState.asStateFlow()
        private var job: Job? = null

        init {
            scope.launch {
                session.state.collectLatest { current ->
                    job?.cancel()
                    mutableState.value = ShellState()
                    if (current is SessionState.SignedIn) refresh()
                }
            }
            scope.launch { network.isOnline.collect { if (it && mutableState.value.problem != null) refresh() } }
            scope.launch { foreground.events.collect { refresh() } }
        }

        fun refresh() {
            val id = (session.state.value as? SessionState.SignedIn)?.id ?: return
            if (state.value.choosing != null || state.value.localeBusy) return
            job?.cancel()
            job =
                scope.launch {
                    try {
                        val saved = holder.token?.let(cache::load)
                        if (state.value.user == null && saved != null) {
                            val exam = saved.user?.activeExam?.value
                            val home = saved.homes[exam]
                            mutableState.value = ShellState(saved.user, saved.exams, home?.home, home?.options)
                        }
                        mutableState.update { it.copy(loading = true) }
                        val result =
                            coroutineScope {
                                val exams = async { apiCall { public.getExams() } }
                                val user = apiCall { account.getMe() }
                                user to exams.await()
                            }
                        if (!session.isCurrent(id)) return@launch
                        val user = result.first
                        val exams = result.second
                        if (user is ApiResult.Failed || exams is ApiResult.Failed) {
                            failed(id, (user as? ApiResult.Failed)?.failure ?: (exams as ApiResult.Failed).failure)
                            return@launch
                        }
                        user as ApiResult.Ok
                        exams as ApiResult.Ok
                        val changed = state.value.exam?.value != user.value.activeExam?.value
                        mutableState.update {
                            it.copy(
                                user = user.value,
                                exams = exams.value.exams,
                                home = if (changed) null else it.home,
                                options = if (changed) null else it.options,
                            )
                        }
                        loadHome(id)
                        persist(id)
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (failure: java.io.IOException) {
                        reporter.report("shell cache write failed: ${failure.javaClass.simpleName}", route = "shell")
                        mutableState.update { it.copy(loading = false) }
                    }
                }
        }

        private suspend fun loadHome(id: Long) {
            val exam = state.value.exam
            if (exam == null) {
                mutableState.update { it.copy(loading = false, problem = null) }
                return
            }
            val result =
                coroutineScope {
                    val options = async { apiCall { api.getTrainingOptions(exam, TrainingRepository.SUPPORTED) } }
                    val home = apiCall { api.getHome(exam, ZoneId.systemDefault().id, TrainingRepository.SUPPORTED) }
                    home to options.await()
                }
            if (!session.isCurrent(id) || state.value.exam != exam) return
            val home = result.first
            val options = result.second
            if (home is ApiResult.Ok && options is ApiResult.Ok) {
                mutableState.update { it.copy(home = home.value, options = options.value, loading = false, problem = null) }
            } else {
                failed(id, (home as? ApiResult.Failed)?.failure ?: (options as ApiResult.Failed).failure)
            }
        }

        fun choose(exam: Exam) {
            val s = state.value
            val id = (session.state.value as? SessionState.SignedIn)?.id ?: return
            if (s.choosing != null || s.localeBusy || s.exams.none { it.id == exam }) return
            job?.cancel()
            mutableState.update { it.copy(choosing = exam, choiceProblem = null) }
            job =
                scope.launch {
                    val result =
                        if (network.isOnline.value) {
                            apiCall {
                                account.setActiveExam(
                                    ExamChoice(exam),
                                )
                            }
                        } else {
                            ApiResult.Failed(ApiFailure.Offline)
                        }
                    if (!session.isCurrent(id)) return@launch
                    when (result) {
                        is ApiResult.Ok -> {
                            mutableState.update {
                                it.copy(
                                    user = result.value,
                                    home = null,
                                    options = null,
                                    choosing = null,
                                    loading = true,
                                )
                            }
                            loadHome(id)
                            persistSafely(id)
                        }

                        is ApiResult.Failed -> {
                            report(id, result.failure)
                            mutableState.update { it.copy(choosing = null, choiceProblem = result.failure) }
                        }
                    }
                }
        }

        /** Язык меняется сразу; отказ сервера возвращает прежний выбор и локализованную ошибку. */
        fun locale(locale: Locale) {
            val old = state.value.user ?: return
            val id = (session.state.value as? SessionState.SignedIn)?.id ?: return
            if (state.value.localeBusy || state.value.choosing != null || old.locale == locale) return
            val reloadHome = state.value.loading
            job?.cancel()
            mutableState.update { it.copy(user = old.copy(locale = locale), localeBusy = true, localeProblem = null) }
            job =
                scope.launch {
                    val result = apiCall { account.setLocale(LocaleChoice(locale)) }
                    if (!session.isCurrent(id)) return@launch
                    when (result) {
                        is ApiResult.Ok -> {
                            mutableState.update { it.copy(user = result.value, localeBusy = false) }
                            persistSafely(id)
                        }

                        is ApiResult.Failed -> {
                            report(id, result.failure)
                            mutableState.update { it.copy(user = old, localeBusy = false, localeProblem = result.failure) }
                        }
                    }
                    if (reloadHome) refresh()
                }
        }

        private suspend fun persistSafely(id: Long) {
            try {
                persist(id)
            } catch (failure: java.io.IOException) {
                reporter.report("shell cache write failed: ${failure.javaClass.simpleName}", route = "shell")
            }
        }

        private suspend fun persist(id: Long) {
            val s = state.value
            val user = s.user ?: return
            val token = holder.token ?: return
            session.writeIfCurrent(id) {
                cache.connect(user.id, token)
                val saved = cache.load(token) ?: return@writeIfCurrent
                val home = s.home
                val options = s.options
                val homes =
                    if (home != null && options != null &&
                        s.exam != null
                    ) {
                        saved.homes + (s.exam!!.value to CachedHome(home, options))
                    } else {
                        saved.homes
                    }
                cache.save(saved.copy(user = user, exams = s.exams, homes = homes))
            }
        }

        private fun failed(
            id: Long,
            failure: ApiFailure,
        ) {
            report(id, failure)
            mutableState.update { it.copy(loading = false, problem = failure) }
        }

        private fun report(
            id: Long,
            failure: ApiFailure,
        ) {
            if (failure == ApiFailure.Unauthorized) {
                session.handleUnauthorized(id)
            } else if (failure.isReportable) {
                reporter.report("shell: $failure", route = "shell")
            }
        }
    }
