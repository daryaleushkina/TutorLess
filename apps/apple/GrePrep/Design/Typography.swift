import SwiftUI
import os

#if os(iOS)
    import UIKit
#else
    import AppKit
#endif

/// Вшитые шрифты одинаково доступны приложению, превью и снимкам на iPhone, iPad и Mac.
enum Fonts {
    private static let logger = Logger(subsystem: "dev.greprepapp.app", category: "fonts")
    static let googleMediumName = "Roboto-Medium"

    static func isAlreadyAvailable(_ code: CFIndex) -> Bool {
        switch code {
        case CTFontManagerError.alreadyRegistered.rawValue, CTFontManagerError.duplicatedName.rawValue: true
        default: false
        }
    }

    static func register() {
        for name in ["Geologica-Variable", "IBMPlexMono-Regular", "SourceSerif4-Variable", googleMediumName] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else {
                reportFailure("В наборе приложения нет \(name).ttf")
                continue
            }
            var error: Unmanaged<CFError>?
            guard !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) else { continue }
            guard let failure = error?.takeRetainedValue() else {
                reportFailure("CoreText не зарегистрировал \(name) и не вернул причину")
                continue
            }
            // Установленный в системе шрифт может отвечать duplicatedName вместо alreadyRegistered.
            guard !isAlreadyAvailable(CFErrorGetCode(failure)) else { continue }
            reportFailure("Не удалось зарегистрировать \(name): \(failure)")
        }
    }

    private static func reportFailure(_ message: String) {
        logger.error("\(message, privacy: .public)")
        // В релизе недоступное семейство заменяет системный шрифт SwiftUI; ошибка ресурса не мешает запуску.
        assertionFailure(message)
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
    static var googleSignIn: Font {
        // Статический экземпляр веса 500 из Roboto; PostScript-имя, а не браузерный стек fallback.
        .custom(Fonts.googleMediumName, size: GPSignInGoogle.fontSize).weight(GPSignInGoogle.fontWeight)
    }
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
