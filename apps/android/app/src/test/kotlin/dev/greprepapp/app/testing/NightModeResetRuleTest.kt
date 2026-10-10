package dev.greprepapp.app.testing

import androidx.appcompat.app.AppCompatDelegate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.Description
import org.junit.runner.RunWith
import org.junit.runners.model.Statement
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class NightModeResetRuleTest {
    @Test
    fun clearsTheStaticModeEvenWhenTheTestFails() {
        val expected =
            assertThrows(AssertionError::class.java) {
                NightModeResetRule()
                    .apply(
                        object : Statement() {
                            override fun evaluate() {
                                AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
                                throw AssertionError("expected failure")
                            }
                        },
                        Description.EMPTY,
                    ).evaluate()
            }
        assertEquals("expected failure", expected.message)
        assertEquals(AppCompatDelegate.MODE_NIGHT_UNSPECIFIED, AppCompatDelegate.getDefaultNightMode())
    }
}
