import SwiftUI

/// «Прогресс» и вход в настройки (PRODUCT.md, «Навигация»: настройки — в «Прогрессе»). Пока тренировок нет,
/// экран пустой, как в макете G6-ProgressEmpty.
struct ProgressTabView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Text("Тренировок ещё не было")
                    .gpText(\.h2)
            } description: {
                Text("Здесь появятся темы, где больше всего ошибок, — по порядку, с чего начать.")
            }
            .background(Color(.bg).ignoresSafeArea())
            .navigationTitle(Text("Прогресс"))
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink {
                        SettingsView()
                    } label: {
                        Label {
                            Text("Настройки")
                        } icon: {
                            Image(systemName: "gearshape")
                        }
                    }
                    .accessibilityIdentifier("progress.settings")
                }
            }
        }
    }
}

/// Настройки (макет G2-Settings). В каркасе — только выход и версия; язык, тема, размер текста и способы
/// входа приходят со своими частями.
struct SettingsView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Form {
            Section {
                Button(role: .destructive) {
                    app.signOut()
                } label: {
                    Text("Выйти")
                }
                .accessibilityIdentifier("settings.signOut")
                #if os(macOS)
                    // GroupedFormStyle на Mac рисует собственную серую подложку и не принимает
                    // listRowBackground. Контрол остаётся системным, подложку строки рисуем токеном.
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(GPSpace.s12)
                    .background(Color(.surface), in: RoundedRectangle(cornerRadius: GPRadius.l))
                #endif
            } footer: {
                VStack(alignment: .leading, spacing: GPSpace.s12) {
                    Text("Версия \(app.config.appVersion)")
                        .monospacedDigit()
                    Text(verbatim: GREBrand.disclaimer)
                        .gpText(\.caption)
                        .foregroundStyle(Color(.text2))
                        .fixedSize(horizontal: false, vertical: true)
                        .environment(\.locale, Locale(identifier: "en"))
                        .accessibilityIdentifier("settings.etsDisclaimer")
                }
            }
            .listRowBackground(Color(.surface))
        }
        #if os(macOS)
            .formStyle(.columns)
            .frame(maxWidth: GPLayout.contentMax)
            .padding(GPSpace.s20)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        #else
            .formStyle(.grouped)
        #endif
        .scrollContentBackground(.hidden)
        .background(Color(.bg).ignoresSafeArea())
        .navigationTitle(Text("Настройки"))
    }
}
