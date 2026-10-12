package dev.greprepapp.app.core

import android.content.Context
import android.content.ContextWrapper
import androidx.test.core.app.ApplicationProvider
import dev.greprepapp.app.testing.MainDispatcherRule
import dev.greprepapp.app.testing.TestGraph
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class LegacyCacheCleanupTest {
    @get:Rule val main = MainDispatcherRule()

    @get:Rule val folder = TemporaryFolder()

    private fun context(): Context =
        object : ContextWrapper(ApplicationProvider.getApplicationContext<Context>()) {
            override fun getNoBackupFilesDir(): File = folder.root
        }

    @Test fun deletesOldCacheAndTemporaryFileOnlyOnceWithoutReporting() =
        runTest(main.dispatcher) {
            val graph = TestGraph(this, main.dispatcher, folder.root).also { it.settle() }
            val old = File(folder.root, "today.json").apply { writeText("old") }
            val tmp = File(folder.root, "today.json.tmp").apply { writeText("old") }
            val unrelated = File(folder.root, "other.json").apply { writeText("keep") }
            val cleanup = LegacyCacheCleanup(context(), graph.reporter, main.dispatcher)
            cleanup.run()
            assertFalse(old.exists())
            assertFalse(tmp.exists())
            assertTrue(unrelated.exists())
            old.writeText("not revisited")
            cleanup.run()
            assertTrue(old.exists())
            assertTrue(graph.publicApi.reports.isEmpty())
        }

    @Test fun missingCacheFinishesMigrationSilently() =
        runTest(main.dispatcher) {
            val graph = TestGraph(this, main.dispatcher, folder.root).also { it.settle() }
            LegacyCacheCleanup(context(), graph.reporter, main.dispatcher).run()
            assertTrue(File(folder.root, "shell-cache-cleaned").exists())
            assertTrue(graph.publicApi.reports.isEmpty())
        }

    @Test fun failedDeletionReportsClassWithoutPathAndCanRetry() =
        runTest(main.dispatcher) {
            val graph = TestGraph(this, main.dispatcher, folder.root).also { it.settle() }
            val blocked = File(folder.root, "today.json").apply { mkdirs() }
            File(blocked, "child").writeText("not empty")
            val cleanup = LegacyCacheCleanup(context(), graph.reporter, main.dispatcher)
            cleanup.run()
            advanceUntilIdle()
            val report = graph.publicApi.reports.single()
            assertEquals("legacy cache cleanup failed: IOException", report.message)
            assertFalse(report.message.contains(folder.root.path))
            assertFalse(File(folder.root, "shell-cache-cleaned").exists())
            blocked.deleteRecursively()
            cleanup.run()
            assertTrue(File(folder.root, "shell-cache-cleaned").exists())
        }
}
