import GPAPI
import SwiftUI

/// Настройки принадлежат профилю, а не вкладке «Прогресс» (решение Даши 12.10.2026).
struct SettingsView: View {
    @Environment(\.gpWideLayout) private var wide
    @Environment(AppModel.self) private var app
    var model: ShellModel? = nil
    @AppStorage(AppTheme.storageKey) private var theme = AppTheme.dark.rawValue
    @AppStorage(TextSizePreference.storageKey) private var largerText = false

    private var shell: ShellModel? { model ?? app.shell }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: GPSpace.s24) {
                if wide { Text("Профиль").gpText(\.h1).accessibilityAddTraits(.isHeader) }
                HStack(spacing: GPSpace.s14) {
                    ProfileAvatar(name: shell?.user?.name ?? "")
                    VStack(alignment: .leading, spacing: GPSpace.s4) {
                        Text(verbatim: shell?.user?.name ?? "").gpText(\.h2)
                        Text(signInMethod).gpText(\.meta).foregroundStyle(Color(.text3))
                    }
                }
                VStack(spacing: 0) {
                    setting("Язык") {
                        Picker(
                            "Язык",
                            selection: Binding(
                                get: { shell?.locale ?? InterfaceLocale.preferredLanguage },
                                set: { value in Task { await shell?.setLocale(value) } })
                        ) {
                            Text("Русский").tag(Components.Schemas.Locale.ru)
                            Text(verbatim: "English").tag(Components.Schemas.Locale.en)
                        }.pickerStyle(.segmented).accessibilityIdentifier("settings.language")
                            .allowsHitTesting(shell?.changingLocale != true)
                    }
                    Divider().overlay(Color(.line)).padding(.horizontal, GPSpace.s16)
                    setting("Тема") {
                        Picker("Тема", selection: $theme) {
                            Text("Светлая").tag(AppTheme.light.rawValue)
                            Text("Тёмная").tag(AppTheme.dark.rawValue)
                        }.pickerStyle(.segmented).accessibilityIdentifier("settings.theme")
                    }
                    Divider().overlay(Color(.line)).padding(.horizontal, GPSpace.s16)
                    setting("Размер текста") {
                        Picker("Размер текста", selection: $largerText) {
                            Text("Обычный").tag(false)
                            Text("Крупнее").tag(true)
                        }.pickerStyle(.segmented).accessibilityIdentifier("settings.textSize")
                    }
                }.background(Color(.surface), in: RoundedRectangle(cornerRadius: GPRadius.l))
                if let problem = shell?.localeProblem {
                    ShellNotice(
                        symbol: problem == .offline ? "wifi.slash" : "exclamationmark.circle",
                        message:
                            problem == .offline
                            ? "Нет сети — изменить язык получится, когда она вернётся."
                            : "Не получилось изменить язык. Попробуйте ещё раз."
                    )
                    .accessibilityIdentifier("settings.languageError")
                }
                VStack(spacing: 0) {
                    inactive("Подписка", symbol: "creditcard", id: "subscription")
                    Divider().overlay(Color(.line)).padding(.horizontal, GPSpace.s16)
                    inactive("Способы входа", symbol: "key", id: "identities")
                    Divider().overlay(Color(.line)).padding(.horizontal, GPSpace.s16)
                    inactive("Написать нам", symbol: "envelope", id: "contact")
                }.background(Color(.surface), in: RoundedRectangle(cornerRadius: GPRadius.l))
                Button {
                    Task { await app.requestSignOut() }
                } label: {
                    HStack {
                        Text("Выйти").gpText(\.h3)
                        Spacer()
                        if app.signingOut { ProgressView() }
                    }.padding(GPSpace.s16).frame(minHeight: GPSize.button)
                        .background(Color(.surface), in: RoundedRectangle(cornerRadius: GPRadius.l))
                }.buttonStyle(.plain).allowsHitTesting(!app.signingOut).accessibilityIdentifier("settings.signOut")
                if let problem = app.signOutProblem {
                    ShellNotice(
                        symbol: problem == .offline ? "wifi.slash" : "exclamationmark.circle",
                        message:
                            problem == .offline
                            ? "Нет сети — выйти получится, когда она вернётся."
                            : "Не получилось выйти. Попробуйте ещё раз."
                    )
                    .accessibilityIdentifier("settings.signOutError")
                }
                VStack(alignment: .leading, spacing: GPSpace.s8) {
                    Text(verbatim: GREBrand.disclaimer).accessibilityIdentifier("settings.etsDisclaimer")
                    Text("Версия \(app.config.appVersion)")
                }.gpText(\.caption).foregroundStyle(Color(.text3)).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: GPLayout.contentMax, alignment: .leading)
            .padding(GPLayout.gutter)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.bg).ignoresSafeArea())
        .navigationTitle(Text("Профиль"))
        #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
        #endif
        .onAppear { shell?.clearLocaleProblem() }
        .accessibilityIdentifier("shell.profileScreen")
    }

    private var signInMethod: LocalizedStringKey {
        switch shell?.user?.identities.first?.provider {
        case .apple: "Вход с Apple"
        case .google: "Вход через Google"
        case .telegram: "Вход через Telegram"
        case nil: ""
        }
    }
    private func setting<Content: View>(_ title: LocalizedStringKey, @ViewBuilder control: () -> Content) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: GPSpace.s12) {
                Text(title).gpText(\.h3).fixedSize()
                Spacer(minLength: GPSpace.s8)
                control().labelsHidden().fixedSize()
            }
            VStack(alignment: .leading, spacing: GPSpace.s8) {
                Text(title).gpText(\.h3)
                control().labelsHidden()
            }
        }.padding(GPSpace.s16).frame(minHeight: GPSize.sectionRow)
    }
    private func inactive(_ title: LocalizedStringKey, symbol: String, id: String) -> some View {
        Label {
            Text(title).gpText(\.h3)
        } icon: {
            Image(systemName: symbol).frame(width: GPSize.icon)
        }
        .foregroundStyle(Color(.text3)).opacity(GPOpacity.disabled)
        .frame(maxWidth: .infinity, minHeight: GPSize.sectionRow, alignment: .leading)
        .padding(.horizontal, GPSpace.s16)
        .disabled(true)
        .accessibilityElement(children: .combine).accessibilityValue(Text("Недоступно"))
        .accessibilityIdentifier("settings.inactive.\(id)")
    }
}

enum TextSizePreference { static let storageKey = "GPLargerText" }
