import SwiftUI

/// Разделы приложения: «Сегодня · Слова · Экзамен · Прогресс» (PRODUCT.md, «Навигация»). Вкладки системные:
/// на iOS 26 — стеклянная капсула, на iPad и Mac — боковая панель (DESIGN.md, «Нативные приложения»).
struct MainView: View {
    @Environment(AppModel.self) private var app
    let today: TodayModel
    var refreshesOnAppear = true
    @State private var selection: AppTab = .today
    @State private var trainingEntry: TrainingEntry?
    #if os(iOS)
        @Environment(\.horizontalSizeClass) private var sizeClass
    #endif

    enum AppTab: Hashable {
        case today, words, exam, progress
    }

    var body: some View {
        #if os(iOS)
            tabs.fullScreenCover(item: $trainingEntry) { entry in
                TrainingFlow(entry: entry, trainings: app.trainings) { trainingEntry = nil }
            }
        #else
            ZStack {
                tabs
                    .accessibilityHidden(trainingEntry != nil)
                    .allowsHitTesting(trainingEntry == nil)
                if let trainingEntry {
                    TrainingFlow(entry: trainingEntry, trainings: app.trainings) { self.trainingEntry = nil }
                        .background(Color(.bg))
                }
            }
        #endif
    }

    private var tabs: some View {
        TabView(selection: $selection) {
            Tab(value: AppTab.today) {
                TodayView(model: today, refreshesOnAppear: refreshesOnAppear, onTraining: { trainingEntry = $0 })
            } label: {
                Label {
                    Text("Сегодня")
                } icon: {
                    Image(systemName: "list.bullet.indent")
                }
                .gpText(navRole)
                .foregroundStyle(selection == .today ? Color(.text) : Color(.text3))
            }
            Tab(value: AppTab.words) {
                SectionPlaceholderView(
                    title: "Слова",
                    message: "Здесь будет словарь: слова на сегодня, повторение и поиск."
                )
            } label: {
                Label {
                    Text("Слова")
                } icon: {
                    Image(systemName: "rectangle.on.rectangle")
                }
                .gpText(navRole)
                .foregroundStyle(selection == .words ? Color(.text) : Color(.text3))
            }
            Tab(value: AppTab.exam) {
                SectionPlaceholderView(
                    title: "Экзамен",
                    message: "Здесь будут пробный экзамен как настоящий GRE и эссе с оценкой."
                )
            } label: {
                Label {
                    Text("Экзамен")
                } icon: {
                    Image(systemName: "stopwatch")
                }
                .gpText(navRole)
                .foregroundStyle(selection == .exam ? Color(.text) : Color(.text3))
            }
            Tab(value: AppTab.progress) {
                ProgressTabView()
            } label: {
                Label {
                    Text("Прогресс")
                } icon: {
                    Image(systemName: "chart.bar")
                }
                .gpText(navRole)
                .foregroundStyle(selection == .progress ? Color(.text) : Color(.text3))
            }
        }
        .tabViewStyle(.sidebarAdaptable)
        // Выбранная вкладка — цветом текста, по токенам навигации (DESIGN.md, «Navigation»).
        .tint(Color(.text))
    }

    private var navRole: KeyPath<GPType, GPTextStyle> {
        #if os(iOS)
            sizeClass == .regular ? \.navLabelWide : \.navLabel
        #else
            \.navLabelWide
        #endif
    }
}

/// Раздел, которого в каркасе ещё нет: честно говорит, что здесь будет.
struct SectionPlaceholderView: View {
    let title: LocalizedStringKey
    let message: LocalizedStringKey

    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Text("Скоро")
                    .gpText(\.h2)
            } description: {
                Text(message)
            }
            .navigationTitle(Text(title))
            .background(Color(.bg).ignoresSafeArea())
        }
    }
}

/// Шаг ленты, открытый из «Сегодня». Сами тренировки и слова — следующие части (ROADMAP §5).
struct StepPlaceholderView: View {
    let step: TodayPlan.Step

    var body: some View {
        ContentUnavailableView {
            Text(step.title)
                .gpText(\.h2)
        } description: {
            Text("Здесь начнётся шаг. Тренировки и слова появятся в следующих частях.")
        }
        .background(Color(.bg).ignoresSafeArea())
        .navigationTitle(Text(step.section.label))
        #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
        #endif
        .accessibilityIdentifier("step.placeholder")
    }
}
