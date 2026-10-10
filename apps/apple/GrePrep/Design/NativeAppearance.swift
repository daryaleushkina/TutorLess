import SwiftUI

#if os(iOS)
    import UIKit

    enum NativeAppearance {
        static func navigation() -> UINavigationBarAppearance {
            let appearance = UINavigationBarAppearance()
            // Родной материал панели сохраняется; меняются только шрифт и цвет её текста.
            appearance.configureWithDefaultBackground()
            appearance.titleTextAttributes = attributes(GPType.dark.h3)
            appearance.largeTitleTextAttributes = attributes(GPType.dark.h1)
            return appearance
        }

        static func configureNavigation() {
            let appearance = navigation()
            UINavigationBar.appearance().standardAppearance = appearance
            UINavigationBar.appearance().scrollEdgeAppearance = appearance
            UINavigationBar.appearance().compactAppearance = appearance
        }

        private static func attributes(_ role: GPTextStyle) -> [NSAttributedString.Key: Any] {
            let font = UIFont(name: role.fontFamily, size: role.size) ?? .systemFont(ofSize: role.size)
            let descriptor = font.fontDescriptor.addingAttributes([
                .traits: [UIFontDescriptor.TraitKey.weight: UIFont.Weight.semibold]
            ])
            return [.font: UIFont(descriptor: descriptor, size: role.size), .foregroundColor: UIColor(resource: .text)]
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
