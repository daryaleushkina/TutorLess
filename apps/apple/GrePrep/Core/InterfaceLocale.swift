import Foundation
import GPAPI

/// Копия языка аккаунта для форматирования строк вне дерева SwiftUI. Источник выбора — ShellModel и сервер.
enum InterfaceLocale {
    static let storageKey = "GPAccountLocale"
    static var preferredLanguage: Components.Schemas.Locale {
        Bundle.main.preferredLocalizations.compactMap {
            Components.Schemas.Locale(rawValue: String($0.prefix(2)))
        }.first ?? .en
    }
    static var current: Locale {
        Locale(
            identifier: UserDefaults.standard.string(forKey: storageKey) ?? Bundle.main.preferredLocalizations.first
                ?? preferredLanguage.rawValue)
    }
}

extension String {
    init(interface resource: LocalizedStringResource) {
        var resource = resource
        resource.locale = InterfaceLocale.current
        self = String(localized: resource)
    }
}
