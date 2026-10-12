import GPAPI
import SwiftUI

struct ShellRootView: View {
    let model: ShellModel
    var refreshesOnAppear = true

    var body: some View {
        Group {
            if model.user == nil {
                ShellUnavailableView(problem: model.problem, retry: { Task { await model.refresh() } })
            } else if model.exam == nil {
                ExamPickerView(model: model, firstEntry: true)
            } else {
                MainView(model: model, refreshesOnAppear: refreshesOnAppear)
            }
        }
        .environment(\.locale, Locale(identifier: model.locale.rawValue))
        .task { if refreshesOnAppear { await model.refresh() } }
    }
}

enum AppTab: String, Hashable, CaseIterable {
    case training, words, exam, progress
    var title: LocalizedStringKey {
        switch self {
        case .training: "Тренировка"
        case .words: "Слова"
        case .exam: "Экзамен"
        case .progress: "Прогресс"
        }
    }
    var symbol: String {
        switch self {
        case .training: "chart.bar.xaxis"
        case .words: "rectangle.on.rectangle"
        case .exam: "stopwatch"
        case .progress: "chart.xyaxis.line"
        }
    }
}

enum ShellRoute: Hashable { case profile }
private enum SidebarDestination: Hashable {
    case tab(AppTab)
    case profile
}

/// У каждого раздела свой стек; смена вкладки не уничтожает ни путь, ни сохранённую главную.
struct MainView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.gpType) private var type
    @Environment(\.textScale) private var textScale
    let model: ShellModel
    var refreshesOnAppear = true
    @State private var selection: AppTab = .training
    @State private var sidebarSelection: SidebarDestination = .tab(.training)
    @State private var paths: [AppTab: [ShellRoute]] = [:]
    @State private var trainingEntry: TrainingEntry?
    private let initialExamPicker: Bool
    #if os(iOS)
        @Environment(\.horizontalSizeClass) private var sizeClass
    #endif

    init(
        model: ShellModel, refreshesOnAppear: Bool = true, initialTab: AppTab = .training, profile: Bool = false,
        examPicker: Bool = false
    ) {
        self.model = model
        self.refreshesOnAppear = refreshesOnAppear
        initialExamPicker = examPicker
        _selection = State(initialValue: initialTab)
        _sidebarSelection = State(initialValue: profile ? .profile : .tab(initialTab))
        _paths = State(initialValue: profile ? [initialTab: [.profile]] : [:])
    }

    private var wide: Bool {
        #if os(iOS)
            sizeClass == .regular
        #else
            true
        #endif
    }
    private var profileIsVisible: Bool { wide ? sidebarSelection == .profile : paths[selection]?.last == .profile }

    var body: some View {
        Group {
            #if os(iOS)
                shell.fullScreenCover(item: $trainingEntry, onDismiss: refreshHome) { entry in
                    TrainingFlow(entry: entry, trainings: app.trainings) { trainingEntry = nil }
                }
            #else
                ZStack {
                    shell.accessibilityHidden(trainingEntry != nil).allowsHitTesting(trainingEntry == nil)
                    if let trainingEntry {
                        TrainingFlow(entry: trainingEntry, trainings: app.trainings) {
                            self.trainingEntry = nil
                            refreshHome()
                        }.background(Color(.bg))
                    }
                }
            #endif
        }
        .environment(\.gpWideLayout, wide)
        .environment(\.gpTrainingOffline, model.staleProblem == .offline)
        .environment(\.locale, Locale(identifier: model.locale.rawValue))
        .onChange(of: app.trainings.trainings) { _, _ in
            if trainingEntry == nil { refreshHome() }
        }
    }

    @ViewBuilder private var shell: some View {
        if wide {
            NavigationSplitView {
                VStack(alignment: .leading, spacing: GPSpace.s20) {
                    ExamSwitcher(model: model, presented: initialExamPicker)
                        .padding(.horizontal, GPSpace.s16).padding(.top, GPSpace.s20)
                    List(
                        AppTab.allCases, id: \.self,
                        selection: Binding<SidebarDestination?>(
                            get: { sidebarSelection }, set: { if let destination = $0 { selectSidebar(destination) } }
                        )
                    ) { tab in
                        Button {
                            selectSidebar(.tab(tab))
                        } label: {
                            // Явный состав строки сохраняет цвет SF Symbols, который AppKit теряет у Label в sidebar.
                            HStack(spacing: GPSpace.s12) {
                                Image(systemName: tab.symbol).frame(width: GPSize.icon)
                                Text(tab.title)
                            }
                            .font(.gp(type.navLabelWide, scale: textScale))
                            .foregroundStyle(selection == tab && !profileIsVisible ? Color(.text) : Color(.text3))
                        }.buttonStyle(ShellSidebarButtonStyle())
                            .tag(SidebarDestination.tab(tab)).accessibilityIdentifier("shell.tab.\(tab.rawValue)")
                    }
                    .listStyle(.sidebar).scrollContentBackground(.hidden)
                    .tint(profileIsVisible ? Color.clear : Color(.surface2))
                    Button {
                        openProfile(in: selection)
                    } label: {
                        HStack(spacing: GPSpace.s12) {
                            ProfileAvatar(name: model.user?.name ?? "")
                            Text("Профиль").gpText(\.navLabelWide)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(GPSpace.s16)
                    }.buttonStyle(.plain)
                        .background(
                            profileIsVisible ? Color(.surface2) : Color.clear,
                            in: RoundedRectangle(cornerRadius: GPRadius.m)
                        )
                        .accessibilityAddTraits(profileIsVisible ? .isSelected : [])
                        .accessibilityIdentifier("shell.profile")
                }
                .background(Color(.bg).ignoresSafeArea())
                .navigationSplitViewColumnWidth(GPLayout.sidebarWidth)
            } detail: {
                if sidebarSelection == .profile {
                    NavigationStack { SettingsView(model: model) }
                } else {
                    stack(selection)
                }
            }
            .navigationSplitViewStyle(.balanced)
        } else {
            TabView(selection: $selection) {
                ForEach(AppTab.allCases, id: \.self) { tab in
                    stack(tab).tabItem { Label(tab.title, systemImage: tab.symbol) }.tag(tab)
                }
            }
            .tint(Color(.text))
        }
    }

    private func stack(_ tab: AppTab) -> some View {
        NavigationStack(
            path: Binding(
                get: { paths[tab] ?? [] },
                set: {
                    // Снятие неактивного стека системой не является нажатием «Назад» в этой вкладке.
                    if selection == tab { paths[tab] = $0 }
                })
        ) {
            Group {
                if tab == .training {
                    TrainingHomeView(model: model, onTraining: { trainingEntry = $0 })
                } else {
                    SectionPlaceholderView(tab: tab, exam: model.exam ?? .gre)
                }
            }
            .navigationTitle(Text(tab.title))
            #if os(iOS)
                .navigationBarTitleDisplayMode(wide ? .inline : .large)
            #endif
            .toolbar {
                #if os(iOS)
                    if !wide {
                        ToolbarItem(placement: .topBarLeading) {
                            ExamSwitcher(model: model, presented: initialExamPicker && tab == selection)
                        }
                        ToolbarItem(placement: .primaryAction) {
                            Button {
                                openProfile(in: tab)
                            } label: {
                                ProfileAvatar(name: model.user?.name ?? "")
                            }
                            .buttonStyle(.plain).accessibilityLabel(Text("Профиль"))
                            .accessibilityIdentifier("shell.profile")
                        }
                    }
                #endif
            }
            .navigationDestination(for: ShellRoute.self) { _ in SettingsView(model: model) }
            .background(Color(.bg).ignoresSafeArea())
        }.id(tab)
    }

    private func selectSidebar(_ destination: SidebarDestination) {
        sidebarSelection = destination
        if case let .tab(tab) = destination { selection = tab }
    }
    private func openProfile(in tab: AppTab) {
        if wide {
            sidebarSelection = .profile
            return
        }
        if paths[tab]?.last != .profile { paths[tab, default: []].append(.profile) }
    }
    private func refreshHome() { if refreshesOnAppear { Task { await model.refresh() } } }
}

struct SectionPlaceholderView: View {
    let tab: AppTab
    let exam: Exam
    @Environment(\.gpWideLayout) private var wide
    private var message: LocalizedStringKey {
        switch tab {
        case .words: "Здесь будут слова: учить, повторять и искать."
        case .exam:
            exam == .gre
                ? "Здесь будут пробные экзамены GRE и эссе с оценкой."
                : "Здесь будут пробные экзамены TOEFL с оценкой Writing и Speaking."
        case .progress: "Здесь будет точность по разделам, история тренировок и примерный балл."
        case .training: "Здесь будут тренировки по четырём частям TOEFL."
        }
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: GPSpace.s24) {
                if wide { Text(tab.title).gpText(\.h1).accessibilityAddTraits(.isHeader) }
                Text(message).gpText(\.lead).foregroundStyle(Color(.text2))
                    .frame(maxWidth: GPLayout.textMax, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(GPLayout.gutter)
            .frame(maxWidth: .infinity, alignment: .leading)
        }.background(Color(.bg).ignoresSafeArea()).accessibilityIdentifier("shell.empty.\(tab.rawValue)")
    }
}

/// AppKit превращает стандартный plain Button в NSButton и теряет цвет шаблонного символа.
private struct ShellSidebarButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.contentShape(Rectangle())
    }
}

struct ProfileAvatar: View {
    let name: String
    var body: some View {
        Text(verbatim: String(name.prefix(1)).uppercased()).gpText(\.h3)
            .foregroundStyle(Color(.onAccent))
            .frame(width: GPSize.tapTarget, height: GPSize.tapTarget)
            // Лиловый токен одинаков в обеих темах; адаптивный verbal в светлой теме слишком тёмный для букв.
            .background(Color(.examSat), in: Circle())
    }
}
