package dev.greprepapp.app.flow

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dev.greprepapp.api.models.Section
import dev.greprepapp.app.MainActivity
import dev.greprepapp.app.testing.FakeNetwork
import dev.greprepapp.app.testing.MemoryTokenStore
import dev.greprepapp.app.testing.NightModeResetRule
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import javax.inject.Inject

/**
 * Сценарии через интерфейс — как это делает человек: вход, главная тренировки с данными сервера, шаг, вкладки,
 * настройки, выход; без сети и с истёкшей сессией. Сервер — подменный (FakeServer), всё остальное — настоящее.
 */
@OptIn(ExperimentalTestApi::class)
@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
@Config(application = HiltTestApplication::class, qualifiers = "ru-" + RobolectricDeviceQualifiers.MediumPhone)
class AppFlowTest {
    @get:Rule(order = -1)
    val nightMode = NightModeResetRule()

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createEmptyComposeRule()

    @Inject @dev.greprepapp.app.core.AppScope
    lateinit var processScope: kotlinx.coroutines.CoroutineScope

    @Inject lateinit var server: FakeServer

    @Inject lateinit var tokens: MemoryTokenStore

    @Inject lateinit var network: FakeNetwork

    private var scenario: ActivityScenario<MainActivity>? = null

    @Before
    fun setUp() = hilt.inject()

    @After
    fun tearDown() {
        processScope.cancel()
        scenario?.close()
    }

    private fun launch() {
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    private fun waitFor(
        tag: String,
        timeout: Long = TIMEOUT,
    ) = compose.waitUntilAtLeastOneExists(hasTestTag(tag), timeout)

    private fun waitForText(text: String) = compose.waitUntilAtLeastOneExists(hasText(text), TIMEOUT)

    private fun signIn(name: String = "anna") {
        waitFor("signin.dev.name")
        compose.onNodeWithTag("signin.dev.name").performTextInput(name)
        compose.onNodeWithTag("signin.dev.submit").performClick()
    }

    @Test
    fun signInThenSignOut() {
        launch()
        signIn()
        waitFor("training.home")
        compose.onNodeWithTag("shell.profile").performClick()
        waitFor("settings.signOut")
        compose.onNodeWithTag("settings.signOut").performClick()
        waitFor("signin.apple")
        compose.waitUntil(TIMEOUT) { server.signedOutTokens.contains("tok-anna-1") }
        assertNull(tokens.token)
    }

    @Test
    fun expiredSessionReturnsToSignIn() {
        tokens.token = "gone"
        launch()
        waitFor("signin.expired")
        assertNull(tokens.token)
    }

    @Test
    fun providersWithoutAccountsSayNotConnectedYet() {
        launch()
        waitFor("signin.apple")
        compose.onNodeWithTag("signin.apple").performClick()
        compose.onNodeWithText("Вход с Apple ещё не подключён — он появится до беты.").assertIsDisplayed()
        compose.onNodeWithTag("signin.google").performClick()
        compose.onNodeWithText("Вход через Google ещё не подключён — он появится до беты.").assertIsDisplayed()
    }

    private companion object {
        const val TIMEOUT = 5_000L
    }
}
