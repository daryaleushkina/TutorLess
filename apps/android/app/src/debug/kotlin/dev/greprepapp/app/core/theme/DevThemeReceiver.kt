package dev.greprepapp.app.core.theme

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import dagger.hilt.android.AndroidEntryPoint
import dev.greprepapp.app.core.AppScope
import dev.greprepapp.app.core.report.ClientErrorReporter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import java.io.IOException
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
                    setResult(Activity.RESULT_CANCELED, "dev theme choice invalid", null)
                    reporter.report("dev theme choice invalid", route = DataStoreThemeStore.ROUTE)
                    return
                }
            }
        val pending = goAsync()
        pending.resultCode = Activity.RESULT_CANCELED
        pending.resultData = "dev theme selection canceled"
        val job =
            scope.launch {
                try {
                    themes.select(choice)
                    pending.resultCode = Activity.RESULT_OK
                    pending.resultData = "dev theme selected"
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (failure: Exception) {
                    val message = "dev theme selection failed: ${failure.javaClass.simpleName}"
                    pending.resultData = message
                    // IO и отказ доступа уже сообщает ThemeStore; остальные ошибки select — здесь.
                    if (failure !is IOException && failure !is SecurityException) {
                        reporter.report(message, route = DataStoreThemeStore.ROUTE)
                    }
                    Log.w("GrePrep", message)
                }
            }
        // Срабатывает и когда scope отменён до launch и тело корутины вообще не началось.
        job.invokeOnCompletion { pending.finish() }
    }
}
