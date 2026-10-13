import Foundation

enum ShellRoute: Hashable { case profile }
enum SidebarDestination: Hashable {
    case tab(AppTab)
    case profile
}

/// Выбор раздела и его история живут дольше конкретной раскладки окна.
struct ShellNavigation {
    var selection: AppTab
    var sidebarSelection: SidebarDestination
    var paths: [AppTab: [ShellRoute]]
    private(set) var wide = false

    init(initialTab: AppTab = .training, profile: Bool = false) {
        selection = initialTab
        sidebarSelection = .tab(initialTab)
        paths = profile ? [initialTab: [.profile]] : [:]
    }

    var profileIsVisible: Bool { wide ? sidebarSelection == .profile : paths[selection]?.last == .profile }

    mutating func setWide(_ value: Bool) {
        guard wide != value else { return }
        let profile = profileIsVisible
        wide = value
        sidebarSelection = profile && wide ? .profile : .tab(selection)
        if profile {
            // Профиль переезжает между контейнерами, а не становится второй копией экрана.
            if wide {
                paths[selection]?.removeAll { $0 == .profile }
            } else if paths[selection]?.last != .profile {
                paths[selection, default: []].append(.profile)
            }
        }
    }
    mutating func selectSidebar(_ destination: SidebarDestination) {
        sidebarSelection = destination
        if case let .tab(tab) = destination {
            selection = tab
            paths[tab]?.removeAll { $0 == .profile }
        }
    }
    mutating func selectTab(_ tab: AppTab) {
        // iOS 18 повторяет значение TabView при активации окна; это не выбор раздела человеком.
        guard tab != selection else { return }
        selectSidebar(.tab(tab))
    }
    mutating func openProfile(in tab: AppTab) {
        if wide {
            sidebarSelection = .profile
            return
        }
        if paths[tab]?.last != .profile { paths[tab, default: []].append(.profile) }
    }
}
