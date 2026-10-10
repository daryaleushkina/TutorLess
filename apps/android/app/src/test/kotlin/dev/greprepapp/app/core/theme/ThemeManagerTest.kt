package dev.greprepapp.app.core.theme

import dev.greprepapp.app.testing.MainDispatcherRule
import dev.greprepapp.app.testing.MemoryThemeStore
import dev.greprepapp.app.testing.TestGraph
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class ThemeManagerTest {
    @get:Rule val folder = TemporaryFolder()

    @get:Rule val main = MainDispatcherRule()

    @Test
    fun unexpectedReadFailureIsReportedAndReleasesTheSplash() =
        runTest(main.dispatcher) {
            val graph = TestGraph(this, main.dispatcher, folder.root)
            val store = MemoryThemeStore(AppTheme.Light).apply { loadFailure = IllegalStateException("private contents") }
            val manager = ThemeManager(store, backgroundScope, main.dispatcher, graph.reporter)
            runCurrent()
            assertEquals(ThemeState(AppTheme.Dark, restoring = false), manager.state.value)
            graph.settle()
            assertEquals(
                "theme restore failed: IllegalStateException",
                graph.publicApi.reports
                    .single()
                    .message,
            )
            assertEquals(
                "theme",
                graph.publicApi.reports
                    .single()
                    .route,
            )
        }

    @Test
    fun cancellationDoesNotReleaseTheSplashOrReportAnError() =
        runTest(main.dispatcher) {
            val graph = TestGraph(this, main.dispatcher, folder.root)
            val store = MemoryThemeStore().apply { loadFailure = CancellationException("cancelled") }
            val manager = ThemeManager(store, backgroundScope, main.dispatcher, graph.reporter)
            runCurrent()
            assertEquals(ThemeState(), manager.state.value)
            graph.settle()
            assertTrue(graph.publicApi.reports.isEmpty())
        }

    @Test
    fun holdsDarkUntilTheSavedChoiceIsRead() =
        runTest(main.dispatcher) {
            val store = MemoryThemeStore(AppTheme.Light).apply { gate = CompletableDeferred() }
            val manager = ThemeManager(store, backgroundScope, main.dispatcher, TestGraph(this, main.dispatcher, folder.root).reporter)
            runCurrent()
            assertEquals(ThemeState(), manager.state.value)
            store.gate?.complete(Unit)
            runCurrent()
            assertEquals(ThemeState(AppTheme.Light, restoring = false), manager.state.value)
        }

    @Test
    fun writingAChoiceAlsoAppliesIt() =
        runTest(main.dispatcher) {
            val store = MemoryThemeStore()
            val manager = ThemeManager(store, backgroundScope, main.dispatcher, TestGraph(this, main.dispatcher, folder.root).reporter)
            runCurrent()
            manager.select(AppTheme.Light)
            assertEquals(AppTheme.Light, store.choice)
            assertEquals(ThemeState(AppTheme.Light, restoring = false), manager.state.value)
        }

    @Test
    fun failedWriteKeepsThePreviousChoice() =
        runTest(main.dispatcher) {
            val store = MemoryThemeStore().apply { saveFailure = IOException("disk full") }
            val manager = ThemeManager(store, backgroundScope, main.dispatcher, TestGraph(this, main.dispatcher, folder.root).reporter)
            runCurrent()
            try {
                manager.select(AppTheme.Light)
                error("ожидался отказ записи")
            } catch (expected: IOException) {
                assertEquals("disk full", expected.message)
            }
            assertEquals(ThemeState(AppTheme.Dark, restoring = false), manager.state.value)
        }

    @Test
    fun initialReadCannotOverwriteANewChoice() =
        runTest(main.dispatcher) {
            val store = MemoryThemeStore().apply { gate = CompletableDeferred() }
            val manager = ThemeManager(store, this, main.dispatcher, TestGraph(this, main.dispatcher, folder.root).reporter)
            launch { manager.select(AppTheme.Light) }
            runCurrent()
            assertEquals(ThemeState(), manager.state.value)
            store.gate?.complete(Unit)
            advanceUntilIdle()
            assertEquals(ThemeState(AppTheme.Light, restoring = false), manager.state.value)
        }
}
