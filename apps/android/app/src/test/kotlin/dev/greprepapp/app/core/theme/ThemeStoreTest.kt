package dev.greprepapp.app.core.theme

import android.content.ContextWrapper
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.preferencesOf
import androidx.test.core.app.ApplicationProvider
import dev.greprepapp.app.di.AppModule
import dev.greprepapp.app.testing.MainDispatcherRule
import dev.greprepapp.app.testing.TestGraph
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class ThemeStoreTest {
    @get:Rule val main = MainDispatcherRule()

    @get:Rule val folder = TemporaryFolder()

    private fun TestScope.graph() = TestGraph(this, main.dispatcher, folder.root).also { it.settle() }

    private fun TestGraph.store(data: Flow<Preferences>) = DataStoreThemeStore(StubDataStore(data), reporter)

    @Test
    fun noChoiceIsDark() =
        runTest(main.dispatcher) {
            val graph = graph()
            assertEquals(AppTheme.Dark, graph.store(flowOf(emptyPreferences())).load())
            assertTrue(graph.publicApi.reports.isEmpty())
        }

    @Test
    fun savedLightIsLight() =
        runTest(main.dispatcher) {
            val graph = graph()
            assertEquals(AppTheme.Light, graph.store(flowOf(preferencesOf(DataStoreThemeStore.Choice to "light"))).load())
        }

    @Test
    fun savedDarkIsDark() =
        runTest(main.dispatcher) {
            val graph = graph()
            assertEquals(AppTheme.Dark, graph.store(flowOf(preferencesOf(DataStoreThemeStore.Choice to "dark"))).load())
        }

    @Test
    fun unknownChoiceIsDarkAndReportedWithoutItsContents() =
        runTest(main.dispatcher) {
            val graph = graph()
            assertEquals(AppTheme.Dark, graph.store(flowOf(preferencesOf(DataStoreThemeStore.Choice to "bad value"))).load())
            graph.settle()
            assertEquals(
                "theme choice unreadable",
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
    fun wrongPreferenceTypeIsDarkAndReported() =
        runTest(main.dispatcher) {
            val graph = graph()
            assertEquals(AppTheme.Dark, graph.store(flowOf(preferencesOf(intPreferencesKey("theme") to 42))).load())
            graph.settle()
            assertEquals(1, graph.publicApi.reports.size)
        }

    @Test
    fun unavailableStorageIsDarkAndReported() =
        runTest(main.dispatcher) {
            val graph = graph()
            assertEquals(AppTheme.Dark, graph.store(flow { throw IOException("private path") }).load())
            graph.settle()
            assertEquals(
                "theme read failed: IOException",
                graph.publicApi.reports
                    .single()
                    .message,
            )
        }

    @Test
    fun deniedStorageIsDarkAndReported() =
        runTest(main.dispatcher) {
            val graph = graph()
            assertEquals(AppTheme.Dark, graph.store(flow { throw SecurityException("private path") }).load())
            graph.settle()
            assertEquals(
                "theme read failed: SecurityException",
                graph.publicApi.reports
                    .single()
                    .message,
            )
        }

    @Test
    fun cancelledReadIsNotTurnedIntoAChoice() =
        runTest(main.dispatcher) {
            val graph = graph()
            try {
                graph.store(flow { throw CancellationException("cancelled") }).load()
                error("ожидалась отмена")
            } catch (expected: CancellationException) {
                assertEquals("cancelled", expected.message)
            }
            assertTrue(graph.publicApi.reports.isEmpty())
        }

    @Test
    fun bothChoicesAreWrittenToPreferences() =
        runTest(main.dispatcher) {
            val graph = graph()
            val dataStore =
                PreferenceDataStoreFactory.create(
                    scope = backgroundScope,
                    produceFile = { File(folder.root, "theme.preferences_pb") },
                )
            val store = DataStoreThemeStore(dataStore, graph.reporter)
            store.save(AppTheme.Light)
            assertEquals(AppTheme.Light, store.load())
            store.save(AppTheme.Dark)
            assertEquals(AppTheme.Dark, store.load())
            assertTrue(File(folder.root, "theme.preferences_pb").length() > 0)
        }

    @Test
    fun corruptedFileIsDarkAndReported() =
        runTest(main.dispatcher) {
            val graph = graph()
            val file = File(folder.root, "broken.preferences_pb").apply { writeText("broken preferences") }
            val dataStore = PreferenceDataStoreFactory.create(scope = backgroundScope, produceFile = { file })
            assertEquals(AppTheme.Dark, DataStoreThemeStore(dataStore, graph.reporter).load())
            graph.settle()
            assertEquals(1, graph.publicApi.reports.size)
        }

    @Test
    fun writeFailureIsReportedAndReturned() =
        runTest(main.dispatcher) {
            val graph = graph()
            val dataStore = StubDataStore(flowOf(emptyPreferences()), IOException("disk full"))
            try {
                DataStoreThemeStore(dataStore, graph.reporter).save(AppTheme.Light)
                error("ожидался отказ записи")
            } catch (expected: IOException) {
                assertEquals("disk full", expected.message)
            }
            graph.settle()
            assertEquals(
                "theme save failed: IOException",
                graph.publicApi.reports
                    .single()
                    .message,
            )
        }

    @Test
    fun savedChoiceSurvivesDataStoreRecreation() =
        runTest(main.dispatcher) {
            val graph = graph()
            val file = File(folder.root, "reopen.preferences_pb")
            val writerScope = CoroutineScope(SupervisorJob() + main.dispatcher)
            val first = PreferenceDataStoreFactory.create(scope = writerScope, produceFile = { file })
            DataStoreThemeStore(first, graph.reporter).save(AppTheme.Light)
            writerScope.cancel()
            runCurrent()
            val reopened = PreferenceDataStoreFactory.create(scope = backgroundScope, produceFile = { file })
            assertEquals(AppTheme.Light, DataStoreThemeStore(reopened, graph.reporter).load())
        }

    @Test
    fun productionCorruptionHandlerRepairsTheFileAndReports() =
        runTest(main.dispatcher) {
            val graph = graph()
            val context =
                object : ContextWrapper(ApplicationProvider.getApplicationContext()) {
                    override fun getNoBackupFilesDir(): File = folder.root
                }
            File(folder.root, "theme.preferences_pb").writeText("broken preferences")
            val store = AppModule.themeStore(context, graph.reporter, backgroundScope, main.dispatcher)
            assertEquals(AppTheme.Dark, store.load())
            graph.settle()
            assertEquals(
                "theme data corrupted",
                graph.publicApi.reports
                    .single()
                    .message,
            )
            store.save(AppTheme.Light)
            assertEquals(AppTheme.Light, store.load())
        }

    @Test
    fun deniedWriteIsReportedAndReturned() =
        runTest(main.dispatcher) {
            val graph = graph()
            val dataStore = StubDataStore(flowOf(emptyPreferences()), SecurityException("permission denied"))
            try {
                DataStoreThemeStore(dataStore, graph.reporter).save(AppTheme.Light)
                error("ожидался отказ записи")
            } catch (expected: SecurityException) {
                assertEquals("permission denied", expected.message)
            }
            graph.settle()
            assertEquals(
                "theme save failed: SecurityException",
                graph.publicApi.reports
                    .single()
                    .message,
            )
        }

    private class StubDataStore(
        override val data: Flow<Preferences>,
        private val failure: Exception? = null,
    ) : DataStore<Preferences> {
        override suspend fun updateData(transform: suspend (t: Preferences) -> Preferences): Preferences {
            failure?.let { throw it }
            return transform(emptyPreferences())
        }
    }
}
