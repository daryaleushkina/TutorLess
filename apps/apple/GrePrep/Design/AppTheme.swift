import SwiftUI

#if os(macOS)
    import AppKit
#endif

/// Выбор только на устройстве; системная тема его не меняет (решение Даши 10.10.2026).
enum AppTheme: String, Sendable {
    case light, dark

    static let storageKey = "GPColorTheme"

    init(stored: String?) {
        self = stored.flatMap(Self.init(rawValue:)) ?? .dark
    }

    static func load(from defaults: UserDefaults = .standard) -> AppTheme {
        AppTheme(stored: defaults.string(forKey: storageKey))
    }

    var colorScheme: ColorScheme { self == .dark ? .dark : .light }

    #if os(macOS)
        @MainActor func applyToApplication() {
            // До создания первого окна: preferredColorScheme сам по себе не красит ранний кадр AppKit.
            NSApplication.shared.appearance = NSAppearance(named: self == .dark ? .darkAqua : .aqua)
        }
    #endif
}

/// Роли текста выбираются вместе с цветами каталога, включая снимки с явной темой.
struct GPDesignTokens {
    let type: GPType

    init(colorScheme: ColorScheme) {
        type = colorScheme == .dark ? .dark : .light
    }
}

extension EnvironmentValues {
    @Entry var gpType = GPType.dark
    @Entry var gpWideLayout = false
    @Entry var gpTrainingOffline = false
}

private struct GPDesignTokensModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.textScale) private var textScale

    func body(content: Content) -> some View {
        let tokens = GPDesignTokens(colorScheme: colorScheme)
        content
            .environment(\.gpType, tokens.type)
            .font(.gp(tokens.type.body, scale: textScale))
            .foregroundStyle(Color(.text))
            .tint(Color(.text))
    }
}

extension View {
    func gpDesignTokens() -> some View {
        modifier(GPDesignTokensModifier())
    }
}
