package dev.greprepapp.app.feature.shell

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import dev.greprepapp.app.feature.training.ActiveTrainingViewModel
import dev.greprepapp.app.feature.training.BuilderScreen
import dev.greprepapp.app.feature.training.ReportScreen
import dev.greprepapp.app.feature.training.ReportTarget
import dev.greprepapp.app.feature.training.ReviewItemScreen
import dev.greprepapp.app.feature.training.ReviewScreen
import dev.greprepapp.app.feature.training.SessionScreen
import dev.greprepapp.app.feature.training.label

/** Тренировки открываются поверх оболочки: внутри сессии вкладок нет. */
@Composable
fun MainScreen(
    appVersion: String,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
    shell: ShellViewModel = hiltViewModel(),
    trainings: ActiveTrainingViewModel = hiltViewModel(),
) {
    val profile by shell.shell.state.collectAsStateWithLifecycle()
    val theme by shell.themes.state.collectAsStateWithLifecycle()
    val action by shell.action.collectAsStateWithLifecycle()
    val settingFailed by shell.settingFailed.collectAsStateWithLifecycle()
    val signingOut by shell.signingOut.collectAsStateWithLifecycle()
    val signOutProblem by shell.signOutProblem.collectAsStateWithLifecycle()
    var picker by androidx.compose.runtime.saveable
        .rememberSaveable { androidx.compose.runtime.mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(profile.exam) { picker = false }
    val active by trainings.active.collectAsStateWithLifecycle()
    val stack = rememberNavBackStack(MainRoute.Tabs)

    fun back() {
        stack.popUnlessRoot()
    }

    fun replaceTop(route: MainRoute) {
        stack.removeLastOrNull()
        stack.add(route)
    }

    fun toTabs() {
        shell.shell.refresh()
        while (stack.size > 1) stack.removeLastOrNull()
    }
    androidx.compose.runtime.LaunchedEffect(action.started) {
        action.started?.let {
            stack.add(MainRoute.Session(it))
            shell.consumeStarted()
        }
    }
    if (profile.exam == null) {
        ExamPicker(profile, shell.shell::choose, shell.shell::refresh)
        return
    }
    if (picker) {
        ExamSheet(
            state = profile,
            onChoose = { exam -> if (exam == profile.exam) picker = false else shell.shell.choose(exam) },
            onDismiss = { picker = false },
        )
    }
    NavDisplay(
        backStack = stack,
        onBack = ::back,
        modifier = modifier,
        entryDecorators = listOf(rememberSaveableStateHolderNavEntryDecorator(), rememberViewModelStoreNavEntryDecorator()),
        entryProvider =
            entryProvider {
                entry<MainRoute.Tabs> {
                    MainScaffold(
                        appVersion = appVersion,
                        onSignOut = { shell.signOut(onSignOut) },
                        signingOut = signingOut,
                        signOutProblem = signOutProblem,
                        profile = profile,
                        theme = theme,
                        settingFailed = settingFailed,
                        onLocale = shell.shell::locale,
                        onTheme = shell::theme,
                        onLargeText = shell::largeText,
                        onExam = { picker = true },
                        training = {
                            TrainingHome(
                                state = profile,
                                action = action,
                                active = active?.takeIf { it.exam == profile.exam },
                                onRefresh = shell.shell::refresh,
                                onStart = shell::start,
                                onContinue = { stack.add(MainRoute.Session(it)) },
                                onBuilder = { stack.add(MainRoute.Builder(it)) },
                            )
                        },
                    )
                }
                entry<MainRoute.Builder> { route ->
                    BuilderScreen(
                        prefill = route.prefill,
                        onBack = ::back,
                        onStarted = { replaceTop(MainRoute.Session(it)) },
                    )
                }
                entry<MainRoute.Session> { route ->
                    SessionScreen(
                        trainingId = route.trainingId,
                        onClose = ::toTabs,
                        onReview = { stack.add(MainRoute.Review(route.trainingId)) },
                        onReport = { stack.add(it.route()) },
                        onRepeatStarted = { replaceTop(MainRoute.Session(it)) },
                    )
                }
                entry<MainRoute.Review> { route ->
                    ReviewScreen(
                        trainingId = route.trainingId,
                        onBack = ::back,
                        onOpen = { stack.add(MainRoute.ReviewItem(route.trainingId, it)) },
                        onReport = { stack.add(it.route()) },
                    )
                }
                entry<MainRoute.ReviewItem> { route ->
                    ReviewItemScreen(
                        trainingId = route.trainingId,
                        position = route.position,
                        onBack = ::back,
                        onReport = { stack.add(it.route()) },
                    )
                }
                entry<MainRoute.Report> { route ->
                    ReportScreen(
                        questionId = route.questionId,
                        trainingId = route.trainingId,
                        position = route.position,
                        typeLabel = route.questionType.label(),
                        onBack = ::back,
                    )
                }
            },
    )
}

private fun ReportTarget.route() = MainRoute.Report(trainingId, position, questionId, questionType)
