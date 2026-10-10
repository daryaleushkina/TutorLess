package dev.greprepapp.app.testing

import androidx.appcompat.app.AppCompatDelegate
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runners.model.Statement
import org.robolectric.util.ReflectionHelpers

/** AppCompat хранит режим статически: даже упавший сценарий не должен менять следующий. */
class NightModeResetRule : TestRule {
    override fun apply(
        base: Statement,
        description: Description,
    ): Statement =
        object : Statement() {
            override fun evaluate() {
                try {
                    base.evaluate()
                } finally {
                    // Публичный setter в AppCompat 1.8 отклоняет UNSPECIFIED (-100). В тесте возвращаем
                    // статическое поле к состоянию нового процесса; активные Activity уже закрыты.
                    ReflectionHelpers.setStaticField(
                        AppCompatDelegate::class.java,
                        "sDefaultNightMode",
                        AppCompatDelegate.MODE_NIGHT_UNSPECIFIED,
                    )
                }
            }
        }
}
