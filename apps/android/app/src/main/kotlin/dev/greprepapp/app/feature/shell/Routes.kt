package dev.greprepapp.app.feature.shell

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.navigation3.runtime.NavKey
import dev.greprepapp.app.R
import dev.greprepapp.app.core.session.SignOutReason
import dev.greprepapp.app.feature.training.BuilderPrefill
import kotlinx.serialization.Serializable

/**
 * Корень приложения: вход или разделы. Ключ разделов несёт номер входа — выход и новый вход заменяют его, и
 * всё, что жило внутри (модели экранов, запросы в пути), уходит вместе со старым ключом.
 */
sealed interface RootKey {
    data class SignIn(
        val reason: SignOutReason?,
    ) : RootKey

    data class Main(
        val sessionId: Long,
    ) : RootKey
}

/**
 * Внутри входа: разделы с вкладками — первым, тренировка — поверх них. Внутри тренировки вкладок нет, только
 * одна нижняя кнопка (PRODUCT.md, «Навигация»).
 */
@Serializable
sealed interface MainRoute : NavKey {
    @Serializable
    data object Tabs : MainRoute

    @Serializable
    data class Builder(
        val prefill: BuilderPrefill? = null,
    ) : MainRoute

    @Serializable
    data class Session(
        val trainingId: String,
    ) : MainRoute

    @Serializable
    data class Review(
        val trainingId: String,
    ) : MainRoute

    @Serializable
    data class ReviewItem(
        val trainingId: String,
        val position: Int,
        val positions: List<Int> = emptyList(),
    ) : MainRoute
}

/**
 * «Назад» внутри входа: корень (вкладки) не снимается. Второе нажатие на стрелку, пока уходящий экран ещё на
 * месте (переход), иначе опустошило бы стопку — а NavDisplay с пустой стопкой падает.
 */
fun MutableList<NavKey>.popUnlessRoot() {
    if (size > 1) removeAt(lastIndex)
}

/** Вкладки: у каждой свой корень и независимая история Navigation 3. */
enum class AppTab(
    @param:StringRes val label: Int,
    @param:DrawableRes val icon: Int,
    val tag: String,
) {
    Training(R.string.tab_training, R.drawable.ic_tab_training, "tab.training"),
    Words(R.string.tab_words, R.drawable.ic_tab_words, "tab.words"),
    Exam(R.string.tab_exam, R.drawable.ic_tab_exam, "tab.exam"),
    Progress(R.string.tab_progress, R.drawable.ic_tab_progress, "tab.progress"),
}

@Serializable
sealed interface TabRoute : NavKey {
    @Serializable
    data class Root(
        val tab: AppTab,
    ) : TabRoute

    // Ключ включает вкладку: четыре профиля не делят сохранённое состояние и модели.
    @Serializable
    data class Settings(
        val tab: AppTab,
    ) : TabRoute
}
