import SwiftUI

@main
struct GrePrepApp: App {
    /// nil — приложение запущено хостом юнит-тестов: тогда оно не трогает ни Keychain, ни сеть.
    @State private var app: AppModel?
    @AppStorage(AppTheme.storageKey) private var storedTheme = AppTheme.dark.rawValue

    private var theme: AppTheme { AppTheme(rawValue: storedTheme) ?? .dark }

    init() {
        Fonts.register()
        #if os(macOS)
            AppTheme.load().applyToApplication()
        #endif
        #if DEBUG
            // Сценарии UI начинают с чистого устройства: без входа и без прошлого плана.
            if ProcessInfo.processInfo.arguments.contains("-GPResetState") {
                AppModel.resetLocalState()
            }
        #endif
        if !AppConfig.isRunningUnitTests {
            _app = State(initialValue: AppModel.live())
        }
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if let app {
                    RootView()
                        .environment(app)
                }
            }
            .gpDesignTokens()
            .preferredColorScheme(theme.colorScheme)
            #if os(macOS)
                .onChange(of: storedTheme) { _, _ in theme.applyToApplication() }
            #endif
        }
        #if os(macOS)
            // Окно вмещает боковую панель и колонку содержимого с полями (DESIGN.md, «Раскладка»).
            .defaultSize(
                width: GPLayout.sidebarWidth + GPLayout.contentMax + 2 * GPLayout.gutterWide,
                height: GPLayout.contentMax + GPSpace.s40)
        #endif
    }
}
