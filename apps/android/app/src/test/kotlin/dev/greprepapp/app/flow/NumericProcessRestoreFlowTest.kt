package dev.greprepapp.app.flow

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.viewModelScope
import dev.greprepapp.app.feature.training.NumericResponse
import dev.greprepapp.app.feature.training.SessionViewModel
import dev.greprepapp.app.feature.training.StartResult
import dev.greprepapp.app.testing.Fixtures
import dev.greprepapp.app.testing.MainDispatcherRule
import dev.greprepapp.app.testing.NewQuestionFixtures
import dev.greprepapp.app.testing.Reply
import dev.greprepapp.app.testing.TestGraph
import dev.greprepapp.app.testing.createAppComposeRule
import dev.greprepapp.design.GpTheme
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "ru-w411dp-h914dp-420dpi")
class NumericProcessRestoreFlowTest {
    @get:Rule(order = 0)
    val main = MainDispatcherRule(UnconfinedTestDispatcher())

    @get:Rule(order = 1)
    val compose = createAppComposeRule()

    @get:Rule val folder = TemporaryFolder()

    @Test fun restoredCommaDraftEnablesCheckInANewViewModelWithAnEmptyResponse() =
        runTest(main.dispatcher) {
            val graph = TestGraph(this, main.dispatcher, folder.root, token = "token").also { it.settle() }
            graph.trainingsApi.start = Reply.Ok(Fixtures.session(NewQuestionFixtures.number))
            val id = (graph.trainings.start(Fixtures.lastPreset.request) as StartResult.Started).trainingId
            val models = mutableListOf<SessionViewModel>()
            val restorer = StateRestorationTester(compose)
            restorer.setContent {
                val vm = remember { SessionViewModel(id, graph.trainings, graph.clock, graph.ticker).also { models += it } }
                DisposableEffect(vm) { onDispose { vm.viewModelScope.cancel() } }
                val state by vm.state.collectAsState()
                val screen = (state as? SessionViewModel.UiState.Active)?.screen
                if (screen != null) {
                    GpTheme {
                        Column {
                            NumericResponse(screen.question, screen.response, false, vm::editResponse)
                            Button({}, enabled = screen.canCheck, modifier = Modifier.testTag("check")) { Text("Проверить") }
                        }
                    }
                }
            }
            compose.onNodeWithTag("numeric.number").performTextInput("22,5")
            compose.onNodeWithTag("check").assertIsEnabled()
            assertTrue(
                graph.trainingStore
                    .get(id)!!
                    .answers
                    .isEmpty(),
            )
            restorer.emulateSavedInstanceStateRestore()
            assertEquals(2, models.size)
            compose.onNodeWithTag("numeric.number").assertTextContains("22,5")
            compose.onNodeWithTag("check").assertIsEnabled()
            assertTrue((models.last().state.value as SessionViewModel.UiState.Active).screen.canCheck)
            graph.appScope.cancel()
        }
}
