import CoreText
import SwiftUI
import Testing

@testable import GrePrep

#if os(iOS)
    import UIKit
#else
    import AppKit
#endif

@MainActor
@Suite("Тема и вшитые шрифты")
struct AppearanceTests {
    @Test("новое устройство и неизвестное значение начинают с тёмной темы")
    func defaultTheme() throws {
        let suite = "appearance-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        #expect(AppTheme.load(from: defaults) == .dark)
        defaults.set("unknown", forKey: AppTheme.storageKey)
        #expect(AppTheme.load(from: defaults) == .dark)
    }

    @Test("выбор темы читается после нового открытия настроек", arguments: [AppTheme.light, .dark])
    func savedTheme(theme: AppTheme) throws {
        let suite = "appearance-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set(theme.rawValue, forKey: AppTheme.storageKey)
        let reopened = try #require(UserDefaults(suiteName: suite))
        #expect(AppTheme.load(from: reopened) == theme)
        #expect(theme.colorScheme == (theme == .dark ? .dark : .light))
    }

    @Test("цвета, тонкий вес и свечение выбираются одной схемой", arguments: [ColorScheme.light, .dark])
    func themeTokens(scheme: ColorScheme) {
        let tokens = GPDesignTokens(colorScheme: scheme)
        let expected = scheme == .dark ? GPThemeTokens.dark : .light
        #expect(tokens.theme.thin == expected.thin)
        #expect(tokens.type.scoreNum.weight == expected.thin)
        #expect(tokens.type.sessionCount.weight == expected.thin)
        #expect(tokens.theme.glow.color == expected.glow.color)
        #expect(tokens.theme.glow.spread == expected.glow.spread)
    }

    @Test("корень передаёт роли и свечение в рисуемый экран", arguments: [ColorScheme.light, .dark])
    func renderedEnvironment(scheme: ColorScheme) throws {
        let probe = TokenProbe()
        let renderer = ImageRenderer(
            content: TokenProbeView(probe: probe).gpDesignTokens().environment(\.colorScheme, scheme)
                .frame(width: GPSize.button * 3, height: GPSize.button))
        #if os(iOS)
            #expect(renderer.uiImage != nil)
        #else
            #expect(renderer.nsImage != nil)
        #endif
        let type = try #require(probe.type)
        let theme = try #require(probe.theme)
        #expect(type.scoreNum.weight == (scheme == .dark ? .ultraLight : .light))
        #expect(theme.thin == type.scoreNum.weight)
        #expect(theme.glow.spread == (scheme == .dark ? GPThemeTokens.dark : .light).glow.spread)
    }

    @Test("роли находят вшитые семейства по имени, без системной подмены")
    func bundledFonts() throws {
        Fonts.register()
        let roles = [GPType.dark.body, GPType.dark.h1, GPType.dark.scoreNum, GPType.dark.ipa]
        for role in roles {
            #if os(iOS)
                let font = try #require(UIFont(name: role.fontFamily, size: role.size))
            #else
                let font = try #require(NSFont(name: role.fontFamily, size: role.size))
            #endif
            #expect(font.familyName == role.fontFamily)
            let ct = CTFontCreateWithName(font.fontName as CFString, role.size, nil)
            let actual = (CTFontGetAscent(ct) + CTFontGetDescent(ct) + CTFontGetLeading(ct)) / role.size
            #expect(abs(actual - Fonts.naturalLineHeight(for: role.fontFamily)) < 0.001)
        }
        #if os(iOS)
            let math = try #require(UIFont(name: GPType.mathFontFamily, size: GPType.dark.qText.size))
        #else
            let math = try #require(NSFont(name: GPType.mathFontFamily, size: GPType.dark.qText.size))
        #endif
        #expect(math.familyName == GPType.mathFontFamily)
    }
}

@MainActor private final class TokenProbe {
    var type: GPType?
    var theme: GPThemeTokens?
}

private struct TokenProbeView: View {
    let probe: TokenProbe
    @Environment(\.gpType) private var type
    @Environment(\.gpTheme) private var theme

    var body: some View {
        probe.type = type
        probe.theme = theme
        return Text(verbatim: "170").gpText(\.scoreNum)
    }
}
