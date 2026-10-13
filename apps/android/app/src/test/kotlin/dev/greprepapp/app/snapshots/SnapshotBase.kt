package dev.greprepapp.app.snapshots

import android.graphics.Bitmap
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import dev.greprepapp.app.core.session.SignOutReason
import dev.greprepapp.app.feature.shell.AppTab
import dev.greprepapp.app.feature.shell.MainScaffold
import dev.greprepapp.app.feature.shell.SettingsScreen
import dev.greprepapp.app.feature.signin.SignInContent
import dev.greprepapp.app.feature.signin.SignInViewModel
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.design.GpTheme
import org.junit.Rule

/** Общее для снимков: съёмка через правило Compose, экраны входа и оболочки с готовым состоянием. */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
abstract class SnapshotBase(
    private val theme: String,
) {
    private var capturingLarge = false

    @get:Rule val compose = createAppComposeRule()

    /**
     * Снять экран. Часы Compose стоят — крутилка загрузки и пульсация не делают кадр каждый раз другим.
     *
     * Robolectric изредка отдаёт кадр, в котором окно ещё не нарисовано (однотонный фон активности): так было
     * с экраном входа в длинной серии снимков, хотя сам экран в тех же условиях на месте (SignInLargeFontTest,
     * сценарии AppFlowTest). Такой кадр не принимается: экран собирается заново, до трёх попыток; пустой и
     * после них — тест падает, а не записывает пустой эталон.
     */
    protected fun snap(
        name: String,
        large: Boolean = false,
        systemFontScale: Float = 1f,
        beforeCapture: (() -> Unit)? = null,
        content: @Composable () -> Unit,
    ) {
        capturingLarge = large
        var attempt by mutableIntStateOf(0)
        compose.mainClock.autoAdvance = false
        compose.setContent {
            // Системный масштаб шрифта — через LocalDensity, а не RuntimeEnvironment.setFontScale: тот меняет
            // конфигурацию всего процесса и задевает следующие тесты.
            val density = LocalDensity.current
            key(attempt) {
                CompositionLocalProvider(
                    LocalDensity provides Density(density.density, systemFontScale),
                    androidx.compose.ui.platform.LocalInspectionMode provides true,
                ) {
                    // Нажатие перед кадром не должно записать временный ripple: сценарии проверяют реальное нажатие,
                    // а эталон — устойчивое состояние экрана после него.
                    if (beforeCapture != null) {
                        CompositionLocalProvider(androidx.compose.material3.LocalRippleConfiguration provides null) {
                            GpTheme(darkTheme = theme == "dark", largeText = large) { content() }
                        }
                    } else {
                        GpTheme(darkTheme = theme == "dark", largeText = large) { content() }
                    }
                }
            }
        }
        repeat(ATTEMPTS) {
            compose.mainClock.advanceTimeBy(FRAME_TIME)
            compose.waitForIdle()
            if (beforeCapture != null) {
                // ScrollTo ожидает кадры; на время действия отпускаем тестовые часы.
                compose.mainClock.autoAdvance = true
                beforeCapture()
                compose.waitForIdle()
                compose.mainClock.autoAdvance = false
                compose.mainClock.advanceTimeBy(FRAME_TIME)
                compose.waitForIdle()
            }
            val frame = compose.onRoot().captureToImage().asAndroidBitmap()
            if (!frame.isSingleColor()) {
                frame.captureRoboImage("src/test/snapshots/$name-$theme.png")
                return
            }
            attempt++
        }
        error("$name-$theme: окно так и не нарисовалось за $ATTEMPTS попытки")
    }

    @Composable
    protected fun SignIn(
        state: SignInViewModel.UiState = SignInViewModel.UiState(),
        reason: SignOutReason? = null,
    ) = SignInContent(state, reason, showsDevelopmentSignIn = false, onProvider = {}, onDevelopment = {})

    @Composable
    protected fun Home(
        state: dev.greprepapp.app.feature.shell.ShellState = ShellFixtures.first,
        tab: AppTab = AppTab.Training,
        action: dev.greprepapp.app.feature.shell.HomeAction =
            dev.greprepapp.app.feature.shell
                .HomeAction(),
        active: dev.greprepapp.app.feature.training.ContinueTraining? = null,
    ) = MainScaffold(appVersion = "0.1.0 (1)", onSignOut = {}, initialTab = tab, profile = state) {
        dev.greprepapp.app.feature.shell
            .TrainingHome(state, action, active, {}, {}, {}, {})
    }

    @Composable
    protected fun Settings() {
        if (dev.greprepapp.design.Gp.isWide) {
            MainScaffold(
                appVersion = "0.1.0 (1)",
                onSignOut = {},
                profile = ShellFixtures.first,
                theme =
                    dev.greprepapp.app.core.theme.ThemeState(
                        theme =
                            if (theme ==
                                "dark"
                            ) {
                                dev.greprepapp.app.core.theme.AppTheme.Dark
                            } else {
                                dev.greprepapp.app.core.theme.AppTheme.Light
                            },
                        restoring = false,
                        largeText = capturingLarge,
                    ),
            ) {}
        } else {
            SettingsScreen(
                appVersion = "0.1.0 (1)",
                onSignOut = {},
                onBack = {},
                profile = ShellFixtures.first,
                theme =
                    dev.greprepapp.app.core.theme.ThemeState(
                        theme =
                            if (theme ==
                                "dark"
                            ) {
                                dev.greprepapp.app.core.theme.AppTheme.Dark
                            } else {
                                dev.greprepapp.app.core.theme.AppTheme.Light
                            },
                        restoring = false,
                        largeText = capturingLarge,
                    ),
            )
        }
    }

    private fun Bitmap.isSingleColor(): Boolean {
        val first = getPixel(0, 0)
        val step = SAMPLE_STEP
        for (y in 0 until height step step) {
            for (x in 0 until width step step) {
                if (getPixel(x, y) != first) return false
            }
        }
        return true
    }

    protected companion object {
        const val FRAME_TIME = 300L
        const val ATTEMPTS = 3
        const val SAMPLE_STEP = 16
    }
}
