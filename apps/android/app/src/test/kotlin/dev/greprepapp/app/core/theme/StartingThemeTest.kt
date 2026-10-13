package dev.greprepapp.app.core.theme

import android.content.Context
import androidx.compose.ui.graphics.toArgb
import androidx.test.core.app.ApplicationProvider
import dev.greprepapp.app.R
import greprep.design.GpDarkColors
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import dev.greprepapp.design.R as DesignR

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [26, 31, 37], qualifiers = "notnight")
class StartingThemeTest {
    @Test
    fun bothStartingBackgroundsAreDarkEvenBeforeTheProcessChoosesATheme() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val attributes =
            context.obtainStyledAttributes(
                R.style.Theme_GrePrep_Starting,
                intArrayOf(android.R.attr.windowBackground, androidx.core.splashscreen.R.attr.windowSplashScreenBackground),
            )
        try {
            assertEquals(DesignR.color.gp_bg_dark, attributes.getResourceId(0, 0))
            assertEquals(DesignR.color.gp_bg_dark, attributes.getResourceId(1, 0))
            assertEquals(GpDarkColors.bg.toArgb(), context.getColor(DesignR.color.gp_bg_dark))
        } finally {
            attributes.recycle()
        }
    }
}
