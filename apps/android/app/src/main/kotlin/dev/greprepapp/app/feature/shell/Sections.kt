package dev.greprepapp.app.feature.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import dev.greprepapp.api.models.Locale
import dev.greprepapp.app.R
import dev.greprepapp.app.core.theme.AppTheme
import dev.greprepapp.app.core.theme.ThemeState
import dev.greprepapp.app.ui.NestedScreen
import dev.greprepapp.design.Gp
import greprep.design.GpLayout
import greprep.design.GpOpacity
import greprep.design.GpRadius
import greprep.design.GpSpace

/** Профиль принадлежит вкладке; переключатели не меняют её историю и не перезапускают экран. */
@Composable
fun SettingsScreen(
    appVersion: String,
    onSignOut: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    profile: ShellState = ShellState(),
    theme: ThemeState = ThemeState(restoring = false),
    settingFailed: Boolean = false,
    signingOut: Boolean = false,
    signOutProblem: dev.greprepapp.api.ApiFailure? = null,
    onLocale: (Locale) -> Unit = {},
    onTheme: (AppTheme) -> Unit = {},
    onLargeText: (Boolean) -> Unit = {},
) {
    NestedScreen(stringResource(R.string.profile), onBack, modifier) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(
                    padding,
                ).verticalScroll(rememberScrollState())
                .padding(horizontal = GpLayout.gutter, vertical = GpSpace.s16),
        ) {
            Column(
                Modifier.widthIn(max = GpLayout.contentMax).fillMaxWidth().testTag("settings.column"),
                verticalArrangement = Arrangement.spacedBy(GpSpace.s24),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(GpSpace.s16)) {
                    Surface(color = greprep.design.GpDarkColors.verbal, contentColor = Gp.colors.onAccent, shape = CircleShape) {
                        Box(
                            Modifier.size(GpSpace.s56),
                            contentAlignment = Alignment.Center,
                        ) { Text(profile.initial.orEmpty(), style = Gp.type.h2) }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(GpSpace.s8)) {
                        Text(profile.user?.name.orEmpty(), style = Gp.type.h2)
                        profile.user?.identities?.firstOrNull()?.let {
                            Text(
                                stringResource(
                                    if (it.provider.value ==
                                        "apple"
                                    ) {
                                        R.string.profile_apple
                                    } else {
                                        R.string.profile_google
                                    },
                                ),
                                style = Gp.type.meta,
                                color = Gp.colors.text3,
                            )
                        }
                    }
                }
                Surface(color = Gp.colors.surface, shape = RoundedCornerShape(GpRadius.l)) {
                    Column(Modifier.padding(horizontal = GpSpace.s16)) {
                        Choice(stringResource(R.string.profile_language)) {
                            ChoiceButton(
                                "Русский",
                                profile.user?.locale != Locale.EN,
                                !profile.localeBusy,
                                "settings.locale.ru",
                            ) { onLocale(Locale.RU) }
                            ChoiceButton(
                                "English",
                                profile.user?.locale == Locale.EN,
                                !profile.localeBusy,
                                "settings.locale.en",
                            ) { onLocale(Locale.EN) }
                        }
                        HorizontalDivider(color = Gp.colors.line)
                        Choice(stringResource(R.string.profile_theme)) {
                            ChoiceButton(
                                stringResource(R.string.profile_light),
                                theme.theme == AppTheme.Light,
                                true,
                                "settings.theme.light",
                            ) {
                                onTheme(AppTheme.Light)
                            }
                            ChoiceButton(
                                stringResource(R.string.profile_dark),
                                theme.theme == AppTheme.Dark,
                                true,
                                "settings.theme.dark",
                            ) { onTheme(AppTheme.Dark) }
                        }
                        HorizontalDivider(color = Gp.colors.line)
                        Choice(stringResource(R.string.profile_text_size)) {
                            ChoiceButton(
                                stringResource(R.string.profile_normal),
                                !theme.largeText,
                                true,
                                "settings.text.normal",
                            ) { onLargeText(false) }
                            ChoiceButton(
                                stringResource(R.string.profile_larger),
                                theme.largeText,
                                true,
                                "settings.text.large",
                            ) { onLargeText(true) }
                        }
                    }
                }
                if (profile.localeProblem != null ||
                    settingFailed
                ) {
                    Text(
                        stringResource(R.string.profile_save_failed),
                        color = Gp.colors.wrong,
                        modifier = Modifier.testTag("settings.error"),
                    )
                }
                Surface(color = Gp.colors.surface, shape = RoundedCornerShape(GpRadius.l)) {
                    Column {
                        listOf(
                            "subscription" to R.string.profile_subscription,
                            "identities" to R.string.profile_identities,
                            "contact" to R.string.profile_contact,
                        ).forEach { (tag, label) ->
                            Surface(
                                onClick = {},
                                enabled = false,
                                color = Gp.colors.surface,
                                modifier = Modifier.fillMaxWidth().testTag("settings.$tag"),
                            ) {
                                Row(
                                    Modifier.padding(GpSpace.s20),
                                    horizontalArrangement = Arrangement.spacedBy(GpSpace.s12),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icon(
                                        painterResource(
                                            when (tag) {
                                                "subscription" -> R.drawable.ic_credit_card
                                                "identities" -> R.drawable.ic_key
                                                else -> R.drawable.ic_mail
                                            },
                                        ),
                                        null,
                                        tint = Gp.colors.text3.copy(alpha = GpOpacity.DISABLED),
                                        modifier = Modifier.size(GpSpace.s20),
                                    )
                                    Text(
                                        stringResource(label),
                                        style = Gp.type.body,
                                        color = Gp.colors.text2.copy(alpha = GpOpacity.DISABLED),
                                        modifier = Modifier,
                                    )
                                }
                            }
                        }
                    }
                }
                Surface(
                    onClick = onSignOut,
                    enabled = !signingOut,
                    color = Gp.colors.surface,
                    shape = RoundedCornerShape(GpRadius.l),
                    modifier = Modifier.fillMaxWidth().testTag("settings.signOut"),
                ) {
                    Text(stringResource(R.string.settings_sign_out), modifier = Modifier.padding(GpSpace.s20))
                }
                if (signOutProblem !=
                    null
                ) {
                    Text(
                        stringResource(
                            if (signOutProblem ==
                                dev.greprepapp.api.ApiFailure.Offline
                            ) {
                                R.string.profile_signout_offline
                            } else {
                                R.string.profile_signout_failed
                            },
                        ),
                        color = Gp.colors.wrong,
                        modifier = Modifier.testTag("settings.signOutError"),
                    )
                }
                Text(stringResource(R.string.signin_disclaimer), style = Gp.type.caption, color = Gp.colors.text3)
                Text(stringResource(R.string.settings_version, appVersion), style = Gp.type.caption, color = Gp.colors.text3)
                Spacer(Modifier.height(GpSpace.s24))
            }
        }
    }
}

@Composable
private fun Choice(
    label: String,
    content: @Composable () -> Unit,
) {
    FlowRow(
        Modifier.fillMaxWidth().padding(vertical = GpSpace.s8),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalArrangement = Arrangement.spacedBy(GpSpace.s8),
    ) {
        Text(label, modifier = Modifier.padding(vertical = GpSpace.s12))
        FlowRow(content = { content() })
    }
}

@Composable
private fun ChoiceButton(
    text: String,
    isSelected: Boolean,
    enabled: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    Surface(
        onClick,
        enabled = enabled,
        color = if (isSelected) Gp.colors.text else Gp.colors.surface2,
        contentColor = if (isSelected) Gp.colors.bg else Gp.colors.text3,
        shape = RoundedCornerShape(GpRadius.full),
        modifier =
            Modifier.testTag(tag).semantics {
                selected =
                    isSelected
            },
    ) {
        Text(text, style = Gp.type.meta, modifier = Modifier.padding(horizontal = GpSpace.s12, vertical = GpSpace.s12))
    }
}
