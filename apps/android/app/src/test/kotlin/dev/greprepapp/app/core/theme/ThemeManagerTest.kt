package dev.greprepapp.app.core.theme

import dev.greprepapp.app.testing.MainDispatcherRule
import dev.greprepapp.app.testing.MemoryThemeStore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class ThemeManagerTest {
    @get:Rule val main = MainDispatcherRule()

    @Test
    fun holdsDarkUntilTheSavedChoiceIsRead() =
        runTest(main.dispatcher) {
            val store = MemoryThemeStore(AppTheme.Light).apply { gate = CompletableDeferred() }
            val manager = ThemeManager(store, backgroundScope, main.dispatcher)
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
            val manager = ThemeManager(store, backgroundScope, main.dispatcher)
            runCurrent()
            manager.select(AppTheme.Light)
            assertEquals(AppTheme.Light, store.choice)
            assertEquals(ThemeState(AppTheme.Light, restoring = false), manager.state.value)
        }

    @Test
    fun failedWriteKeepsThePreviousChoice() =
        runTest(main.dispatcher) {
            val store = MemoryThemeStore().apply { saveFailure = IOException("disk full") }
            val manager = ThemeManager(store, backgroundScope, main.dispatcher)
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
            val manager = ThemeManager(store, this, main.dispatcher)
            launch { manager.select(AppTheme.Light) }
            runCurrent()
            assertEquals(ThemeState(), manager.state.value)
            store.gate?.complete(Unit)
            advanceUntilIdle()
            assertEquals(ThemeState(AppTheme.Light, restoring = false), manager.state.value)
        }
}
