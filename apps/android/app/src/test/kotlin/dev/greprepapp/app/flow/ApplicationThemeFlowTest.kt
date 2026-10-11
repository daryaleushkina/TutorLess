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
import dev.greprepapp.app.testing.NightModeResetRule
import greprep.design.GpDarkColors
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.shadow.api.Shadow
import org.robolectric.util.ReflectionHelpers.ClassParameter

/** Настоящие Application, Hilt и DataStore: первый экран без выбора не наследует светлую систему. */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(
    application = GrePrepApplication::class,
    sdk = [26, 31, 37],
    qualifiers = "ru-w411dp-h914dp-notnight-420dpi",
    shadows = [StartupNightModeShadow::class],
)
class ApplicationThemeFlowTest {
    @get:Rule(order = -1)
    val nightMode = NightModeResetRule()

    @get:Rule val compose = createEmptyComposeRule()
    private var scenario: ActivityScenario<MainActivity>? = null

    @After
    fun tearDown() {
        scenario?.close()
        ApplicationProvider.getApplicationContext<GrePrepApplication>().appScope.cancel()
    }

    @Test
    fun productionStartupReadsDataStoreAndShowsDarkSignIn() {
        // Shadow записывает именно первый вызов из attachBaseContext настоящего Application,
        // до восстановления DataStore и до attachBaseContext Activity.
        assertEquals(
            if (android.os.Build.VERSION.SDK_INT >= 31) AppCompatDelegate.MODE_NIGHT_NO else AppCompatDelegate.MODE_NIGHT_YES,
            StartupNightModeShadow.modes.first(),
        )
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

/** Наблюдаем публичный setter; сам AppCompat и путь запуска остаются настоящими. */
@Implements(AppCompatDelegate::class)
class StartupNightModeShadow {
    companion object {
        val modes = mutableListOf<Int>()

        @JvmStatic
        @Implementation
        fun setDefaultNightMode(mode: Int) {
            modes += mode
            Shadow.directlyOn<Unit, AppCompatDelegate>(
                AppCompatDelegate::class.java,
                "setDefaultNightMode",
                ClassParameter.from(Int::class.javaPrimitiveType, mode),
            )
        }
    }
}
