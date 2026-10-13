package dev.greprepapp.app.flow

import android.content.res.Configuration
import android.os.Looper
import android.view.ViewGroup
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithTag
import dagger.hilt.android.testing.BindValue
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dagger.hilt.android.testing.UninstallModules
import dev.greprepapp.app.MainActivity
import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.ThemeManager
import dev.greprepapp.app.core.theme.ThemeModeApplier
import dev.greprepapp.app.di.ThemeModule
import dev.greprepapp.app.testing.NightModeResetRule
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration
import javax.inject.Inject

@OptIn(ExperimentalTestApi::class)
@HiltAndroidTest
@UninstallModules(ThemeModule::class)
@RunWith(RobolectricTestRunner::class)
@Config(application = HiltTestApplication::class, sdk = [26, 31, 37], qualifiers = "ru-w411dp-h914dp-notnight-420dpi")
class ThemeResourceTimeoutFlowTest {
    @get:Rule(order = -1)
    val nightMode = NightModeResetRule()

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createEmptyComposeRule()

    // Производитель принимает выбор, но не обновляет uiMode и не присылает конфигурацию.
    @BindValue @JvmField
    val applier = ThemeModeApplier { }

    @Inject @dev.greprepapp.app.core.AppScope
    lateinit var processScope: kotlinx.coroutines.CoroutineScope

    @Inject lateinit var manager: javax.inject.Provider<ThemeManager>

    @Inject lateinit var server: FakeServer

    @org.junit.After
    fun stopProcessScope() {
        processScope.cancel()
    }

    @Test fun themeChangedWhileStoppedWaitsForAFullVisibleDeadline() {
        hilt.inject()
        androidx.appcompat.app.AppCompatDelegate
            .setDefaultNightMode(androidx.appcompat.app.AppCompatDelegate.MODE_NIGHT_NO)
        val controller =
            Robolectric
                .buildActivity(MainActivity::class.java)
                .create()
                .start()
                .resume()
        try {
            compose.waitUntil(5_000) {
                !manager
                    .get()
                    .state.value.restoring
            }
            // Совпавшая светлая тема, затем выбор тёмной, пока конфигурацию Activity не доставляют.
            runBlocking { manager.get().select(AppTheme.Light) }
            shadowOf(Looper.getMainLooper()).idle()
            controller.pause().stop()
            runBlocking { manager.get().select(AppTheme.Dark) }
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(5))
            compose.waitForIdle()
            assertEquals("Остановленная Activity не должна сообщать несовпадение", 0, server.clientErrors.size)

            controller.start()
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1_999))
            assertEquals(0, server.clientErrors.size)
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1))
            compose.waitUntil(5_000) { server.clientErrors.isNotEmpty() }
            assertEquals(1, server.clientErrors.size)
            assertTrue(server.clientErrors.single().contains("theme resources mismatch"))
        } finally {
            controller.pause().stop().destroy()
        }
    }

    @Test fun stoppingDuringTheDeadlineRestartsItOnNextStart() {
        hilt.inject()
        androidx.appcompat.app.AppCompatDelegate
            .setDefaultNightMode(androidx.appcompat.app.AppCompatDelegate.MODE_NIGHT_NO)
        val controller =
            Robolectric
                .buildActivity(MainActivity::class.java)
                .create()
                .start()
                .resume()
        try {
            compose.waitUntil(5_000) {
                !manager
                    .get()
                    .state.value.restoring
            }
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1_500))
            controller.pause().stop()
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(5))
            compose.waitForIdle()
            assertEquals(0, server.clientErrors.size)
            controller.start()
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1_999))
            assertEquals(0, server.clientErrors.size)
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1))
            compose.waitUntil(5_000) { server.clientErrors.isNotEmpty() }
            assertEquals(1, server.clientErrors.size)
        } finally {
            controller.pause().stop().destroy()
        }
    }

    @Test fun missingUiModeUpdateReportsOnceAndReleasesTheSplashAfterTwoSeconds() {
        hilt.inject()
        androidx.appcompat.app.AppCompatDelegate
            .setDefaultNightMode(androidx.appcompat.app.AppCompatDelegate.MODE_NIGHT_NO)
        val controller =
            Robolectric
                .buildActivity(MainActivity::class.java)
                .create()
                .start()
                .resume()
        try {
            val activity = controller.get()
            compose.waitUntil(5_000) {
                !manager
                    .get()
                    .state.value.restoring
            }
            val content = activity.findViewById<ViewGroup>(android.R.id.content)
            assertEquals(Configuration.UI_MODE_NIGHT_NO, activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK)
            assertEquals(0, content.childCount)
            assertTrue(content.viewTreeObserver.dispatchOnPreDraw())
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1_999))
            assertEquals(0, content.childCount)
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1))
            assertFalse(content.viewTreeObserver.dispatchOnPreDraw())
            controller.visible()
            compose.waitUntilAtLeastOneExists(hasTestTag("signin.apple"), 5_000)
            compose.onNodeWithTag("signin.apple").assertIsDisplayed()
            compose.waitUntil(5_000) { server.clientErrors.isNotEmpty() }
            assertEquals(1, server.clientErrors.size)
            assertTrue(server.clientErrors.single().contains("theme resources mismatch"))
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(5))
            assertEquals(1, server.clientErrors.size)
        } finally {
            controller.pause().stop().destroy()
        }
    }
}
