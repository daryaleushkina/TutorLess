package dev.greprepapp.app.core.theme

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import dagger.hilt.android.AndroidEntryPoint
import dev.greprepapp.app.core.AppScope
import dev.greprepapp.app.core.report.ClientErrorReporter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Только debug: adb broadcast выбирает тему тем же API, что будущий переключатель настроек. */
@AndroidEntryPoint
class DevThemeReceiver : BroadcastReceiver() {
    @Inject lateinit var themes: ThemeManager

    @Inject lateinit var reporter: ClientErrorReporter

    @Inject @AppScope
    lateinit var scope: CoroutineScope

    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val choice =
            when (intent.getStringExtra("theme")) {
                "dark" -> {
                    AppTheme.Dark
                }

                "light" -> {
                    AppTheme.Light
                }

                else -> {
                    reporter.report("dev theme choice invalid", route = DataStoreThemeStore.ROUTE)
                    return
                }
            }
        val pending = goAsync()
        scope.launch {
            try {
                themes.select(choice)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                reporter.report("dev theme selection failed: ${failure.javaClass.simpleName}", route = DataStoreThemeStore.ROUTE)
            } finally {
                pending.finish()
            }
        }
    }
}
