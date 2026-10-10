package dev.greprepapp.app.core.theme

import android.app.UiModeManager
import android.content.Context
import android.os.Build
import androidx.appcompat.app.AppCompatDelegate

/** Ресурсы окна/заставки и Compose должны видеть один выбор, независимо от настройки системы. */
object AppNightMode {
    fun apply(
        context: Context,
        theme: AppTheme,
    ) {
        val dark = theme == AppTheme.Dark
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Система хранит это для заставки следующего холодного запуска, до создания процесса.
            context.getSystemService(UiModeManager::class.java).setApplicationNightMode(
                if (dark) UiModeManager.MODE_NIGHT_YES else UiModeManager.MODE_NIGHT_NO,
            )
        }
        AppCompatDelegate.setDefaultNightMode(if (dark) AppCompatDelegate.MODE_NIGHT_YES else AppCompatDelegate.MODE_NIGHT_NO)
    }
}
