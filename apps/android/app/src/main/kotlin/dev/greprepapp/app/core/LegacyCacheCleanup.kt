package dev.greprepapp.app.core

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import dev.greprepapp.app.core.report.ClientErrorReporter
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import javax.inject.Inject

/** Разовая миграция старого плана: не читает содержимое и не раскрывает путь в отчёте. */
class LegacyCacheCleanup
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
        private val reporter: ClientErrorReporter,
        @param:IoDispatcher private val io: CoroutineDispatcher,
    ) {
        suspend fun run() =
            withContext(io) {
                val marker = File(context.noBackupFilesDir, "shell-cache-cleaned")
                if (marker.exists()) return@withContext
                try {
                    for (name in listOf("today.json", "today.json.tmp")) {
                        val file = File(context.noBackupFilesDir, name)
                        if (file.exists() && !file.delete()) throw IOException("legacy cache delete failed")
                    }
                    if (!marker.createNewFile()) throw IOException("legacy cache marker failed")
                } catch (failure: IOException) {
                    reporter.report("legacy cache cleanup failed: ${failure.javaClass.simpleName}", route = "launch")
                } catch (failure: SecurityException) {
                    reporter.report("legacy cache cleanup failed: ${failure.javaClass.simpleName}", route = "launch")
                }
            }
    }
