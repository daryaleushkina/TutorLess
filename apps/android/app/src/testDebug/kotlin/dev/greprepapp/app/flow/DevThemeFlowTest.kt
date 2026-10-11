package dev.greprepapp.app.flow

import android.app.Activity
import android.app.UiModeManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.core.app.ApplicationProvider
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dev.greprepapp.app.core.AppScope
import dev.greprepapp.app.core.report.ClientErrorReporter
import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.DevThemeReceiver
import dev.greprepapp.app.core.theme.ThemeManager
import dev.greprepapp.app.testing.MemoryThemeStore
import dev.greprepapp.app.testing.NightModeResetRule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import javax.inject.Inject

@OptIn(ExperimentalTestApi::class)
@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
@Config(application = HiltTestApplication::class, sdk = [31])
class DevThemeFlowTest {
    @get:Rule(order = -1)
    val nightMode = NightModeResetRule()

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createEmptyComposeRule()

    @Inject lateinit var themes: MemoryThemeStore

    @Inject lateinit var manager: javax.inject.Provider<ThemeManager>

    @Inject lateinit var reporter: ClientErrorReporter

    @Inject lateinit var server: FakeServer

    @Inject @AppScope
    lateinit var scope: CoroutineScope

    @org.junit.After
    fun stopProcessScope() {
        scope.cancel()
    }

    @Test fun orderedBroadcastAppliesThemeWithoutActivityAndReturnsSuccess() {
        hilt.inject()
        manager.get()
        val result = broadcastTheme("light")
        assertEquals(Activity.RESULT_OK, result.first)
        compose.waitUntil(TIMEOUT) {
            shadowOf(android.os.Looper.getMainLooper()).idle()
            AppCompatDelegate.getDefaultNightMode() == AppCompatDelegate.MODE_NIGHT_NO
        }
        assertEquals(AppTheme.Light, themes.choice)
        assertEquals(
            AppTheme.Light,
            manager
                .get()
                .state.value.theme,
        )
        assertEquals(
            UiModeManager.MODE_NIGHT_NO,
            shadowOf(ApplicationProvider.getApplicationContext<Context>().getSystemService(UiModeManager::class.java)).applicationNightMode,
        )
    }

    @Test fun invalidChoiceReturnsCanceledAndReportsNoInput() {
        hilt.inject()
        val result = broadcastTheme("private invalid value")
        assertEquals(Activity.RESULT_CANCELED, result.first)
        assertEquals("dev theme choice invalid", result.second)
        compose.waitUntil(TIMEOUT) { server.clientErrors.isNotEmpty() }
        assertTrue(server.clientErrors.single().contains("dev theme choice invalid"))
        assertFalse(server.clientErrors.single().contains("private invalid value"))
        assertEquals(AppTheme.Dark, themes.choice)
    }

    @Test fun failedWriteReturnsCanceledWithoutDuplicatingTheStoreReport() {
        hilt.inject()
        manager.get()
        themes.saveFailure = java.io.IOException("private file path")
        themes.onSaveFailure = { reporter.report("theme save failed: IOException", "theme") }
        val result = broadcastTheme("light")
        assertEquals(Activity.RESULT_CANCELED, result.first)
        assertEquals("dev theme selection failed: IOException", result.second)
        compose.waitUntil(TIMEOUT) { server.clientErrors.isNotEmpty() }
        compose.waitForIdle()
        assertEquals(1, server.clientErrors.size)
        assertTrue(server.clientErrors.single().contains("theme save failed: IOException"))
        assertFalse(server.clientErrors.single().contains("private file path"))
        assertEquals(AppTheme.Dark, themes.choice)
        assertEquals(
            AppTheme.Dark,
            manager
                .get()
                .state.value.theme,
        )
    }

    @Test fun unexpectedSelectionFailureReportsOnlyItsType() {
        hilt.inject()
        manager.get()
        themes.saveFailure = IllegalStateException("private file path and choice")
        val result = broadcastTheme("light")
        assertEquals(Activity.RESULT_CANCELED, result.first)
        assertEquals("dev theme selection failed: IllegalStateException", result.second)
        compose.waitUntil(TIMEOUT) { server.clientErrors.isNotEmpty() }
        assertEquals(1, server.clientErrors.size)
        assertTrue(server.clientErrors.single().contains("dev theme selection failed: IllegalStateException"))
        assertFalse(server.clientErrors.single().contains("private file path and choice"))
        assertEquals(AppTheme.Dark, themes.choice)
    }

    @Test fun securityFailureDoesNotDuplicateTheStoreReport() {
        hilt.inject()
        manager.get()
        themes.saveFailure = SecurityException("private file path")
        themes.onSaveFailure = { reporter.report("theme save failed: SecurityException", "theme") }
        val result = broadcastTheme("light")
        assertEquals(Activity.RESULT_CANCELED, result.first)
        compose.waitUntil(TIMEOUT) { server.clientErrors.isNotEmpty() }
        compose.waitForIdle()
        assertEquals(1, server.clientErrors.size)
        assertTrue(server.clientErrors.single().contains("theme save failed: SecurityException"))
        assertFalse(server.clientErrors.single().contains("private file path"))
    }

    @Test fun canceledProcessScopeStillFinishesTheOrderedBroadcast() {
        hilt.inject()
        manager.get()
        scope.cancel()
        val result = broadcastTheme("light")
        assertEquals(Activity.RESULT_CANCELED, result.first)
        assertEquals("dev theme selection canceled", result.second)
        assertEquals(AppTheme.Dark, themes.choice)
    }

    private fun broadcastTheme(choice: String): Pair<Int, String?> {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val receiver = DevThemeReceiver()
        // Robolectric не доставляет итог explicit ordered broadcast без intent-filter.
        // Создаём настоящий PendingResult и проверяем его finish через штатный shadow.
        val pending =
            org.robolectric.util.ReflectionHelpers.callStaticMethod<BroadcastReceiver.PendingResult>(
                org.robolectric.shadows.ShadowBroadcastPendingResult::class.java,
                "create",
                org.robolectric.util.ReflectionHelpers.ClassParameter
                    .from(Int::class.javaPrimitiveType, Activity.RESULT_OK),
                org.robolectric.util.ReflectionHelpers.ClassParameter
                    .from(String::class.java, null),
                org.robolectric.util.ReflectionHelpers.ClassParameter
                    .from(android.os.Bundle::class.java, null),
                org.robolectric.util.ReflectionHelpers.ClassParameter
                    .from(Boolean::class.javaPrimitiveType, true),
            )
        org.robolectric.util.ReflectionHelpers.callInstanceMethod<Unit>(
            receiver,
            "setPendingResult",
            org.robolectric.util.ReflectionHelpers.ClassParameter
                .from(BroadcastReceiver.PendingResult::class.java, pending),
        )
        receiver.onReceive(context, Intent().putExtra("theme", choice))
        if (!shadowOf(receiver).wentAsync()) pending.finish()
        val completion =
            org.robolectric.shadow.api.Shadow
                .extract<org.robolectric.shadows.ShadowBroadcastPendingResult>(pending)
                .future
        compose.waitUntil(TIMEOUT) { completion.isDone }
        return pending.resultCode to pending.resultData
    }

    private companion object {
        const val TIMEOUT = 5_000L
    }
}
