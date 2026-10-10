package dev.greprepapp.app.flow

import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import dev.greprepapp.app.GrePrepApplication
import dev.greprepapp.app.MainActivity
import greprep.design.GpDarkColors
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Настоящие Application, Hilt и DataStore: первый экран без выбора не наследует светлую систему. */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(application = GrePrepApplication::class, qualifiers = "ru-w411dp-h914dp-notnight-420dpi")
class ApplicationThemeFlowTest {
    @get:Rule val compose = createEmptyComposeRule()
    private var scenario: ActivityScenario<MainActivity>? = null

    @After
    fun tearDown() {
        scenario?.close()
        ApplicationProvider.getApplicationContext<GrePrepApplication>().scope.cancel()
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_UNSPECIFIED)
    }

    @Test
    fun productionStartupReadsDataStoreAndShowsDarkSignIn() {
        assertEquals(AppCompatDelegate.MODE_NIGHT_YES, AppCompatDelegate.getDefaultNightMode())
        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.waitUntilAtLeastOneExists(hasTestTag("signin.apple"), TIMEOUT)
        assertEquals(
            GpDarkColors.bg.toArgb(),
            compose
                .onRoot()
                .captureToImage()
                .asAndroidBitmap()
                .getPixel(0, 0),
        )
    }

    private companion object {
        const val TIMEOUT = 5_000L
    }
}
