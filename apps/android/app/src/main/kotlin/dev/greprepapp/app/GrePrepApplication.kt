package dev.greprepapp.app

import android.app.Application
import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import dagger.hilt.android.HiltAndroidApp
import dev.greprepapp.app.core.AppScope
import dev.greprepapp.app.core.theme.AppNightMode
import dev.greprepapp.app.core.theme.ThemeManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class GrePrepApplication : Application() {
    @Inject lateinit var themes: ThemeManager

    @Inject @AppScope
    lateinit var scope: CoroutineScope

    override fun attachBaseContext(base: Context) {
        // Умолчание без чтения диска: AppCompat выбирает ночные ресурсы ещё до attach первой Activity.
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
        super.attachBaseContext(base)
    }

    override fun onCreate() {
        super.onCreate()
        scope.launch(Dispatchers.Main.immediate) {
            themes.state.collect { if (!it.restoring) AppNightMode.apply(this@GrePrepApplication, it.theme) }
        }
    }
}
