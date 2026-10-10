package dev.greprepapp.app.core.theme

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import androidx.appcompat.app.AppCompatDelegate
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [26, 31, 37])
class AppNightModeTest {
    @Test
    @Config(qualifiers = "notnight")
    fun beforeFirstActivityReadsTheApplicationConfigurationOnModernAndroid() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertEquals(Configuration.UI_MODE_NIGHT_NO, context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK)
        assertEquals(
            if (Build.VERSION.SDK_INT >=
                31
            ) {
                AppCompatDelegate.MODE_NIGHT_NO
            } else {
                AppCompatDelegate.MODE_NIGHT_YES
            },
            AppNightMode.initialMode(context),
        )
    }

    @Test
    @Config(qualifiers = "night")
    fun darkApplicationConfigurationStartsDark() {
        assertEquals(AppCompatDelegate.MODE_NIGHT_YES, AppNightMode.initialMode(ApplicationProvider.getApplicationContext()))
    }
}
