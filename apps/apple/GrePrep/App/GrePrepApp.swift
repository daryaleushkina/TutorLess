import SwiftUI

@main
struct GrePrepApp: App {
    /// nil — приложение запущено хостом юнит-тестов: тогда оно не трогает ни Keychain, ни сеть.
    @State private var app: AppModel?
    @AppStorage(AppTheme.storageKey) private var storedTheme = AppTheme.dark.rawValue
    @AppStorage(TextSizePreference.storageKey) private var largerText = false
    #if os(macOS)
        @NSApplicationDelegateAdaptor(AppearanceApplicationDelegate.self) private var appearanceDelegate
    #endif

    private var theme: AppTheme { AppTheme(stored: storedTheme) }

    init() {
        Fonts.register()
        #if DEBUG
            // Сценарии UI начинают с чистого устройства: без входа и без прошлого плана.
            if ProcessInfo.processInfo.arguments.contains("-GPResetState") {
                AppModel.resetLocalState()
            }
            // Аргумент осмотра задаёт тот же сохранённый выбор, который позже меняет настройка приложения.
            let arguments = ProcessInfo.processInfo.arguments
            if let index = arguments.firstIndex(of: "-GPColorTheme"), arguments.indices.contains(index + 1) {
                UserDefaults.standard.set(AppTheme(stored: arguments[index + 1]).rawValue, forKey: AppTheme.storageKey)
            }
        #endif
        #if os(iOS)
            NativeAppearance.configureNavigation()
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
            .environment(\.textScale, largerText ? GPType.textScaleLarge : 1)
            .environment(\.colorScheme, theme.colorScheme)
            .preferredColorScheme(theme.colorScheme)
            #if os(iOS)
                .background(WindowThemeBridge(theme: theme).frame(width: 0, height: 0).allowsHitTesting(false))
            #else
                .onChange(of: storedTheme) { _, newValue in AppTheme(stored: newValue).applyToApplication() }
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
