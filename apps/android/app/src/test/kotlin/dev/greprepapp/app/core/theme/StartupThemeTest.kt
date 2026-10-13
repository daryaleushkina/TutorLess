package dev.greprepapp.app.core.theme

import android.content.res.Configuration
import dev.greprepapp.app.core.session.SessionState
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StartupThemeTest {
    @Test
    fun splashWaitsForThemeResourcesAndSession() {
        val day = Configuration.UI_MODE_TYPE_NORMAL or Configuration.UI_MODE_NIGHT_NO
        val night = Configuration.UI_MODE_TYPE_NORMAL or Configuration.UI_MODE_NIGHT_YES
        for (choice in AppTheme.entries) {
            val matching = if (choice == AppTheme.Dark) night else day
            val wrong = if (choice == AppTheme.Dark) day else night
            val ready = ThemeState(choice, restoring = false)
            assertTrue(shouldKeepSplash(ThemeState(choice), SessionState.SignedOut(null), matching))
            assertTrue(shouldKeepSplash(ready, SessionState.Restoring, matching))
            assertTrue(shouldKeepSplash(ready, SessionState.SignedOut(null), wrong))
            assertFalse(shouldKeepSplash(ready, SessionState.SignedOut(null), wrong, resourcesTimedOut = true))
            assertTrue(shouldKeepSplash(ready, SessionState.Restoring, wrong, resourcesTimedOut = true))
            assertTrue(shouldKeepSplash(ThemeState(choice), SessionState.SignedOut(null), wrong, resourcesTimedOut = true))
            assertFalse(shouldKeepSplash(ready, SessionState.SignedOut(null), matching))
        }
    }

    @Test
    fun composeWaitsForTheSameThemeAsTheWindow() {
        for (choice in AppTheme.entries) {
            val mode = if (choice == AppTheme.Dark) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
            val other = if (choice == AppTheme.Dark) Configuration.UI_MODE_NIGHT_NO else Configuration.UI_MODE_NIGHT_YES
            assertFalse(isThemeReady(ThemeState(choice), mode))
            assertFalse(isThemeReady(ThemeState(choice, restoring = false), other))
            assertTrue(isThemeReady(ThemeState(choice, restoring = false), mode))
        }
    }
}
