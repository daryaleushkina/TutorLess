package dev.greprepapp.app.testing

import android.content.ComponentName
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.core.app.ApplicationProvider
import org.junit.runner.Description
import org.junit.runners.model.Statement
import org.robolectric.Shadows.shadowOf

/**
 * createComposeRule запускает пустую ComponentActivity. В release её нет в APK, а AGP берёт бинарные
 * ресурсы unit-тестов из основного APK, без src/test/AndroidManifest.xml. Регистрируем только эту
 * тестовую Activity в PackageManager Robolectric; настоящий manifest приложения не подменяем.
 */
fun createAppComposeRule(): ComposeContentTestRule = AppComposeRule(createComposeRule())

private class AppComposeRule(
    private val delegate: ComposeContentTestRule,
) : ComposeContentTestRule by delegate {
    override fun apply(
        base: Statement,
        description: Description,
    ): Statement {
        val original = delegate.apply(base, description)
        return object : Statement() {
            override fun evaluate() {
                val context = ApplicationProvider.getApplicationContext<Context>()
                val component = ComponentName(context, ComponentActivity::class.java)
                try {
                    context.packageManager.getActivityInfo(component, 0)
                } catch (_: PackageManager.NameNotFoundException) {
                    shadowOf(context.packageManager).addOrUpdateActivity(
                        ActivityInfo().apply {
                            name = component.className
                            packageName = component.packageName
                            applicationInfo = context.applicationInfo
                            exported = true
                            // Без флага NATIVE рисует однотонное окно, хотя семантика Compose уже есть.
                            flags = ActivityInfo.FLAG_HARDWARE_ACCELERATED
                            theme = android.R.style.Theme_Material_Light_NoActionBar
                        },
                    )
                }
                original.evaluate()
            }
        }
    }
}
