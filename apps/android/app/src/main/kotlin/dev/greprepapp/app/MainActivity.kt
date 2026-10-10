package dev.greprepapp.app

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.core.graphics.drawable.toDrawable
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import dev.greprepapp.app.core.AppConfig
import dev.greprepapp.app.core.report.ClientErrorReporter
import dev.greprepapp.app.core.session.SessionManager
import dev.greprepapp.app.core.theme.AppNightMode
import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.ThemeManager
import dev.greprepapp.app.core.theme.isThemeReady
import dev.greprepapp.app.core.theme.shouldKeepSplash
import dev.greprepapp.design.GpTheme
import greprep.design.GpDarkColors
import greprep.design.GpLightColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Одна активность; AppCompat ведёт язык и ночные ресурсы на Android 8–12. */
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    @Inject lateinit var session: SessionManager

    @Inject lateinit var config: AppConfig

    @Inject lateinit var themes: ThemeManager

    @Inject lateinit var reporter: ClientErrorReporter

    @Inject lateinit var contentInstaller: dev.greprepapp.app.ui.ActivityContentInstaller

    private var contentInstalled = false
    private var themeResourcesTimedOut = false

    override fun attachBaseContext(newBase: Context) {
        // В тестах и при запуске Activity отдельно от Application тоже не берём тему системы.
        if (AppCompatDelegate.getDefaultNightMode() == AppCompatDelegate.MODE_NIGHT_UNSPECIFIED) {
            AppCompatDelegate.setDefaultNightMode(AppNightMode.initialMode(newBase))
        }
        super.attachBaseContext(newBase)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen().setKeepOnScreenCondition {
            shouldKeepSplash(themes.state.value, session.state.value, resources.configuration.uiMode, themeResourcesTimedOut)
        }
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            themes.state.collectLatest { state ->
                themeResourcesTimedOut = false
                if (!state.restoring) {
                    installContentWhenReady()
                    delay(THEME_RESOURCES_TIMEOUT_MS)
                    if (!isThemeReady(themes.state.value, resources.configuration.uiMode)) {
                        reporter.report("theme resources mismatch", route = "theme")
                        themeResourcesTimedOut = true
                        installContentWhenReady()
                    }
                }
            }
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        installContentWhenReady()
    }

    private fun installContentWhenReady() {
        val state = themes.state.value
        if (state.restoring || (!themeResourcesTimedOut && !isThemeReady(state, resources.configuration.uiMode))) return
        // configChanges=uiMode оставляет Activity живой: окно и системные панели обновляем явно,
        // Compose получает новую конфигурацию и выбор темы без второго AppRoot.
        val dark = state.theme == AppTheme.Dark
        window.setBackgroundDrawable((if (dark) GpDarkColors.bg else GpLightColors.bg).toArgb().toDrawable())
        enableEdgeToEdge()
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }
        if (!contentInstalled) {
            contentInstalled = true
            contentInstaller.install(this) {
                val choice by themes.state.collectAsStateWithLifecycle()
                GpTheme(darkTheme = choice.theme == AppTheme.Dark) {
                    AppRoot(session = session, config = config, modifier = Modifier.semantics { testTagsAsResourceId = true })
                }
            }
        }
    }

    private companion object {
        // Производитель может не прислать uiMode: двух секунд хватает на обычное обновление ресурсов,
        // после этого важнее открыть экран, чем бесконечно удерживать заставку.
        const val THEME_RESOURCES_TIMEOUT_MS = 2_000L
    }
}
