package dev.greprepapp.app

import android.app.Application
import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import dagger.hilt.android.HiltAndroidApp
import dev.greprepapp.app.core.AppScope
import dev.greprepapp.app.core.theme.AppNightMode
import dev.greprepapp.app.core.theme.ThemeManager
import kotlinx.coroutines.CoroutineScope
import javax.inject.Inject

@HiltAndroidApp
class GrePrepApplication : Application() {
    @Inject lateinit var themes: ThemeManager

    @Inject @AppScope
    lateinit var scope: CoroutineScope

    override fun attachBaseContext(base: Context) {
        // На API 31+ система уже восстановила режим приложения; на старых API умолчание тёмное.
        AppCompatDelegate.setDefaultNightMode(AppNightMode.initialMode(base))
        super.attachBaseContext(base)
    }
}
