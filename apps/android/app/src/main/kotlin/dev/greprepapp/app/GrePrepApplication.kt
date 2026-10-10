package dev.greprepapp.app

import android.app.Application
import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import dagger.hilt.android.HiltAndroidApp
import dev.greprepapp.app.core.theme.AppNightMode
import dev.greprepapp.app.core.theme.ThemeManager
import javax.inject.Inject
import javax.inject.Provider

@HiltAndroidApp
class GrePrepApplication : Application() {
    @Inject lateinit var themes: Provider<ThemeManager>

    override fun onCreate() {
        super.onCreate()
        // Запускаем восстановление и сборщик темы до Activity, даже если процесс поднял только receiver.
        themes.get()
    }

    override fun attachBaseContext(base: Context) {
        // На API 31+ система уже восстановила режим приложения; на старых API умолчание тёмное.
        AppCompatDelegate.setDefaultNightMode(AppNightMode.initialMode(base))
        super.attachBaseContext(base)
    }
}
