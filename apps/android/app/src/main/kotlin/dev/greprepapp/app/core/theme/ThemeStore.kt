package dev.greprepapp.app.core.theme

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import dev.greprepapp.app.core.report.ClientErrorReporter
import kotlinx.coroutines.flow.first
import java.io.IOException

/** Выбор принадлежит устройству: выход из аккаунта его не стирает (решение Даши 10.10.2026). */
enum class AppTheme { Dark, Light }

interface ThemeStore {
    suspend fun load(): AppTheme

    /** Ошибка записи возвращается вызывающему: экран настройки сможет оставить прежнее значение. */
    suspend fun save(theme: AppTheme)
}

class DataStoreThemeStore(
    private val dataStore: DataStore<Preferences>,
    private val reporter: ClientErrorReporter,
) : ThemeStore {
    override suspend fun load(): AppTheme =
        try {
            when (dataStore.data.first()[Choice]) {
                null, "dark" -> {
                    AppTheme.Dark
                }

                "light" -> {
                    AppTheme.Light
                }

                else -> {
                    reporter.report("theme choice unreadable", route = ROUTE)
                    AppTheme.Dark
                }
            }
        } catch (failure: IOException) {
            readFailed(failure)
        } catch (failure: ClassCastException) {
            readFailed(failure)
        } catch (failure: SecurityException) {
            readFailed(failure)
        }

    override suspend fun save(theme: AppTheme) {
        try {
            dataStore.edit { it[Choice] = if (theme == AppTheme.Dark) "dark" else "light" }
        } catch (failure: IOException) {
            writeFailed(failure)
        } catch (failure: SecurityException) {
            writeFailed(failure)
        }
    }

    private fun readFailed(failure: Exception): AppTheme {
        reporter.report("theme read failed: ${failure.javaClass.simpleName}", route = ROUTE)
        return AppTheme.Dark
    }

    private fun writeFailed(failure: Exception): Nothing {
        reporter.report("theme save failed: ${failure.javaClass.simpleName}", route = ROUTE)
        throw failure
    }

    companion object {
        internal val Choice = stringPreferencesKey("theme")
        const val ROUTE = "theme"
    }
}
