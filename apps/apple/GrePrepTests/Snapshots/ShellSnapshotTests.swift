import GPAPI
import SwiftUI
import Testing

@testable import GrePrep

extension ScreenSnapshotTests {
    enum ShellScreen: String, CaseIterable, Sendable {
        case home, history, historyWithoutAnswers, offline, failed, loading, offlineEmpty, toefl
        case examChoice, examBusy, examSwitch, words, examEmpty, toeflExam, progress, profile
    }

    @Test("Оболочка B: все состояния, обе темы и размеры", arguments: ShellScreen.allCases)
    func shellScreens(screen: ShellScreen) async throws {
        var snapshot = ShellFixture.snapshot
        var user = ShellFixture.user()
        if screen == .examChoice || screen == .examBusy { user.activeExam = nil }
        if screen == .toefl || screen == .toeflExam {
            user.activeExam = .toefl
            snapshot.homes["toefl"] = .init(
                stats: .init(
                    sections: [.init(section: .reading, total: 0, correct: 0)], mistakes: 0,
                    week: .init(days: 0, answers: 0, minutes: 0)),
                options: .init(types: [], presets: [], maxQuestions: 50))
        }
        snapshot.user = user
        if screen == .historyWithoutAnswers {
            var stats = ShellFixture.stats
            stats.lastTraining = .init(request: TrainingFixture.options.presets[0].request, size: 3)
            snapshot.homes["gre"] = .init(stats: stats, options: TrainingFixture.options)
        }
        if screen == .history {
            var stats = ShellFixture.stats
            stats.lastTraining = .init(request: TrainingFixture.options.presets[0].request, size: 10)
            stats.sections[0] = .init(section: .verbal, total: 40, correct: 27)
            stats.sections[1] = .init(section: .quant, total: 35, correct: 26)
            stats.mistakes = 12
            stats.weakSpot = .init(questionType: .sentenceEquivalence, section: .verbal, accuracy: 58)
            stats.week = .init(days: 3, answers: 42, minutes: 38)
            snapshot.homes["gre"] = .init(stats: stats, options: TrainingFixture.options)
        }
        if screen == .loading || screen == .offlineEmpty { snapshot.homes = [:] }
        ShellFixture.stub(server, user: user)
        let cache = temporaryCache()
        try cache.save(snapshot)
        let network = NetworkMonitor(isOnline: screen != .offline && screen != .offlineEmpty)
        let app = AppModel(
            config: server.config(), tokens: MemoryTokenStore("t"), cache: cache, network: network,
            session: server.session)
        let model = try #require(app.shell)
        if screen == .historyWithoutAnswers {
            server.on("POST /api/trainings", .json(201, TrainingFixture.json(TrainingFixture.session)))
            let id = try await app.trainings.start(TrainingFixture.options.presets[0].request)
            app.trainings.recordPosition(id, position: 1)
            await eventually { model.activeTraining?.position == 1 }
        }
        if screen == .failed {
            server.on("GET /api/home", .json(500, Fixture.error("internal")))
            await model.refresh()
        }
        if screen == .offline { _ = await model.start() }
        let gate = StubServer.Gate()
        var busyTask: Task<Bool, Never>?
        if screen == .examBusy {
            server.on("PUT /api/me/exam", .gated(gate, 200, ShellFixture.json(ShellFixture.user())))
            busyTask = Task { await model.choose(.gre) }
            await eventually { model.choosing == .gre }
        }
        let view: AnyView
        switch screen {
        case .home, .history, .historyWithoutAnswers, .offline, .failed, .loading, .offlineEmpty, .toefl:
            view = AnyView(MainView(model: model, refreshesOnAppear: false))
        case .examChoice, .examBusy:
            view = AnyView(ExamPickerView(model: model, firstEntry: true))
        case .examSwitch:
            view = AnyView(MainView(model: model, refreshesOnAppear: false, examPicker: true))
        case .words:
            view = AnyView(MainView(model: model, refreshesOnAppear: false, initialTab: .words))
        case .examEmpty, .toeflExam:
            view = AnyView(MainView(model: model, refreshesOnAppear: false, initialTab: .exam))
        case .progress:
            view = AnyView(MainView(model: model, refreshesOnAppear: false, initialTab: .progress))
        case .profile:
            view = AnyView(MainView(model: model, refreshesOnAppear: false, profile: true))
        }
        let screenView = view.environment(app)
        let presentation: Presentation = screen == .profile ? .profile : screen == .examSwitch ? .examPicker : .root
        await assertScreens(screenView, named: "shell-\(screen.rawValue)", precision: 0.995, presentation: presentation)
        await assertScreens(
            screenView.environment(\.textScale, GPType.textScaleLarge), named: "shell-\(screen.rawValue)-larger",
            precision: 0.995, largerText: true, presentation: presentation)
        #if os(iOS)
            await assertScreens(
                screenView, named: "shell-\(screen.rawValue)-wide", devices: [.pad], precision: 0.995,
                padLandscape: true, presentation: presentation)
        #endif
        gate.open()
        _ = await busyTask?.value
    }

    @Test("T4: ошибка входа над официальными кнопками")
    func shellSignInFailure() async throws {
        let app = AppModel(
            config: server.config(), tokens: MemoryTokenStore(), cache: temporaryCache(), network: NetworkMonitor(),
            session: server.session)
        server.on("POST /api/auth/dev", .json(500, Fixture.error("internal")))
        server.on("POST /api/client-errors", .status(204))
        let model = SignInModel(app: app)
        await model.signInForDevelopment(name: "fixture")
        let view = SignInView(model: model, reason: nil, showsDevelopmentSignIn: false).environment(app)
        await assertScreens(view, named: "shell-signin-error")
        await assertScreens(view.environment(\.textScale, GPType.textScaleLarge), named: "shell-signin-error-larger")
    }

    #if os(iOS)
        enum AdaptiveShell: String, CaseIterable, Sendable {
            case home, words, exam, progress, profile, firstExam, switchExam
        }

        /// Та же иерархия должна адаптироваться при смене доступной ширины; iPad отдельно снимается на своём устройстве.
        @Test("Адаптация оболочки к regular: навигация, профиль и popover", arguments: AdaptiveShell.allCases)
        func adaptiveShell(screen: AdaptiveShell) async throws {
            var snapshot = ShellFixture.snapshot
            if screen == .firstExam { snapshot.user?.activeExam = nil }
            if screen == .profile {
                snapshot.user?.identities = [
                    .init(provider: .google, linkedAt: Date(timeIntervalSince1970: 1_700_000_000))
                ]
            }
            let cache = temporaryCache()
            try cache.save(snapshot)
            ShellFixture.stub(server, user: snapshot.user!)
            let app = AppModel(
                config: server.config(), tokens: MemoryTokenStore("t"), cache: cache, network: NetworkMonitor(),
                session: server.session)
            let model = try #require(app.shell)
            let initial: AppTab =
                screen == .words ? .words : screen == .exam ? .exam : screen == .progress ? .progress : .training
            let view: AnyView =
                screen == .firstExam
                ? AnyView(ExamPickerView(model: model, firstEntry: true))
                : AnyView(
                    MainView(
                        model: model, refreshesOnAppear: false, initialTab: initial, profile: screen == .profile,
                        examPicker: screen == .switchExam))
            await assertScreens(
                view.environment(app).environment(\.horizontalSizeClass, .regular),
                named: "adaptive-\(screen.rawValue)", devices: [.phone], regularWidth: true,
                presentation: screen == .profile ? .profile : screen == .switchExam ? .examPicker : .root)
        }
    #endif
}
