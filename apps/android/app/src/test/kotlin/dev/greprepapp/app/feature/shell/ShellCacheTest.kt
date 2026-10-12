package dev.greprepapp.app.feature.shell

import dev.greprepapp.app.testing.MainDispatcherRule
import dev.greprepapp.app.testing.TestGraph
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
@org.junit.runner.RunWith(org.robolectric.RobolectricTestRunner::class)
class ShellCacheTest {
    @get:Rule val main = MainDispatcherRule()

    @get:Rule val folder = TemporaryFolder()

    @Test fun emptyCorruptAndOldFormatDoNotExposeAnAccount() =
        runTest(main.dispatcher) {
            val graph = TestGraph(this, main.dispatcher, folder.root)
            graph.settle()
            assertNull(graph.cache.load("token"))
            File(folder.root, "shell.json").writeText("{}")
            val invalid = ShellCache(folder.root, graph.reporter)
            assertNull(invalid.load("token"))
            File(folder.root, "shell.json").writeText("bad json")
            assertNull(ShellCache(folder.root, graph.reporter).load("token"))
            graph.settle()
            assertTrue(graph.publicApi.reports.isNotEmpty())
            graph.appScope.cancel()
        }

    @Test fun sameOwnerKeepsDataAndDifferentOwnerGetsAnEmptyCache() =
        runTest(main.dispatcher) {
            val graph = TestGraph(this, main.dispatcher, folder.root)
            graph.settle()
            graph.cache.connect("one", "old")
            val stored = graph.cache.load("old")!!
            graph.cache.save(
                stored.copy(
                    user =
                        dev.greprepapp.app.testing
                            .session()
                            .user,
                ),
            )
            graph.cache.connect("one", "new")
            assertEquals(stored.owner, graph.cache.load("new")?.owner)
            assertTrue(graph.cache.load("new")?.user != null)
            assertNull(graph.cache.load("old"))
            graph.cache.connect("two", "other")
            assertNull(graph.cache.load("other")?.user)
            assertFalse(graph.cache.isConnected("new"))
            assertTrue(ShellCache(folder.root, graph.reporter).isConnected("other"))
            graph.cache.clear()
            assertFalse(File(folder.root, "shell.json").exists())
            assertNull(graph.cache.load("other"))
            graph.appScope.cancel()
        }

    @Test fun readFailureCanRetryAndWriteFailureDoesNotPublishData() =
        runTest(main.dispatcher) {
            val graph = TestGraph(this, main.dispatcher, folder.root)
            graph.settle()
            val path = File(folder.root, "shell.json")
            path.mkdir()
            val cache = ShellCache(folder.root, graph.reporter)
            assertNull(cache.load("token"))
            path.delete()
            cache.connect("one", "token")
            assertTrue(cache.isConnected("token"))
            File(folder.root, "shell.json.tmp").mkdir()
            org.junit.Assert.assertThrows(java.io.IOException::class.java) { cache.connect("two", "token2") }
            assertTrue(cache.isConnected("token"))
            graph.appScope.cancel()
        }
}
