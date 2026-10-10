package dev.greprepapp.app.testing

import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.ThemeStore
import kotlinx.coroutines.CompletableDeferred

class MemoryThemeStore(
    var choice: AppTheme = AppTheme.Dark,
) : ThemeStore {
    var gate: CompletableDeferred<Unit>? = null
    var saveFailure: Exception? = null

    override suspend fun load(): AppTheme {
        gate?.await()
        return choice
    }

    override suspend fun save(theme: AppTheme) {
        saveFailure?.let { throw it }
        choice = theme
    }
}
