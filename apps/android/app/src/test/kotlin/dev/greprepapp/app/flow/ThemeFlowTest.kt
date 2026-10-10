package dev.greprepapp.app.flow

import android.content.res.Configuration
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
import androidx.test.core.app.ActivityScenario
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dev.greprepapp.app.MainActivity
import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.ThemeManager
import dev.greprepapp.app.testing.MemoryThemeStore
import greprep.design.GpDarkColors
import greprep.design.GpLightColors
import kotlinx.coroutines.CompletableDeferred
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
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
    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createEmptyComposeRule()

    @Inject lateinit var themes: MemoryThemeStore

    @Inject lateinit var manager: javax.inject.Provider<ThemeManager>
    private var scenario: ActivityScenario<MainActivity>? = null
    private var controller: ActivityController<MainActivity>? = null

    @After
    fun tearDown() {
        scenario?.close()
        controller?.pause()?.stop()?.destroy()
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_UNSPECIFIED)
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
        assertEquals(GpDarkColors.bg.toArgb(), activity.getColor(DesignR.color.gp_bg))
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

    private fun start(
        choice: AppTheme,
        expectedNight: Int,
    ) {
        hilt.inject()
        themes.choice = choice
        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.waitUntilAtLeastOneExists(hasTestTag("signin.apple"), TIMEOUT)
        compose.onNodeWithTag("signin.apple").assertIsDisplayed()
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
