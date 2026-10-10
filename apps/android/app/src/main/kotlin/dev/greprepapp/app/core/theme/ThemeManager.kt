package dev.greprepapp.app.core.theme

import dev.greprepapp.app.core.AppScope
import dev.greprepapp.app.core.IoDispatcher
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/** Заставка ждёт восстановление темы; до диска умолчание уже тёмное. */
data class ThemeState(
    val theme: AppTheme = AppTheme.Dark,
    val restoring: Boolean = true,
)

@Singleton
class ThemeManager
    @Inject
    constructor(
        private val store: ThemeStore,
        @param:AppScope private val scope: CoroutineScope,
        @param:IoDispatcher private val io: CoroutineDispatcher,
    ) {
        private val mutableState = MutableStateFlow(ThemeState())
        val state = mutableState.asStateFlow()
        private val lock = Mutex()

        init {
            scope.launch {
                lock.withLock {
                    val theme = withContext(io) { store.load() }
                    mutableState.value = ThemeState(theme, restoring = false)
                }
            }
        }

        /** Сначала диск: при отказе новый выбор не появляется в кадре и не теряется после перезапуска. */
        suspend fun select(theme: AppTheme) =
            withContext(scope.coroutineContext) {
                lock.withLock {
                    withContext(io) { store.save(theme) }
                    mutableState.value = ThemeState(theme, restoring = false)
                }
            }
    }
