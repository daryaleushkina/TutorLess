package dev.greprepapp.app.ui

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import javax.inject.Inject

/** Установка корня отдельно от смены темы: одну композицию сохраняем на весь срок Activity. */
interface ActivityContentInstaller {
    fun install(
        activity: ComponentActivity,
        content: @Composable () -> Unit,
    )
}

class ComposeActivityContentInstaller
    @Inject
    constructor() : ActivityContentInstaller {
        override fun install(
            activity: ComponentActivity,
            content: @Composable () -> Unit,
        ) {
            activity.setContent(content = content)
        }
    }
