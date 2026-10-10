package dev.greprepapp.app.flow

import android.app.UiModeManager
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.core.view.WindowCompat
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dev.greprepapp.app.MainActivity
import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.DevThemeReceiver
import dev.greprepapp.app.core.theme.ThemeManager
import dev.greprepapp.app.testing.MemoryThemeStore
import dev.greprepapp.app.testing.NightModeResetRule
import greprep.design.GpDarkColors
import greprep.design.GpLightColors
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.android.controller.ActivityController
import org.robolectric.annotation.Config
import javax.inject.Inject
import dev.greprepapp.design.R as DesignR

/** Первый видимый экран использует выбор устройства, даже когда система светлая. */
@OptIn(ExperimentalTestApi::class)
@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
@Config(application = HiltTestApplication::class, sdk = [26, 31, 37], qualifiers = "ru-w411dp-h914dp-notnight-420dpi")
class ThemeFlowTest {
    @get:Rule(order = -1)
    val nightMode = NightModeResetRule()

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createEmptyComposeRule()

    @Inject lateinit var server: FakeServer

    @Inject lateinit var themes: MemoryThemeStore

    @Inject lateinit var manager: javax.inject.Provider<ThemeManager>
    private var scenario: ActivityScenario<MainActivity>? = null
    private var controller: ActivityController<MainActivity>? = null

    @After
    fun tearDown() {
        scenario?.close()
        controller?.pause()?.stop()?.destroy()
    }

    @Test
    fun noChoiceStartsDark() = start(AppTheme.Dark, Configuration.UI_MODE_NIGHT_YES)

    @Test
    fun savedLightStartsLight() = start(AppTheme.Light, Configuration.UI_MODE_NIGHT_NO)

    @Test
    fun delayedReadKeepsTheSplashAndDoesNotComposeTheWrongTheme() {
        hilt.inject()
        themes.choice = AppTheme.Light
        themes.gate = CompletableDeferred()
        // ActivityScenario.launch ждёт видимый кадр и зацикливается на удерживаемой заставке API 26.
        // Создаём Activity до visible: проверка действительно проходит до первого кадра.
        val activityController = Robolectric.buildActivity(MainActivity::class.java).create()
        controller = activityController
        assertTrue(
            manager
                .get()
                .state.value.restoring,
        )
        val activity = activityController.get()
        assertEquals(0, activity.findViewById<ViewGroup>(android.R.id.content).childCount)
        assertEquals((if (Build.VERSION.SDK_INT >= 31) GpLightColors else GpDarkColors).bg.toArgb(), activity.getColor(DesignR.color.gp_bg))
        themes.gate?.complete(Unit)
        activityController.start().resume().visible()
        compose.waitUntilAtLeastOneExists(hasTestTag("signin.apple"), TIMEOUT)
        assertFalse(
            manager
                .get()
                .state.value.restoring,
        )
        assertEquals(
            GpLightColors.bg.toArgb(),
            compose
                .onRoot()
                .captureToImage()
                .asAndroidBitmap()
                .getPixel(0, 0),
        )
    }

    @Test
    fun themeChangesRecolorTheWindowAndComposeWithoutRecreatingActivity() {
        start(AppTheme.Dark, Configuration.UI_MODE_NIGHT_YES)
        lateinit var original: MainActivity
        scenario?.onActivity { original = it }
        runBlocking { manager.get().select(AppTheme.Light) }
        compose.waitForIdle()
        compose.waitUntil(TIMEOUT) {
            original.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_NO
        }
        scenario?.onActivity { activity ->
            assertSame(original, activity)
            assertEquals(GpLightColors.bg.toArgb(), (activity.window.decorView.background as ColorDrawable).color)
            assertTrue(WindowCompat.getInsetsController(activity.window, activity.window.decorView).isAppearanceLightStatusBars)
        }
        assertEquals(
            GpLightColors.bg.toArgb(),
            compose
                .onRoot()
                .captureToImage()
                .asAndroidBitmap()
                .getPixel(0, 0),
        )
        assertApplicationMode(AppTheme.Light)
        runBlocking { manager.get().select(AppTheme.Dark) }
        compose.waitForIdle()
        compose.waitUntil(TIMEOUT) {
            original.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        }
        scenario?.onActivity { activity ->
            assertSame(original, activity)
            assertEquals(GpDarkColors.bg.toArgb(), (activity.window.decorView.background as ColorDrawable).color)
            assertFalse(WindowCompat.getInsetsController(activity.window, activity.window.decorView).isAppearanceLightStatusBars)
        }
        assertApplicationMode(AppTheme.Dark)
    }

    @Test
    fun composeOwnsUiModeConfigurationChanges() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val info = context.packageManager.getActivityInfo(android.content.ComponentName(context, MainActivity::class.java), 0)
        assertNotEquals(0, info.configChanges and ActivityInfo.CONFIG_UI_MODE)
    }

    @Test
    fun debugBroadcastWritesAChoiceThroughThemeManager() {
        start(AppTheme.Dark, Configuration.UI_MODE_NIGHT_YES)
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.sendBroadcast(
            android.content.Intent().apply {
                component = android.content.ComponentName(context, DevThemeReceiver::class.java)
                putExtra("theme", "light")
            },
        )
        compose.waitForIdle()
        compose.waitUntil(TIMEOUT) {
            themes.choice == AppTheme.Light && manager
                .get()
                .state.value.theme == AppTheme.Light
        }
        compose.waitForIdle()
        assertApplicationMode(AppTheme.Light)
    }

    @Test
    fun invalidDebugChoiceIsReportedWithoutChangingTheTheme() {
        start(AppTheme.Dark, Configuration.UI_MODE_NIGHT_YES)
        broadcastTheme("private invalid value")
        compose.waitUntil(TIMEOUT) { server.clientErrors.isNotEmpty() }
        assertTrue(server.clientErrors.single().contains("dev theme choice invalid"))
        assertFalse(server.clientErrors.single().contains("private invalid value"))
        assertEquals(AppTheme.Dark, themes.choice)
        assertEquals(
            AppTheme.Dark,
            manager
                .get()
                .state.value.theme,
        )
    }

    @Test
    fun failedDebugWriteIsReportedAndKeepsThePreviousTheme() {
        start(AppTheme.Dark, Configuration.UI_MODE_NIGHT_YES)
        themes.saveFailure = java.io.IOException("private file path")
        broadcastTheme("light")
        compose.waitUntil(TIMEOUT) { server.clientErrors.isNotEmpty() }
        assertTrue(server.clientErrors.single().contains("dev theme selection failed: IOException"))
        assertFalse(server.clientErrors.single().contains("private file path"))
        assertEquals(AppTheme.Dark, themes.choice)
        assertEquals(
            AppTheme.Dark,
            manager
                .get()
                .state.value.theme,
        )
        assertApplicationMode(AppTheme.Dark)
    }

    private fun broadcastTheme(choice: String) {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.sendBroadcast(
            android.content.Intent().apply {
                component = android.content.ComponentName(context, DevThemeReceiver::class.java)
                putExtra("theme", choice)
            },
        )
        compose.waitForIdle()
    }

    private fun assertApplicationMode(choice: AppTheme) {
        if (Build.VERSION.SDK_INT >= 31) {
            val context = ApplicationProvider.getApplicationContext<Context>()
            assertEquals(
                if (choice == AppTheme.Dark) UiModeManager.MODE_NIGHT_YES else UiModeManager.MODE_NIGHT_NO,
                shadowOf(context.getSystemService(UiModeManager::class.java)).applicationNightMode,
            )
        }
    }

    private fun start(
        choice: AppTheme,
        expectedNight: Int,
    ) {
        hilt.inject()
        themes.choice = choice
        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.waitUntilAtLeastOneExists(hasTestTag("signin.apple"), TIMEOUT)
        compose.onNodeWithTag("signin.apple").assertIsDisplayed()
        assertApplicationMode(choice)
        val expectedBackground = if (choice == AppTheme.Dark) GpDarkColors.bg else GpLightColors.bg
        assertEquals(
            expectedBackground.toArgb(),
            compose
                .onRoot()
                .captureToImage()
                .asAndroidBitmap()
                .getPixel(0, 0),
        )
        scenario?.onActivity { activity ->
            assertEquals(expectedNight, activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK)
            assertEquals(expectedBackground.toArgb(), activity.getColor(DesignR.color.gp_bg))
        }
    }

    private companion object {
        const val TIMEOUT = 5_000L
    }
}
