package dev.greprepapp.app.core.theme

import dev.greprepapp.app.core.AppScope
import dev.greprepapp.app.core.IoDispatcher
import dev.greprepapp.app.core.report.ClientErrorReporter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
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
        private val reporter: ClientErrorReporter,
        private val nightMode: ThemeModeApplier,
    ) {
        private val mutableState = MutableStateFlow(ThemeState())
        val state = mutableState.asStateFlow()
        private val lock = Mutex()

        init {
            // Один сборщик на процесс: выбор применяется и после закрытия последней Activity.
            scope.launch(Dispatchers.Main.immediate) {
                state.collect { state ->
                    if (!state.restoring) nightMode.apply(state.theme)
                }
            }
            scope.launch {
                lock.withLock {
                    val theme =
                        try {
                            withContext(io) { store.load() }
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (failure: Exception) {
                            reporter.report("theme restore failed: ${failure.javaClass.simpleName}", route = DataStoreThemeStore.ROUTE)
                            AppTheme.Dark
                        }
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
