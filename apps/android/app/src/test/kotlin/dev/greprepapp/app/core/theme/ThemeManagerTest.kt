package dev.greprepapp.app.core.theme

import android.app.UiModeManager
import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import androidx.test.core.app.ApplicationProvider
import dev.greprepapp.app.testing.MainDispatcherRule
import dev.greprepapp.app.testing.MemoryThemeStore
import dev.greprepapp.app.testing.TestGraph
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class ThemeManagerTest {
    @get:Rule val folder = TemporaryFolder()

    @get:Rule val main = MainDispatcherRule()

    @get:Rule val nightMode =
        dev.greprepapp.app.testing
            .NightModeResetRule()

    @Test
    @Config(sdk = [31, 37])
    fun selectionWithoutAnActivityAppliesTheProcessNightMode() =
        runTest(main.dispatcher) {
            val context = ApplicationProvider.getApplicationContext<Context>()
            val graph = TestGraph(this, main.dispatcher, folder.root)
            val manager =
                ThemeManager(
                    MemoryThemeStore(),
                    backgroundScope,
                    main.dispatcher,
                    graph.reporter,
                    AndroidThemeModeApplier(ApplicationProvider.getApplicationContext()),
                )
            runCurrent()
            manager.select(AppTheme.Light)
            runCurrent()
            assertEquals(AppCompatDelegate.MODE_NIGHT_NO, AppCompatDelegate.getDefaultNightMode())
            assertEquals(UiModeManager.MODE_NIGHT_NO, shadowOf(context.getSystemService(UiModeManager::class.java)).applicationNightMode)
            manager.select(AppTheme.Dark)
            runCurrent()
            assertEquals(AppCompatDelegate.MODE_NIGHT_YES, AppCompatDelegate.getDefaultNightMode())
            assertEquals(UiModeManager.MODE_NIGHT_YES, shadowOf(context.getSystemService(UiModeManager::class.java)).applicationNightMode)
        }

    @Test
    fun unexpectedReadFailureIsReportedAndReleasesTheSplash() =
        runTest(main.dispatcher) {
            val graph = TestGraph(this, main.dispatcher, folder.root)
            val store = MemoryThemeStore(AppTheme.Light).apply { loadFailure = IllegalStateException("private contents") }
            val manager =
                ThemeManager(
                    store,
                    backgroundScope,
                    main.dispatcher,
                    graph.reporter,
                    AndroidThemeModeApplier(ApplicationProvider.getApplicationContext()),
                )
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
            val manager =
                ThemeManager(
                    store,
                    backgroundScope,
                    main.dispatcher,
                    graph.reporter,
                    AndroidThemeModeApplier(ApplicationProvider.getApplicationContext()),
                )
            runCurrent()
            assertEquals(ThemeState(), manager.state.value)
            graph.settle()
            assertTrue(graph.publicApi.reports.isEmpty())
        }

    @Test
    fun holdsDarkUntilTheSavedChoiceIsRead() =
        runTest(main.dispatcher) {
            val store = MemoryThemeStore(AppTheme.Light).apply { gate = CompletableDeferred() }
            val manager =
                ThemeManager(
                    store,
                    backgroundScope,
                    main.dispatcher,
                    TestGraph(this, main.dispatcher, folder.root).reporter,
                    AndroidThemeModeApplier(ApplicationProvider.getApplicationContext()),
                )
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
            val manager =
                ThemeManager(
                    store,
                    backgroundScope,
                    main.dispatcher,
                    TestGraph(this, main.dispatcher, folder.root).reporter,
                    AndroidThemeModeApplier(ApplicationProvider.getApplicationContext()),
                )
            runCurrent()
            manager.select(AppTheme.Light)
            assertEquals(AppTheme.Light, store.choice)
            assertEquals(ThemeState(AppTheme.Light, restoring = false), manager.state.value)
        }

    @Test
    fun failedWriteKeepsThePreviousChoice() =
        runTest(main.dispatcher) {
            val store = MemoryThemeStore().apply { saveFailure = IOException("disk full") }
            val manager =
                ThemeManager(
                    store,
                    backgroundScope,
                    main.dispatcher,
                    TestGraph(this, main.dispatcher, folder.root).reporter,
                    AndroidThemeModeApplier(ApplicationProvider.getApplicationContext()),
                )
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
            val manager =
                ThemeManager(
                    store,
                    backgroundScope,
                    main.dispatcher,
                    TestGraph(this, main.dispatcher, folder.root).reporter,
                    AndroidThemeModeApplier(ApplicationProvider.getApplicationContext()),
                )
            launch { manager.select(AppTheme.Light) }
            runCurrent()
            assertEquals(ThemeState(), manager.state.value)
            store.gate?.complete(Unit)
            runCurrent()
            assertEquals(ThemeState(AppTheme.Light, restoring = false), manager.state.value)
        }
}
