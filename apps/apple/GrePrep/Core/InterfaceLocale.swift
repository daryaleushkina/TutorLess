import Foundation

/// Копия языка аккаунта для форматирования строк вне дерева SwiftUI. Источник выбора — ShellModel и сервер.
enum InterfaceLocale {
    static let storageKey = "GPAccountLocale"
    static var current: Locale {
        Locale(
            identifier: UserDefaults.standard.string(forKey: storageKey) ?? Bundle.main.preferredLocalizations.first
                ?? "ru")
    }
}

extension String {
    init(interface resource: LocalizedStringResource) {
        var resource = resource
        resource.locale = InterfaceLocale.current
        self = String(localized: resource)
    }
}
