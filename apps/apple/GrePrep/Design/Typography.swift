import SwiftUI

#if os(iOS)
    import UIKit
#else
    import AppKit
#endif

/// Вшитые шрифты одинаково доступны приложению, превью и снимкам на iPhone, iPad и Mac.
enum Fonts {
    static func register() {
        for name in ["Geologica-Variable", "IBMPlexMono-Regular", "SourceSerif4-Variable"] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else {
                preconditionFailure("\(name).ttf is missing from the app bundle")
            }
            var error: Unmanaged<CFError>?
            guard !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error), let error else { continue }
            let failure = error.takeRetainedValue()
            // Повторная регистрация (второе окно на Mac, хост тестов) отвечает «уже есть» — это не ошибка.
            guard CFErrorGetCode(failure) != CTFontManagerError.alreadyRegistered.rawValue else { continue }
            preconditionFailure("\(name) registration failed: \(failure)")
        }
    }

    static func naturalLineHeight(for family: String) -> CGFloat {
        // Из head.unitsPerEm и (hhea.ascent - descent + lineGap); OS/2 sTypo* совпадают,
        // USE_TYPO_METRICS включён. Проверено fontTools.ttLib.TTFont по вшитым ttf:
        // Geologica: (1950 + 550 + 0) / 2000 = 1,25; IBM Plex Mono: (1025 + 275 + 0) / 1000 = 1,30;
        // Source Serif 4: (1036 + 335 + 0) / 1000 = 1,371. CoreText-метрики проверяет AppearanceTests.
        switch family {
        case GPType.monoFontFamily: 1.3
        case GPType.mathFontFamily: 1.371
        default: 1.25
        }
    }
}

extension Font {
    /// Семейство роли из токенов; растёт с Dynamic Type вместе со своим системным стилем.
    static func gp(_ style: GPTextStyle, scale: CGFloat = 1) -> Font {
        .custom(style.fontFamily, size: style.size * scale, relativeTo: style.relativeTo).weight(style.weight)
    }
}

/// Роль разрешается в окружении: экраны не выбирают тему и не хранят светлый вес цифр.
private struct GPTextRoleModifier: ViewModifier {
    let role: KeyPath<GPType, GPTextStyle>
    var math = false
    @Environment(\.gpType) private var type

    func body(content: Content) -> some View {
        content.modifier(GPTextModifier(Self.style(type[keyPath: role], math: math)))
    }

    static func style(_ role: GPTextStyle, math: Bool) -> GPTextStyle {
        guard math else { return role }
        // У формул своё семейство, а размер, трекинг и рост текста остаются в роли токенов.
        return GPTextStyle(
            size: role.size, lineHeight: role.lineHeight, weight: role.weight, tracking: role.tracking,
            relativeTo: role.relativeTo, fontFamily: GPType.mathFontFamily)
    }
}

/// SwiftUI задаёт добавку к естественной высоте строки, а не сам межстрочный.
struct GPTextModifier: ViewModifier {
    let style: GPTextStyle
    @Environment(\.textScale) private var textScale
    @ScaledMetric private var scale: CGFloat = 1

    init(_ style: GPTextStyle) {
        self.style = style
        _scale = ScaledMetric(wrappedValue: 1, relativeTo: style.relativeTo)
    }

    func body(content: Content) -> some View {
        content
            .font(.gp(style, scale: textScale))
            .tracking(style.tracking * style.size * scale * textScale)
            .lineSpacing(
                max(
                    0,
                    (style.lineHeight - style.size * Fonts.naturalLineHeight(for: style.fontFamily)) * scale * textScale
                ))
    }
}

extension EnvironmentValues {
    /// «Крупнее» поверх Dynamic Type; будущая настройка и снимки используют один множитель из токенов.
    @Entry var textScale: CGFloat = 1
}

extension View {
    func gpText(_ role: KeyPath<GPType, GPTextStyle>) -> some View {
        modifier(GPTextRoleModifier(role: role))
    }

    func gpMath(_ role: KeyPath<GPType, GPTextStyle>) -> some View {
        modifier(GPTextRoleModifier(role: role, math: true))
    }
}
