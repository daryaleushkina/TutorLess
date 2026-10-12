import SwiftUI

#if os(iOS)
    import CoreText
    import UIKit

    @MainActor
    enum NativeAppearance {
        static func navigation(compatibleWith traits: UITraitCollection? = nil) -> UINavigationBarAppearance {
            let appearance = UINavigationBarAppearance()
            // Родной материал панели сохраняется; меняются только шрифт и цвет её текста.
            appearance.configureWithDefaultBackground()
            appearance.titleTextAttributes = attributes(GPType.dark.h3, compatibleWith: traits)
            appearance.largeTitleTextAttributes = attributes(GPType.dark.h1, compatibleWith: traits)
            return appearance
        }

        static func configureNavigation() {
            let appearance = navigation()
            UINavigationBar.appearance().standardAppearance = appearance
            UINavigationBar.appearance().scrollEdgeAppearance = appearance
            UINavigationBar.appearance().compactAppearance = appearance
            let tabs = tabBar()
            UITabBar.appearance().standardAppearance = tabs
            UITabBar.appearance().scrollEdgeAppearance = tabs
            UITabBar.appearance().unselectedItemTintColor = UIColor(resource: .text3)
        }

        static func tabBar(compatibleWith traits: UITraitCollection? = nil) -> UITabBarAppearance {
            let appearance = UITabBarAppearance()
            appearance.configureWithDefaultBackground()
            for layout in [
                appearance.stackedLayoutAppearance, appearance.inlineLayoutAppearance,
                appearance.compactInlineLayoutAppearance,
            ] {
                var normal = attributes(GPType.dark.navLabel, compatibleWith: traits)
                normal[.foregroundColor] = UIColor(resource: .text3)
                layout.normal.titleTextAttributes = normal
                layout.normal.iconColor = UIColor(resource: .text3)
                layout.selected.titleTextAttributes = attributes(GPType.dark.navLabel, compatibleWith: traits)
                layout.selected.iconColor = UIColor(resource: .text)
            }
            return appearance
        }

        static func attributes(_ role: GPTextStyle, compatibleWith traits: UITraitCollection? = nil)
            -> [NSAttributedString.Key: Any]
        {
            let font = UIFont(name: role.fontFamily, size: role.size) ?? .systemFont(ofSize: role.size)
            let weights: [(Font.Weight, CGFloat)] = [
                (.regular, 400), (.medium, 500),
                (.semibold, 600), (.bold, 700), (.heavy, 800),
            ]
            let descriptor = font.fontDescriptor.addingAttributes([
                // traits.weight не меняет wght в переменном Onest; ось задаётся явно по роли.
                UIFontDescriptor.AttributeName(rawValue: kCTFontVariationAttribute as String): [
                    NSNumber(value: 0x7767_6874): weights.first { $0.0 == role.weight }?.1 ?? 400
                ]
            ])
            let scaled = UIFontMetrics(forTextStyle: textStyle(role.relativeTo)).scaledFont(
                for: UIFont(descriptor: descriptor, size: role.size), compatibleWith: traits)
            return [
                .font: scaled, .kern: role.tracking * scaled.pointSize,
                .foregroundColor: UIColor(resource: .text),
            ]
        }

        private static func textStyle(_ style: Font.TextStyle) -> UIFont.TextStyle {
            switch style {
            case .largeTitle: .largeTitle
            case .extraLargeTitle: .extraLargeTitle
            case .extraLargeTitle2: .extraLargeTitle2
            case .title: .title1
            case .title2: .title2
            case .title3: .title3
            case .headline: .headline
            case .subheadline: .subheadline
            case .body: .body
            case .callout: .callout
            case .footnote: .footnote
            case .caption: .caption1
            case .caption2: .caption2
            @unknown default: .body
            }
        }
    }

    /// willMove вызывается при присоединении к окну, до первого рисования, в отличие от onAppear.
    /// Окно создаёт SwiftUI; мост не подменяет делегат сцены и не вмешивается в её жизненный цикл.
    struct WindowThemeBridge: UIViewRepresentable {
        let theme: AppTheme

        func makeUIView(context: Context) -> ThemeWindowView {
            let view = ThemeWindowView()
            view.isUserInteractionEnabled = false
            view.theme = theme
            return view
        }

        func updateUIView(_ view: ThemeWindowView, context: Context) {
            view.theme = theme
        }
    }

    final class ThemeWindowView: UIView {
        var theme = AppTheme.dark {
            didSet { apply(to: window) }
        }

        override func willMove(toWindow newWindow: UIWindow?) {
            super.willMove(toWindow: newWindow)
            apply(to: newWindow)
        }

        private func apply(to window: UIWindow?) {
            window?.overrideUserInterfaceStyle = theme == .dark ? .dark : .light
        }
    }
#else
    import AppKit

    final class AppearanceApplicationDelegate: NSObject, NSApplicationDelegate {
        func applicationWillFinishLaunching(_ notification: Notification) {
            AppTheme.load().applyToApplication()
        }
    }
#endif
