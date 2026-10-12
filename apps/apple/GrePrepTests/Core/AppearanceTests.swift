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
        #if os(iOS)
            let google = try #require(UIFont(name: Fonts.googleMediumName, size: GPSignInGoogle.fontSize))
            let googleFamily = google.familyName
        #else
            let google = try #require(NSFont(name: Fonts.googleMediumName, size: GPSignInGoogle.fontSize))
            let googleFamily = try #require(google.familyName)
        #endif
        #expect(googleFamily.contains(GPSignInGoogle.fontFamily))
    }

    #if os(iOS)
        @Test("крупный и обычный заголовки родной панели используют Geologica")
        func navigationFont() throws {
            let appearance = NativeAppearance.navigation()
            for attributes in [appearance.titleTextAttributes, appearance.largeTitleTextAttributes] {
                let font = try #require(attributes[.font] as? UIFont)
                #expect(font.familyName == GPType.fontFamily)
                #expect(attributes[.foregroundColor] as? UIColor == UIColor(resource: .text))
            }
        }

        @Test("навигация использует ось веса роли и её трекинг")
        func navigationWeightAndTracking() throws {
            Fonts.register()
            let appearance = NativeAppearance.navigation()
            for (attributes, role) in [
                (appearance.titleTextAttributes, GPType.dark.h3),
                (appearance.largeTitleTextAttributes, GPType.dark.h1),
            ] {
                let font = try #require(attributes[.font] as? UIFont)
                let variations = CTFontCopyVariation(font as CTFont) as? [NSNumber: NSNumber]
                // OpenType-тег wght; обе роли каталога имеют вес semibold (600).
                #expect(variations?[NSNumber(value: 0x7767_6874)]?.doubleValue == 600)
                let actualTracking: Double? = (attributes[.kern] as? NSNumber)?.doubleValue
                let expectedTracking: Double = role.tracking * font.pointSize
                #expect(actualTracking == expectedTracking)
            }
        }

        @Test("шрифты обоих заголовков растут с системным крупным текстом")
        func navigationDynamicType() throws {
            // UIFontMetrics без compatibleWith берёт категорию приложения, не performAsCurrent.
            let regular = NativeAppearance.navigation(
                compatibleWith: UITraitCollection(preferredContentSizeCategory: .large))
            let larger = NativeAppearance.navigation(
                compatibleWith: UITraitCollection(preferredContentSizeCategory: .accessibilityExtraExtraExtraLarge))
            for (normal, scaled) in [
                (regular.titleTextAttributes, larger.titleTextAttributes),
                (regular.largeTitleTextAttributes, larger.largeTitleTextAttributes),
            ] {
                let before = try #require(normal[.font] as? UIFont)
                let after = try #require(scaled[.font] as? UIFont)
                #expect(after.pointSize > before.pointSize)
            }
        }

        @Test(
            "нативный шрифт сохраняет веса ролей",
            arguments: [
                (Font.Weight.ultraLight, 100.0), (.thin, 200), (.light, 300), (.regular, 400), (.medium, 500),
                (.semibold, 600), (.bold, 700), (.heavy, 800), (.black, 900),
            ])
        func nativeRoleWeights(weight: Font.Weight, expected: Double) throws {
            let role = GPTextStyle(
                size: 16, lineHeight: 20, weight: weight, tracking: -0.01,
                relativeTo: .body, fontFamily: GPType.fontFamily)
            let attributes = NativeAppearance.attributes(role)
            let font = try #require(attributes[.font] as? UIFont)
            let variations = CTFontCopyVariation(font as CTFont) as? [NSNumber: NSNumber]
            // CoreText не хранит вариацию, равную default оси (у вшитой Geologica это 100).
            let axes = try #require(CTFontCopyVariationAxes(font as CTFont) as? [[String: Any]])
            let axis = try #require(
                axes.first { ($0[kCTFontVariationAxisIdentifierKey as String] as? NSNumber)?.intValue == 0x7767_6874 })
            let fallback = try #require(axis[kCTFontVariationAxisDefaultValueKey as String] as? NSNumber).doubleValue
            let actual = variations?[NSNumber(value: 0x7767_6874)]?.doubleValue ?? fallback
            #expect(actual == expected)
        }

        @Test(
            "нативный шрифт масштабируется по системному стилю роли",
            arguments: [
                (Font.TextStyle.largeTitle, UIFont.TextStyle.largeTitle), (.title, .title1), (.title2, .title2),
                (.title3, .title3),
                (.headline, .headline), (.subheadline, .subheadline), (.body, .body), (.callout, .callout),
                (.footnote, .footnote), (.caption, .caption1), (.caption2, .caption2),
            ])
        func nativeRoleMetrics(style: Font.TextStyle, expected: UIFont.TextStyle) throws {
            let role = GPTextStyle(
                size: 16, lineHeight: 20, weight: .medium, tracking: 0,
                relativeTo: style, fontFamily: GPType.fontFamily)
            let traits = UITraitCollection(preferredContentSizeCategory: .accessibilityExtraExtraExtraLarge)
            let actual = (NativeAppearance.attributes(role, compatibleWith: traits)[.font] as? UIFont)?.pointSize
            // scaledFont округляет размер шрифта иначе, чем scaledValue для произвольного размера.
            let base = try #require(UIFont(name: role.fontFamily, size: role.size))
            let target = UIFontMetrics(forTextStyle: expected).scaledFont(for: base, compatibleWith: traits).pointSize
            #expect(actual == target)
        }

        @Test("мост задаёт стиль окна до присоединения представления", arguments: [AppTheme.light, .dark])
        func windowTheme(theme: AppTheme) {
            let window = UIWindow()
            let bridge = ThemeWindowView()
            bridge.theme = theme
            bridge.willMove(toWindow: window)
            #expect(window.overrideUserInterfaceStyle == (theme == .dark ? .dark : .light))
        }
    #endif
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
