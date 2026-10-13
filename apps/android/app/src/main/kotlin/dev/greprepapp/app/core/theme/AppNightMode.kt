package dev.greprepapp.app.core.theme

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import androidx.appcompat.app.AppCompatDelegate
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject

fun interface ThemeModeApplier {
    fun apply(theme: AppTheme)
}

class AndroidThemeModeApplier
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
    ) : ThemeModeApplier {
        override fun apply(theme: AppTheme) = AppNightMode.apply(context, theme)
    }

/** Ресурсы окна/заставки и Compose должны видеть один выбор, независимо от настройки системы. */
object AppNightMode {
    internal fun initialMode(context: Context): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_NO
        ) {
            AppCompatDelegate.MODE_NIGHT_NO
        } else {
            AppCompatDelegate.MODE_NIGHT_YES
        }

    fun apply(
        context: Context,
        theme: AppTheme,
    ) {
        val dark = theme == AppTheme.Dark
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Ночной режим ресурсов принадлежит процессу. Заставка намеренно всегда на gp_bg_dark:
            // при первом запуске выбора ещё нет (решение техлида 10.10.2026).
            context.getSystemService(UiModeManager::class.java).setApplicationNightMode(
                if (dark) UiModeManager.MODE_NIGHT_YES else UiModeManager.MODE_NIGHT_NO,
            )
        }
        AppCompatDelegate.setDefaultNightMode(if (dark) AppCompatDelegate.MODE_NIGHT_YES else AppCompatDelegate.MODE_NIGHT_NO)
    }
}
