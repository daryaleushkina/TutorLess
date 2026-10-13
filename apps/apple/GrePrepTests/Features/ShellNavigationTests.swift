import Testing

@testable import GrePrep

@Suite("Оболочка: профиль при смене ширины")
struct ShellNavigationTests {
    @Test("повтор значения TabView при активации окна не снимает профиль")
    func tabViewEchoKeepsProfile() {
        var navigation = ShellNavigation(initialTab: .progress)
        navigation.openProfile(in: .progress)
        navigation.selectTab(.progress)
        #expect(navigation.profileIsVisible)
        #expect(navigation.paths[.progress] == [.profile])
        navigation.selectTab(.training)
        #expect(navigation.selection == .training)
        #expect(!navigation.profileIsVisible)
    }

    @Test("узкий профиль становится пунктом sidebar и возвращается в стек", arguments: AppTab.allCases)
    func profileMovesWithWidth(tab: AppTab) {
        var navigation = ShellNavigation(initialTab: tab)
        navigation.openProfile(in: tab)
        #expect(navigation.paths[tab] == [.profile])
        navigation.setWide(true)
        #expect(navigation.profileIsVisible)
        #expect(navigation.sidebarSelection == .profile)
        #expect(navigation.paths[tab, default: []].isEmpty)
        navigation.setWide(false)
        #expect(navigation.profileIsVisible)
        #expect(navigation.sidebarSelection == .tab(tab))
        #expect(navigation.paths[tab] == [.profile])
        navigation.setWide(false)
        #expect(navigation.paths[tab] == [.profile])
    }

    @Test("текущий раздел открывается после переноса профиля в обе стороны", arguments: [false, true])
    func currentTabClosesProfile(startWide: Bool) {
        var navigation = ShellNavigation()
        navigation.setWide(startWide)
        navigation.openProfile(in: .training)
        navigation.setWide(!startWide)
        navigation.selectSidebar(.tab(.training))
        #expect(navigation.selection == .training)
        #expect(!navigation.profileIsVisible)
        #expect(navigation.paths[.training, default: []].isEmpty)
        navigation.setWide(startWide)
        #expect(!navigation.profileIsVisible)
    }

    @Test("начальный профиль существует только в одном месте", arguments: [false, true])
    func initialProfile(wide: Bool) {
        var navigation = ShellNavigation(initialTab: .progress, profile: true)
        navigation.setWide(wide)
        #expect(navigation.profileIsVisible)
        #expect(navigation.sidebarSelection == (wide ? .profile : .tab(.progress)))
        #expect(navigation.paths[.progress, default: []] == (wide ? [] : [.profile]))
        navigation.selectSidebar(.tab(.progress))
        #expect(!navigation.profileIsVisible)
    }
}
