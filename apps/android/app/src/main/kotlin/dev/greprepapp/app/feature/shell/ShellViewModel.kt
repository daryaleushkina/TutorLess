package dev.greprepapp.app.feature.shell

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dev.greprepapp.api.models.TrainingRequest
import dev.greprepapp.app.core.theme.ThemeManager
import dev.greprepapp.app.feature.training.StartProblem
import dev.greprepapp.app.feature.training.StartResult
import dev.greprepapp.app.feature.training.TrainingProblem
import dev.greprepapp.app.feature.training.TrainingRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeAction(
    val starting: Boolean = false,
    val problem: StartProblem? = null,
    val started: String? = null,
)

@HiltViewModel
class ShellViewModel
    @Inject
    constructor(
        val shell: ShellRepository,
        val themes: ThemeManager,
        private val trainings: TrainingRepository,
        private val auth: dev.greprepapp.api.apis.AuthApi,
        private val session: dev.greprepapp.app.core.session.SessionManager,
        private val reporter: dev.greprepapp.app.core.report.ClientErrorReporter,
    ) : ViewModel() {
        private val mutableAction = MutableStateFlow(HomeAction())
        val action = mutableAction.asStateFlow()

        fun start(request: TrainingRequest) {
            if (action.value.starting) return
            mutableAction.value = HomeAction(starting = true)
            viewModelScope.launch {
                mutableAction.value =
                    when (val result = trainings.start(request)) {
                        is StartResult.Started -> {
                            HomeAction(started = result.trainingId)
                        }

                        StartResult.NoQuestions -> {
                            HomeAction(problem = StartProblem.NoQuestions)
                        }

                        is StartResult.Failed -> {
                            HomeAction(
                                problem =
                                    if (result.problem ==
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

        private val mutableSigningOut = MutableStateFlow(false)
        val signingOut = mutableSigningOut.asStateFlow()
        private val mutableSignOutProblem = MutableStateFlow<dev.greprepapp.api.ApiFailure?>(null)
        val signOutProblem = mutableSignOutProblem.asStateFlow()

        fun signOut(onDone: () -> Unit) {
            val id = (session.state.value as? dev.greprepapp.app.core.session.SessionState.SignedIn)?.id ?: return
            if (mutableSigningOut.value) return
            mutableSigningOut.value = true
            mutableSignOutProblem.value = null
            viewModelScope.launch {
                val result = dev.greprepapp.api.apiCallNoContent { auth.signOut() }
                if (!session.isCurrent(id)) return@launch
                mutableSigningOut.value = false
                when (result) {
                    is dev.greprepapp.api.ApiResult.Ok -> {
                        onDone()
                    }

                    is dev.greprepapp.api.ApiResult.Failed -> {
                        mutableSignOutProblem.value = result.failure
                        if (result.failure.isReportable) reporter.report("sign-out: ${result.failure}", route = "profile")
                    }
                }
            }
        }

        private val mutableSettingFailed = MutableStateFlow(false)
        val settingFailed = mutableSettingFailed.asStateFlow()

        fun theme(theme: dev.greprepapp.app.core.theme.AppTheme) = saveSetting { themes.select(theme) }

        fun largeText(large: Boolean) = saveSetting { themes.largeText(large) }

        private fun saveSetting(block: suspend () -> Unit) {
            mutableSettingFailed.value = false
            viewModelScope.launch {
                try {
                    block()
                } catch (failure: java.io.IOException) {
                    reporter.report("profile setting failed: ${failure.javaClass.simpleName}", route = "profile")
                    mutableSettingFailed.value = true
                }
            }
        }

        fun consumeStarted() {
            mutableAction.value = HomeAction()
        }
    }
