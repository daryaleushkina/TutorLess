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
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.core.view.WindowCompat
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dev.greprepapp.app.MainActivity
import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.ThemeManager
import dev.greprepapp.app.testing.MemoryThemeStore
import dev.greprepapp.app.testing.NightModeResetRule
import greprep.design.GpDarkColors
import greprep.design.GpLightColors
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.cancel
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
@dagger.hilt.android.testing.UninstallModules(dev.greprepapp.app.di.ContentModule::class)
@RunWith(RobolectricTestRunner::class)
@Config(application = HiltTestApplication::class, sdk = [26, 31, 37], qualifiers = "ru-w411dp-h914dp-notnight-420dpi")
class ThemeFlowTest {
    @dagger.hilt.android.testing.BindValue @JvmField
    val installer: dev.greprepapp.app.ui.ActivityContentInstaller = CountingContentInstaller()

    @get:Rule(order = -1)
    val nightMode = NightModeResetRule()

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createEmptyComposeRule()

    @Inject @dev.greprepapp.app.core.AppScope
    lateinit var processScope: kotlinx.coroutines.CoroutineScope

    @Inject lateinit var tokens: dev.greprepapp.app.testing.MemoryTokenStore

    @Inject lateinit var server: FakeServer

    @Inject lateinit var themes: MemoryThemeStore

    @Inject lateinit var manager: javax.inject.Provider<ThemeManager>
    private var scenario: ActivityScenario<MainActivity>? = null
    private var controller: ActivityController<MainActivity>? = null

    @After
    fun tearDown() {
        if (::processScope.isInitialized) processScope.cancel()
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
        // dispatchOnPreDraw возвращает отмену кадра, а не разрешение рисования.
        assertTrue(activity.findViewById<ViewGroup>(android.R.id.content).viewTreeObserver.dispatchOnPreDraw())
        assertEquals((if (Build.VERSION.SDK_INT >= 31) GpLightColors else GpDarkColors).bg.toArgb(), activity.getColor(DesignR.color.gp_bg))
        themes.gate?.complete(Unit)
        activityController.start().resume().visible()
        compose.waitUntilAtLeastOneExists(hasTestTag("signin.apple"), TIMEOUT)
        assertFalse(activity.findViewById<ViewGroup>(android.R.id.content).viewTreeObserver.dispatchOnPreDraw())
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
    fun systemNightChangeCannotOverrideTheSavedLightChoice() {
        hilt.inject()
        themes.choice = AppTheme.Light
        val activityController = Robolectric.buildActivity(MainActivity::class.java).setup()
        controller = activityController
        compose.waitUntilAtLeastOneExists(hasTestTag("signin.apple"), TIMEOUT)
        val original = activityController.get()
        val content = original.findViewById<ViewGroup>(android.R.id.content).getChildAt(0)
        val systemNight =
            Configuration(original.resources.configuration).apply {
                uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or Configuration.UI_MODE_NIGHT_YES
            }
        activityController.configurationChange(systemNight)
        compose.waitForIdle()
        assertSame(original, activityController.get())
        assertSame(content, original.findViewById<ViewGroup>(android.R.id.content).getChildAt(0))
        assertEquals(GpLightColors.bg.toArgb(), original.getColor(DesignR.color.gp_bg))
        assertEquals(GpLightColors.bg.toArgb(), (original.window.decorView.background as ColorDrawable).color)
        assertTrue(WindowCompat.getInsetsController(original.window, original.window.decorView).isAppearanceLightStatusBars)
        assertFalse(original.findViewById<ViewGroup>(android.R.id.content).viewTreeObserver.dispatchOnPreDraw())
        compose.onNodeWithTag("signin.apple").assertIsDisplayed()
    }

    @Test
    fun themeChangePreservesTheContentViewAndDeeperNavigation() {
        hilt.inject()
        server.issue("saved")
        tokens.token = "saved"
        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.waitUntilAtLeastOneExists(hasTestTag("today.plan"), TIMEOUT)
        compose.onNodeWithTag("tab.progress").performClick()
        compose.onNodeWithTag("progress.settings").performClick()
        compose.onNodeWithTag("settings.signOut").assertIsDisplayed()
        lateinit var original: MainActivity
        lateinit var content: android.view.View
        scenario?.onActivity {
            original = it
            content = it.findViewById<ViewGroup>(android.R.id.content).getChildAt(0)
        }
        val installations = installer as CountingContentInstaller
        assertEquals(1, installations.count)
        for (choice in listOf(AppTheme.Light, AppTheme.Dark)) {
            runBlocking { manager.get().select(choice) }
            compose.waitForIdle()
            compose.onNodeWithTag("settings.signOut").assertIsDisplayed()
            scenario?.onActivity {
                assertSame(original, it)
                assertSame(content, it.findViewById<ViewGroup>(android.R.id.content).getChildAt(0))
                assertEquals(1, installations.count)
            }
        }
    }

    @Test
    fun composeOwnsUiModeConfigurationChanges() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val info = context.packageManager.getActivityInfo(android.content.ComponentName(context, MainActivity::class.java), 0)
        assertNotEquals(0, info.configChanges and ActivityInfo.CONFIG_UI_MODE)
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

/** Compose сохраняет remember даже после повторного setContent; считаем и лишние установки корня. */
private class CountingContentInstaller : dev.greprepapp.app.ui.ActivityContentInstaller {
    var count = 0
    private val delegate =
        dev.greprepapp.app.ui
            .ComposeActivityContentInstaller()

    override fun install(
        activity: androidx.activity.ComponentActivity,
        content: @androidx.compose.runtime.Composable () -> Unit,
    ) {
        count++
        delegate.install(activity, content)
    }
}
