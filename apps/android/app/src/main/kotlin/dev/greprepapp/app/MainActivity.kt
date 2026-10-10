package dev.greprepapp.app

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.core.graphics.drawable.toDrawable
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import dev.greprepapp.app.core.AppConfig
import dev.greprepapp.app.core.session.SessionManager
import dev.greprepapp.app.core.theme.AppNightMode
import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.ThemeManager
import dev.greprepapp.app.core.theme.isThemeReady
import dev.greprepapp.app.core.theme.shouldKeepSplash
import dev.greprepapp.design.GpTheme
import kotlinx.coroutines.launch
import javax.inject.Inject
import dev.greprepapp.design.R as DesignR

/** Одна активность; AppCompat ведёт язык и ночные ресурсы на Android 8–12. */
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    @Inject lateinit var session: SessionManager

    @Inject lateinit var config: AppConfig

    @Inject lateinit var themes: ThemeManager
    private var contentInstalled = false

    override fun attachBaseContext(newBase: Context) {
        // В тестах и при запуске Activity отдельно от Application тоже не берём тему системы.
        if (AppCompatDelegate.getDefaultNightMode() == AppCompatDelegate.MODE_NIGHT_UNSPECIFIED) {
            AppCompatDelegate.setDefaultNightMode(AppNightMode.initialMode(newBase))
        }
        super.attachBaseContext(newBase)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen().setKeepOnScreenCondition {
            shouldKeepSplash(themes.state.value, session.state.value, resources.configuration.uiMode)
        }
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            themes.state.collect { state ->
                if (!state.restoring) {
                    // Единственный владелец применения выбора: Application только задаёт начальный режим.
                    AppNightMode.apply(applicationContext, state.theme)
                    installContentWhenReady()
                }
            }
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        installContentWhenReady()
    }

    private fun installContentWhenReady() {
        if (!isThemeReady(themes.state.value, resources.configuration.uiMode)) return
        // configChanges=uiMode оставляет Activity живой: окно и системные панели обновляем явно,
        // Compose получает новую конфигурацию и выбор темы без второго AppRoot.
        window.setBackgroundDrawable(getColor(DesignR.color.gp_bg).toDrawable())
        enableEdgeToEdge()
        if (!contentInstalled) {
            contentInstalled = true
            setContent {
                val choice by themes.state.collectAsStateWithLifecycle()
                GpTheme(darkTheme = choice.theme == AppTheme.Dark) {
                    AppRoot(session = session, config = config, modifier = Modifier.semantics { testTagsAsResourceId = true })
                }
            }
        }
    }
}
