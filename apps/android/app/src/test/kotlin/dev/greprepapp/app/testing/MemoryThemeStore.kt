package dev.greprepapp.app.testing

import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.ThemeStore
import kotlinx.coroutines.CompletableDeferred

class MemoryThemeStore(
    var choice: AppTheme = AppTheme.Dark,
) : ThemeStore {
    var gate: CompletableDeferred<Unit>? = null
    var loadFailure: Exception? = null
    var saveFailure: Exception? = null
    var onSaveFailure: (Exception) -> Unit = {}

    override suspend fun load(): AppTheme {
        val saved = choice
        gate?.await()
        loadFailure?.let { throw it }
        return saved
    }

    override suspend fun save(theme: AppTheme) {
        saveFailure?.let {
            onSaveFailure(it)
            throw it
        }
        choice = theme
    }
}
