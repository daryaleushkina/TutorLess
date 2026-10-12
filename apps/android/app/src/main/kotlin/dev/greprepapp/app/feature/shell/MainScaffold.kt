package dev.greprepapp.app.feature.shell

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.PermanentDrawerSheet
import androidx.compose.material3.PermanentNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import dev.greprepapp.app.R
import dev.greprepapp.design.Gp
import dev.greprepapp.design.SectionBackground
import greprep.design.GpLayout
import greprep.design.GpRadius
import greprep.design.GpSize
import greprep.design.GpSpace

/** Четыре независимые стопки сохраняются и при смене ширины окна. */
@Composable
fun MainScaffold(
    appVersion: String,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
    initialTab: AppTab = AppTab.Training,
    profile: ShellState = ShellState(),
    theme: dev.greprepapp.app.core.theme.ThemeState =
        dev.greprepapp.app.core.theme
            .ThemeState(restoring = false),
    settingFailed: Boolean = false,
    signingOut: Boolean = false,
    signOutProblem: dev.greprepapp.api.ApiFailure? = null,
    onLocale: (dev.greprepapp.api.models.Locale) -> Unit = {},
    onTheme: (dev.greprepapp.app.core.theme.AppTheme) -> Unit = {},
    onLargeText: (Boolean) -> Unit = {},
    onExam: () -> Unit = {},
    training: @Composable () -> Unit,
) {
    var tab by rememberSaveable { mutableStateOf(initialTab) }
    val trainingStack = rememberNavBackStack(TabRoute.Root(AppTab.Training))
    val wordsStack = rememberNavBackStack(TabRoute.Root(AppTab.Words))
    val examStack = rememberNavBackStack(TabRoute.Root(AppTab.Exam))
    val progressStack = rememberNavBackStack(TabRoute.Root(AppTab.Progress))
    val saveable = rememberSaveableStateHolderNavEntryDecorator<NavKey>()
    val models = rememberViewModelStoreNavEntryDecorator<NavKey>()

    fun stackOf(item: AppTab) =
        when (item) {
            AppTab.Training -> trainingStack
            AppTab.Words -> wordsStack
            AppTab.Exam -> examStack
            AppTab.Progress -> progressStack
        }
    val stack = stackOf(tab)
    val showingProfile = stack.last() is TabRoute.Settings

    fun select(item: AppTab) {
        if (tab == item) {
            while (stack.size > 1) stack.removeLastOrNull()
        } else {
            tab = item
        }
    }

    fun openProfile() {
        if (stack.last() !is TabRoute.Settings) stack.add(TabRoute.Settings(tab))
    }

    val content: @Composable () -> Unit = {
        NavDisplay(
            backStack = stack,
            onBack = { stack.popUnlessRoot() },
            entryDecorators = listOf(saveable, models),
            entryProvider =
                entryProvider {
                    entry<TabRoute.Root> { root ->
                        ShellSection(
                            stringResource(root.tab.label),
                            profile,
                            ::openProfile,
                            onExam,
                            profile.home?.sections?.any { it.total > 0 } == true && root.tab == AppTab.Training,
                        ) {
                            when (root.tab) {
                                AppTab.Training -> {
                                    training()
                                }

                                AppTab.Words -> {
                                    EmptySection(stringResource(R.string.placeholder_words), "words.placeholder")
                                }

                                AppTab.Exam -> {
                                    EmptySection(
                                        stringResource(
                                            if (profile.exam ==
                                                dev.greprepapp.api.models.Exam.TOEFL
                                            ) {
                                                R.string.placeholder_exam_toefl
                                            } else {
                                                R.string.placeholder_exam
                                            },
                                        ),
                                        "exam.placeholder",
                                    )
                                }

                                AppTab.Progress -> {
                                    EmptySection(stringResource(R.string.progress_empty_message), "progress.empty")
                                }
                            }
                        }
                    }
                    entry<TabRoute.Settings> {
                        SettingsScreen(
                            appVersion = appVersion,
                            onSignOut = onSignOut,
                            onBack = { stack.popUnlessRoot() },
                            profile = profile,
                            theme = theme,
                            settingFailed = settingFailed,
                            signingOut = signingOut,
                            signOutProblem = signOutProblem,
                            onLocale = onLocale,
                            onTheme = onTheme,
                            onLargeText = onLargeText,
                        )
                    }
                },
        )
    }
    if (Gp.isWide) {
        PermanentNavigationDrawer(
            modifier = modifier,
            drawerContent = {
                PermanentDrawerSheet(
                    modifier = Modifier.width(GpLayout.sidebarWidth).testTag("shell.sidebar"),
                    drawerShape = androidx.compose.ui.graphics.RectangleShape,
                    drawerContainerColor = Gp.colors.navBg,
                ) {
                    Column(Modifier.fillMaxSize().padding(horizontal = GpSpace.s16, vertical = GpSpace.s28)) {
                        Brand()
                        Spacer(Modifier.height(GpSpace.s24))
                        ExamBadge(
                            profile.exam
                                ?.value
                                ?.uppercase()
                                .orEmpty(),
                            onExam,
                            Modifier.padding(bottom = GpSpace.s24),
                        )
                        Column(
                            Modifier.weight(1f).verticalScroll(rememberScrollState()),
                            verticalArrangement = Arrangement.spacedBy(GpSpace.s8),
                        ) {
                            AppTab.entries.forEach { item ->
                                NavigationDrawerItem(
                                    selected = tab == item && !showingProfile,
                                    onClick = { select(item) },
                                    icon = { Icon(painterResource(item.icon), null) },
                                    label = { Text(stringResource(item.label), style = Gp.type.navLabelWide) },
                                    shape = RoundedCornerShape(GpRadius.s),
                                    colors =
                                        NavigationDrawerItemDefaults.colors(
                                            selectedContainerColor = Gp.colors.surface2,
                                            selectedIconColor = Gp.colors.text,
                                            selectedTextColor = Gp.colors.text,
                                            unselectedContainerColor = Color.Transparent,
                                            unselectedIconColor = Gp.colors.text2,
                                            unselectedTextColor = Gp.colors.text2,
                                        ),
                                    modifier = Modifier.heightIn(min = GpSize.navItemWide).testTag(item.tag),
                                )
                            }
                        }
                        NavigationDrawerItem(
                            selected = showingProfile,
                            onClick = ::openProfile,
                            icon = { Avatar(profile) },
                            label = {
                                Column {
                                    Text(
                                        profile.user?.name.orEmpty(),
                                        style = Gp.type.examSwitch,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(stringResource(R.string.profile), style = Gp.type.caption, color = Gp.colors.text3)
                                }
                            },
                            shape = RoundedCornerShape(GpRadius.s),
                            colors =
                                NavigationDrawerItemDefaults.colors(
                                    selectedContainerColor = Gp.colors.surface2,
                                    selectedTextColor = Gp.colors.text,
                                    unselectedContainerColor = Color.Transparent,
                                    unselectedTextColor = Gp.colors.text2,
                                ),
                            modifier = Modifier.testTag("shell.profile"),
                        )
                    }
                }
            },
            content = content,
        )
    } else {
        Scaffold(
            modifier = modifier,
            containerColor = Gp.colors.bg,
            bottomBar = {
                if (stack.last() !is TabRoute.Settings) {
                    NavigationBar(containerColor = Gp.colors.navBg, modifier = Modifier.testTag("shell.bottomBar")) {
                        AppTab.entries.forEach { item ->
                            NavigationBarItem(
                                selected = item == tab,
                                onClick = { select(item) },
                                icon = { Icon(painterResource(item.icon), null) },
                                label = { Text(stringResource(item.label)) },
                                colors = navigationColors(),
                                modifier = Modifier.testTag(item.tag),
                            )
                        }
                    }
                }
            },
        ) { padding -> Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) { content() } }
    }
    // После NavDisplay: его обработчик корня не должен съесть переход к первой вкладке.
    BackHandler(enabled = tab != AppTab.Training && stack.size == 1) { tab = AppTab.Training }
}

/** Цвета нижней панели части 1; форма иконки одна для обоих состояний. */
@Composable
private fun navigationColors() =
    NavigationBarItemDefaults.colors(
        selectedIconColor = Gp.colors.text,
        selectedTextColor = Gp.colors.text,
        indicatorColor = Gp.colors.surface2,
        unselectedIconColor = Gp.colors.text3,
        unselectedTextColor = Gp.colors.text3,
    )

@Composable
private fun ExamBadge(
    exam: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(onClick = onClick, color = Gp.colors.surface, shape = CircleShape, modifier = modifier.testTag("shell.examSwitch")) {
        Row(Modifier.heightIn(min = GpSize.examSwitch).padding(horizontal = GpSpace.s16), verticalAlignment = Alignment.CenterVertically) {
            Spacer(
                Modifier.size(GpSpace.s12).background(
                    if (exam ==
                        "GRE"
                    ) {
                        Gp.colors.examGre
                    } else {
                        Gp.colors.examToefl
                    },
                    RoundedCornerShape(GpSpace.s4),
                ),
            )
            Spacer(Modifier.width(GpSpace.s8))
            Text(exam, style = Gp.type.examSwitch, color = Gp.colors.text, modifier = Modifier.testTag("shell.exam"))
            Icon(
                painterResource(R.drawable.ic_expand_more),
                null,
                tint = Gp.colors.text,
                modifier = Modifier.padding(start = GpSpace.s8).size(GpSize.iconSm),
            )
        }
    }
}

@Composable
private fun Avatar(profile: ShellState) {
    Surface(
        color = greprep.design.GpDarkColors.verbal,
        contentColor = Gp.colors.onAccent,
        shape = CircleShape,
        modifier =
            Modifier
                .size(
                    GpSpace.s32,
                ).clearAndSetSemantics {
                },
    ) {
        Box(contentAlignment = Alignment.Center) {
            val initial = profile.initial
            if (initial != null) {
                Text(initial, style = Gp.type.examSwitch)
            } else {
                Icon(painterResource(R.drawable.ic_person), null, modifier = Modifier.size(GpSize.iconSm))
            }
        }
    }
}

/** Заголовок и содержимое листаются вместе: крупный шрифт не выталкивает действия за экран. */
@Composable
private fun ShellSection(
    title: String,
    profile: ShellState,
    onProfile: () -> Unit,
    onExam: () -> Unit,
    wideHistory: Boolean,
    content: @Composable ColumnScope.() -> Unit,
) {
    SectionBackground {
        Column(
            Modifier.fillMaxSize().testTag("shell.scroll").verticalScroll(rememberScrollState()).padding(
                horizontal = if (Gp.isWide) GpLayout.gutterWide else GpLayout.gutter,
                vertical = if (Gp.isWide) GpLayout.mainTopWide else GpLayout.mainTop,
            ),
        ) {
            val profileLabel = stringResource(R.string.profile)
            if (!Gp.isWide) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    ExamBadge(
                        profile.exam
                            ?.value
                            ?.uppercase()
                            .orEmpty(),
                        onExam,
                    )
                    Spacer(Modifier.weight(1f))
                    IconButton(
                        onClick = onProfile,
                        modifier =
                            Modifier.testTag("shell.profile").semantics {
                                contentDescription = profileLabel
                            },
                    ) { Avatar(profile) }
                }
            }
            Text(
                title,
                style = if (Gp.isWide) Gp.type.h1Wide else Gp.type.h1,
                color = Gp.colors.text,
                modifier = Modifier.padding(top = GpSpace.s16, bottom = GpSpace.s24).semantics { heading() },
            )
            Column(
                Modifier
                    .widthIn(
                        max =
                            if (Gp.isWide &&
                                wideHistory
                            ) {
                                GpLayout.contentMax + GpLayout.textMax + GpSpace.s28
                            } else {
                                GpLayout.contentMax
                            },
                    ).fillMaxWidth(),
                content = content,
            )
            Spacer(Modifier.height(GpSpace.s24))
        }
    }
}

@Composable
private fun EmptySection(
    message: String,
    tag: String,
) {
    Text(message, style = Gp.type.lead, color = Gp.colors.text2, modifier = Modifier.widthIn(max = GpLayout.textMax).testTag(tag))
}
