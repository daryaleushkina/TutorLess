package dev.greprepapp.app.core.theme

import android.content.res.Configuration
import dev.greprepapp.app.core.session.SessionState

internal fun isThemeReady(
    state: ThemeState,
    uiMode: Int,
): Boolean =
    !state.restoring && (uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
        (if (state.theme == AppTheme.Dark) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO)

internal fun shouldKeepSplash(
    state: ThemeState,
    session: SessionState,
    uiMode: Int,
    resourcesTimedOut: Boolean = false,
): Boolean = state.restoring || (!resourcesTimedOut && !isThemeReady(state, uiMode)) || session == SessionState.Restoring
