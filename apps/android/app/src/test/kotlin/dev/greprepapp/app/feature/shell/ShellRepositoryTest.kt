package dev.greprepapp.app.feature.shell

import dev.greprepapp.api.ApiFailure
import dev.greprepapp.api.ApiResult
import dev.greprepapp.api.apis.AccountApi
import dev.greprepapp.api.models.ActiveExam
import dev.greprepapp.api.models.Exam
import dev.greprepapp.api.models.ExamChoice
import dev.greprepapp.api.models.ExamList
import dev.greprepapp.api.models.Locale
import dev.greprepapp.api.models.LocaleChoice
import dev.greprepapp.api.models.User
import dev.greprepapp.app.testing.MainDispatcherRule
import dev.greprepapp.app.testing.Reply
import dev.greprepapp.app.testing.TestGraph
import dev.greprepapp.app.testing.session
import dev.greprepapp.app.testing.toResponse
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
@org.junit.runner.RunWith(org.robolectric.RobolectricTestRunner::class)
class ShellRepositoryTest {
    @get:Rule val main = MainDispatcherRule()

    @get:Rule val folder = TemporaryFolder()

    private class Account : AccountApi {
        var user = session().user.copy(activeExam = ActiveExam.GRE)
        var read: Reply<User>? = null
        var change: Reply<User>? = null
        var gate: CompletableDeferred<Unit>? = null
        val exams = mutableListOf<ExamChoice>()
        val locales = mutableListOf<LocaleChoice>()

        override suspend fun getMe() = (read ?: Reply.Ok(user)).toResponse()

        override suspend fun setActiveExam(examChoice: ExamChoice): retrofit2.Response<User> {
            exams += examChoice
            gate?.await()
            user = user.copy(activeExam = ActiveExam.decode(examChoice.exam.value))
            return (change ?: Reply.Ok(user)).toResponse()
        }

        override suspend fun setLocale(localeChoice: LocaleChoice): retrofit2.Response<User> {
            locales += localeChoice
            gate?.await()
            user = user.copy(locale = localeChoice.locale)
            return (change ?: Reply.Ok(user)).toResponse()
        }
    }

    private suspend fun kotlinx.coroutines.test.TestScope.check(block: suspend (TestGraph, Account, ShellRepository) -> Unit) {
        val graph = TestGraph(this, main.dispatcher, folder.root, token = "saved")
        graph.settle()
        graph.publicApi.exams =
            Reply.Ok(
                ExamList(
                    listOf(
                        dev.greprepapp.api.models
                            .ExamInfo(Exam.GRE, listOf(dev.greprepapp.api.models.Section.VERBAL)),
                        dev.greprepapp.api.models
                            .ExamInfo(Exam.TOEFL, listOf(dev.greprepapp.api.models.Section.READING)),
                    ),
                ),
            )
        val account = Account()
        val shell =
            ShellRepository(
                account,
                graph.publicApi,
                graph.trainingsApi,
                graph.session,
                graph.holder,
                graph.cache,
                graph.reporter,
                graph.network,
                graph.foreground,
                graph.appScope,
            )
        graph.settle()
        block(graph, account, shell)
        graph.settle()
        graph.appScope.cancel()
    }

    @Test fun loadsHomeAndQueriesOnlySupportedTypes() =
        runTest(main.dispatcher) {
            check { g, _, s ->
                assertEquals(Exam.GRE, s.state.value.exam)
                assertNotNull(s.state.value.home)
                assertFalse(s.state.value.loading)
                assertEquals(
                    dev.greprepapp.app.feature.training.TrainingRepository.SUPPORTED,
                    g.trainingsApi.homeCalls
                        .single()
                        .third,
                )
                assertNotNull(g.cache.load("saved")?.user)
            }
        }

    @Test fun chooseToeflChangesAccountAndHomeQuery() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                s.choose(Exam.TOEFL)
                g.settle()
                assertEquals(Exam.TOEFL, s.state.value.exam)
                assertEquals(Exam.TOEFL, a.exams.single().exam)
                assertEquals(
                    Exam.TOEFL,
                    g.trainingsApi.homeCalls
                        .last()
                        .first,
                )
            }
        }

    @Test fun unknownExamAndDuplicateClicksDoNotSend() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                a.gate = CompletableDeferred()
                s.choose(Exam.TOEFL)
                g.settle()
                s.choose(Exam.GRE)
                assertEquals(Exam.TOEFL, s.state.value.choosing)
                assertEquals(1, a.exams.size)
                a.gate!!.complete(Unit)
                g.settle()
            }
        }

    @Test fun offlineExamSelectionKeepsAccount() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                g.network.isOnline.value = false
                s.choose(Exam.TOEFL)
                g.settle()
                assertEquals(Exam.GRE, s.state.value.exam)
                assertEquals(ApiFailure.Offline, s.state.value.choiceProblem)
                assertTrue(a.exams.isEmpty())
            }
        }

    @Test fun failedExamSelectionDoesNotClearHome() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                a.change = Reply.Error(500)
                s.choose(Exam.TOEFL)
                g.settle()
                assertEquals(Exam.GRE, s.state.value.exam)
                assertNotNull(s.state.value.home)
                assertNotNull(s.state.value.choiceProblem)
            }
        }

    @Test fun localeUpdatesOptimisticallyAndSaves() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                a.gate = CompletableDeferred()
                s.locale(Locale.EN)
                g.settle()
                assertEquals(
                    Locale.EN,
                    s.state.value.user
                        ?.locale,
                )
                assertTrue(s.state.value.localeBusy)
                s.locale(Locale.RU)
                s.choose(Exam.TOEFL)
                s.refresh()
                assertEquals(1, a.locales.size)
                assertTrue(a.exams.isEmpty())
                a.gate!!.complete(Unit)
                g.settle()
                assertEquals(
                    Locale.EN,
                    g.cache
                        .load("saved")
                        ?.user
                        ?.locale,
                )
                s.locale(Locale.EN)
                g.settle()
                assertEquals(1, a.locales.size)
            }
        }

    @Test fun failedLocaleRestoresPreviousLanguage() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                a.change = Reply.NetworkDown
                s.locale(Locale.EN)
                g.settle()
                assertEquals(
                    Locale.RU,
                    s.state.value.user
                        ?.locale,
                )
                assertEquals(ApiFailure.Offline, s.state.value.localeProblem)
            }
        }

    @Test fun lateAccountMutationCannotRestoreSignedOutState() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                a.gate = CompletableDeferred()
                s.locale(Locale.EN)
                g.settle()
                g.session.signOut()
                g.settle()
                a.gate!!.complete(Unit)
                g.settle()
                assertNull(s.state.value.user)
            }
        }

    @Test fun unauthorizedAccountReturnsToSignIn() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                a.read = Reply.Error(401)
                s.refresh()
                g.settle()
                assertTrue(g.session.state.value is dev.greprepapp.app.core.session.SessionState.SignedOut)
            }
        }

    @Test fun accountFailureKeepsCachedHomeAndRecoversOnNetwork() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                a.read = Reply.NetworkDown
                s.refresh()
                g.settle()
                assertNotNull(s.state.value.home)
                assertEquals(ApiFailure.Offline, s.state.value.problem)
                a.read = null
                g.network.isOnline.value = false
                g.settle()
                g.network.isOnline.value = true
                g.settle()
                assertNull(s.state.value.problem)
            }
        }

    @Test fun catalogFailureAndHomeFailureAreVisible() =
        runTest(main.dispatcher) {
            check { g, _, s ->
                g.publicApi.exams = Reply.Error(500)
                s.refresh()
                g.settle()
                assertNotNull(s.state.value.problem)
                g.publicApi.exams = Reply.Ok(ExamList(emptyList()))
                g.trainingsApi.home = Reply.NetworkDown
                s.refresh()
                g.settle()
                assertEquals(ApiFailure.Offline, s.state.value.problem)
            }
        }

    @Test fun optionsFailureKeepsPreviousContent() =
        runTest(main.dispatcher) {
            check { g, _, s ->
                g.trainingsApi.options = Reply.Error(500)
                s.refresh()
                g.settle()
                assertNotNull(s.state.value.problem)
                assertNotNull(s.state.value.options)
            }
        }

    @Test fun noExamHasNoHomeAndAcceptsFirstChoice() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                a.user = a.user.copy(activeExam = null)
                s.refresh()
                g.settle()
                assertNull(s.state.value.exam)
                assertNull(s.state.value.home)
                assertFalse(s.state.value.loading)
                s.choose(Exam.GRE)
                g.settle()
                assertNotNull(s.state.value.home)
            }
        }

    @Test fun cachedAccountRestoresWithoutNetworkAndForeignTokenCannotReadIt() =
        runTest(main.dispatcher) {
            check { g, a, s ->
                a.read = Reply.NetworkDown
                val second =
                    ShellRepository(
                        a,
                        g.publicApi,
                        g.trainingsApi,
                        g.session,
                        g.holder,
                        g.cache,
                        g.reporter,
                        g.network,
                        g.foreground,
                        g.appScope,
                    )
                g.settle()
                assertNotNull(second.state.value.home)
                assertNull(g.cache.load("foreign"))
                assertEquals("T", s.state.value.initial)
            }
        }

    @Test fun localeChangeResumesInterruptedHomeLoading() =
        runTest(main.dispatcher) {
            check { g, _, s ->
                g.trainingsApi.homeGate = CompletableDeferred()
                s.refresh()
                g.settle()
                assertTrue(s.state.value.loading)
                s.locale(Locale.EN)
                g.settle()
                assertTrue(s.state.value.loading)
                g.trainingsApi.homeGate!!.complete(Unit)
                g.settle()
                assertFalse(s.state.value.loading)
                assertEquals(
                    Locale.EN,
                    s.state.value.user
                        ?.locale,
                )
            }
        }
}
