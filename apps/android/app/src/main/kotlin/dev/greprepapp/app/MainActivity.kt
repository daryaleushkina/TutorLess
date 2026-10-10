package dev.greprepapp.app

import android.content.Context
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import dev.greprepapp.app.core.AppConfig
import dev.greprepapp.app.core.session.SessionManager
import dev.greprepapp.app.core.session.SessionState
import dev.greprepapp.app.core.theme.AppNightMode
import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.ThemeManager
import dev.greprepapp.design.GpTheme
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Одна активность; AppCompat ведёт язык и ночные ресурсы на Android 8–12. */
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    @Inject lateinit var session: SessionManager

    @Inject lateinit var config: AppConfig

    @Inject lateinit var themes: ThemeManager
    private var themeApplied = false

    override fun attachBaseContext(newBase: Context) {
        // В тестах и при запуске Activity отдельно от Application тоже не берём тему системы.
        if (AppCompatDelegate.getDefaultNightMode() == AppCompatDelegate.MODE_NIGHT_UNSPECIFIED) {
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
        }
        super.attachBaseContext(newBase)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen().setKeepOnScreenCondition {
            !themeApplied || themes.state.value.restoring || session.state.value == SessionState.Restoring
        }
        super.onCreate(savedInstanceState)
        var contentInstalled = false
        lifecycleScope.launch {
            themes.state.collect { state ->
                if (!state.restoring) {
                    AppNightMode.apply(applicationContext, state.theme)
                    if (!contentInstalled) {
                        // Даже композиция под заставкой начинается только после чтения выбора.
                        enableEdgeToEdge()
                        setContent {
                            val choice by themes.state.collectAsStateWithLifecycle()
                            GpTheme(darkTheme = choice.theme == AppTheme.Dark) {
                                AppRoot(session = session, config = config)
                            }
                        }
                        contentInstalled = true
                    }
                    themeApplied = true
                }
            }
        }
    }
}
