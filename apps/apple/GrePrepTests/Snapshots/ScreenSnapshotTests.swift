import GPAPI
import Observation
import SnapshotTesting
import SwiftUI
import Testing
import Vision

@testable import GrePrep

#if os(iOS)
    import UIKit
#endif

#if os(macOS)
    @MainActor @Observable private final class ReportSheetState {
        var presented = true
        var dismissals = 0
    }
#endif

/// Эталонные снимки экранов: iPhone, iPad и Mac — в светлой и тёмной теме. Каждое устройство снимается на своём
/// симуляторе (гейт гоняет набор на iPhone и на iPad): системное стекло iOS 26 рисуется только в настоящем окне, а окно
/// iPhone не вмещает раскладку iPad. Эталоны — в __Snapshots__ рядом; переснимать только при намеренной правке вида и писать об
/// этом в коммите (AGENTS.md, «Тесты»). Шрифт Onest регистрирует само приложение-хост при запуске.
@MainActor
@Suite("Снимки экранов", .serialized)
struct ScreenSnapshotTests {
    let server = StubServer()

    init() {
        // Хост снимков не входит в аккаунт: копия языка от прошлого UI-прогона не должна менять форматирование.
        UserDefaults.standard.set("ru", forKey: InterfaceLocale.storageKey)
    }

    func signedInApp() throws -> AppModel {
        ShellFixture.stub(server)
        let cache = temporaryCache()
        try cache.save(ShellFixture.snapshot)
        return AppModel(
            config: server.config(), tokens: MemoryTokenStore("t"), cache: cache, network: NetworkMonitor(),
            session: server.session)
    }

    @Test("вход")
    func signIn() async {
        let app = AppModel(
            config: server.config(), tokens: MemoryTokenStore(), cache: temporaryCache(), network: NetworkMonitor(),
            session: server.session)
        let view = SignInView(app: app, reason: nil, showsDevelopmentSignIn: false).environment(app)
        await assertScreens(view, named: "signin")
    }

    @Test("вход закончился", .enabled { await ScreenSnapshotTests.isPhone() })
    func signInExpired() async {
        let app = AppModel(
            config: server.config(), tokens: MemoryTokenStore(), cache: temporaryCache(), network: NetworkMonitor(),
            session: server.session)
        let view = SignInView(app: app, reason: .sessionExpired, showsDevelopmentSignIn: false).environment(app)
        await assertScreens(view, named: "signin-expired", devices: [.phone])
    }

    @Test("вход — сообщение под кнопками", .enabled { await ScreenSnapshotTests.isPhone() })
    func signInMessage() async {
        let app = AppModel(
            config: server.config(), tokens: MemoryTokenStore(), cache: temporaryCache(), network: NetworkMonitor(),
            session: server.session)
        let model = SignInModel(app: app)
        await model.signInWithWeb(.google) { url, _ in url }
        await assertScreens(
            SignInView(model: model, reason: nil, showsDevelopmentSignIn: false).environment(app),
            named: "signin-message", devices: [.phone], themes: [.light])
    }

    @Test("настройки: дисклеймер ETS по-английски в русском интерфейсе")
    func settings() async {
        let app = AppModel(
            config: server.config(), tokens: MemoryTokenStore("t"), cache: temporaryCache(), network: NetworkMonitor(),
            session: server.session)
        await assertScreens(
            NavigationStack { SettingsView() }.environment(app), named: "settings")
    }

    @Test("настройки: дисклеймер ETS в английском интерфейсе")
    func settingsEnglish() async {
        let app = AppModel(
            config: server.config(), tokens: MemoryTokenStore("t"), cache: temporaryCache(), network: NetworkMonitor(),
            session: server.session)
        await assertScreens(
            NavigationStack { SettingsView() }.environment(app).environment(\.locale, Locale(identifier: "en")),
            named: "settings-en")
    }

    #if os(macOS)
        @Test("настройки используют фон и поверхность токенов", arguments: [Theme.light, .dark])
        func settingsSurfaces(theme: Theme) async throws {
            let app = AppModel(
                config: server.config(), tokens: MemoryTokenStore("t"), cache: temporaryCache(),
                network: NetworkMonitor(), session: server.session)
            let view = NavigationStack { SettingsView() }.environment(app).gpDesignTokens()
                .environment(\.colorScheme, theme == .dark ? .dark : .light)
            let controller = NSHostingController(rootView: view)
            let appearance = try #require(NSAppearance(named: theme == .dark ? .darkAqua : .aqua))
            controller.view.appearance = appearance
            let size = CGSize(width: GPLayout.contentMax, height: GPLayout.contentMax)
            controller.view.frame = CGRect(origin: .zero, size: size)
            let strategy = Snapshotting<NSViewController, NSImage>.image(size: size)
            let rendered: NSImage = await withCheckedContinuation { continuation in
                strategy.snapshot(controller).run { continuation.resume(returning: $0) }
            }
            let cgImage = try #require(rendered.cgImage(forProposedRect: nil, context: nil, hints: nil))
            var background: NSColor?
            var surface: NSColor?
            appearance.performAsCurrentDrawingAppearance {
                background = NSColor(resource: .bg).usingColorSpace(.sRGB)
                surface = NSColor(resource: .surface).usingColorSpace(.sRGB)
            }
            try expectPixel(
                cgImage, x: Int(GPSpace.s4 * CGFloat(cgImage.width) / size.width), y: cgImage.height / 2,
                color: try #require(background), role: "bg")
            // Первая строка теперь под аватаром: берём свободное место между подписью и переключателем.
            let rowCenter = GPLayout.gutter + GPSize.tapTarget + GPSpace.s24 + GPSize.sectionRow / 2
            try expectPixel(
                cgImage, x: cgImage.width / 2, y: Int(rowCenter * CGFloat(cgImage.width) / size.width),
                color: try #require(surface), role: "surface")
        }

        private func expectPixel(_ image: CGImage, x: Int, y: Int, color: NSColor, role: String) throws {
            let pixel = try #require(image.cropping(to: CGRect(x: x, y: y, width: 1, height: 1)))
            let context = try #require(
                CGContext(
                    data: nil, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
            context.draw(pixel, in: CGRect(x: 0, y: 0, width: 1, height: 1))
            let bytes = try #require(context.data).assumingMemoryBound(to: UInt8.self)
            let expected = try #require(color.usingColorSpace(.sRGB))
            let components = [expected.redComponent, expected.greenComponent, expected.blueComponent]
            for (index, value) in components.enumerated() {
                #expect(abs(CGFloat(bytes[index]) / 255 - value) < 0.02, "Фон настроек не соответствует \(role)")
            }
        }
    #endif

    @Test("конструктор тренировки")
    func trainingBuilder() async throws {
        let app = try signedInApp()
        let model = BuilderModel(trainings: app.trainings, loadsOnInit: false)
        model.use(TrainingFixture.options)
        await assertScreens(
            NavigationStack { TrainingBuilderView(model: model) }.environment(app),
            named: "training-builder")
    }

    @Test("конструктор: очищенное количество без обрезанной подсказки")
    func trainingBuilderEmptyCount() async throws {
        let app = try signedInApp()
        let model = BuilderModel(trainings: app.trainings, loadsOnInit: false)
        model.use(TrainingFixture.options)
        model.setCount("")
        await assertScreens(
            NavigationStack { TrainingBuilderView(model: model) }.environment(app),
            named: "training-builder-empty")
    }

    @Test("темы и сложность")
    func trainingTopics() async throws {
        let app = try signedInApp()
        let model = BuilderModel(trainings: app.trainings, loadsOnInit: false)
        model.use(TrainingFixture.options)
        model.toggleTopic("contrast")
        await assertScreens(
            NavigationStack { TrainingTopicsView(model: model) }.environment(app), named: "training-topics")
    }

    @Test("ожидание старта: акцентная кнопка и индикатор")
    func trainingBusyStart() async throws {
        let app = try signedInApp()
        try app.didSignIn(.init(token: "t", user: Fixture.user))
        let model = BuilderModel(trainings: app.trainings, loadsOnInit: false)
        model.use(TrainingFixture.options)
        let gate = StubServer.Gate()
        server.on("POST /api/trainings", .gated(gate, 201, TrainingFixture.json(TrainingFixture.session)))
        let start = Task { await model.start() }
        await eventually { model.starting }
        defer { gate.open() }
        await assertScreens(
            NavigationStack { TrainingBuilderView(model: model) }.environment(app), named: "training-start-busy")
        gate.open()
        _ = await start.value
    }

    @Test("Главная — продолжить тренировку")
    func homeWithTraining() async throws {
        let app = try signedInApp()
        try app.didSignIn(.init(token: "t", user: Fixture.user))
        server.on("POST /api/trainings", .json(201, TrainingFixture.json(TrainingFixture.session)))
        let id = try await app.trainings.start(TrainingFixture.options.presets[0].request)
        app.trainings.recordPosition(id, position: 2)
        await eventually { app.trainings.active?.position == 2 }
        let model = try #require(app.shell)
        await model.refresh()
        await assertScreens(TrainingHomeView(model: model).environment(app), named: "home-with-training")
    }

    @Test("конструктор — нет сети и сбой")
    func trainingUnavailable() async throws {
        let app = try signedInApp()
        let model = BuilderModel(trainings: app.trainings, loadsOnInit: false)
        server.on("GET /api/trainings/options", .failure(.notConnectedToInternet))
        await model.load()
        await assertScreens(
            NavigationStack { TrainingBuilderView(model: model) }.environment(app),
            named: "training-offline")
        server.on("GET /api/trainings/options", .json(500, Fixture.error("internal")))
        await model.load()
        await assertScreens(
            NavigationStack { TrainingBuilderView(model: model) }.environment(app),
            named: "training-failed")
    }

    @Test("конструктор — ошибка старта")
    func trainingStartProblems() async throws {
        let app = try signedInApp()
        try app.didSignIn(.init(token: "t", user: Fixture.user))
        let model = BuilderModel(trainings: app.trainings, loadsOnInit: false)
        model.use(TrainingFixture.options)
        for (reply, name) in [
            (StubServer.Reply.json(409, Fixture.error("no_questions")), "training-no-questions"),
            (.failure(.notConnectedToInternet), "training-start-offline"),
            (.json(500, Fixture.error("internal")), "training-start-failed"),
        ] {
            server.on("POST /api/trainings", reply)
            _ = await model.start()
            await assertScreens(
                NavigationStack { TrainingBuilderView(model: model) }.environment(app),
                named: name)
        }
        model.setType(.sentenceEquivalence)
        await assertScreens(
            NavigationStack { TrainingBuilderView(model: model) }.environment(app),
            named: "training-empty")
    }

    @Test("вопрос начатой тренировки и отсутствие данных")
    func trainingSession() async throws {
        let app = try signedInApp()
        try app.didSignIn(.init(token: "t", user: Fixture.user))
        server.on("POST /api/trainings", .json(201, TrainingFixture.json(TrainingFixture.session)))
        let id = try await app.trainings.start(TrainingFixture.options.presets[0].request)
        await assertScreens(
            NavigationStack {
                TrainingSessionView(id: id, trainings: app.trainings, keyboardAvailable: Self.snapshotHasKeyboard)
            }.environment(app),
            named: "training-session")
        await assertScreens(
            NavigationStack {
                TrainingSessionView(
                    id: "missing", trainings: app.trainings, keyboardAvailable: Self.snapshotHasKeyboard)
            }.environment(app),
            named: "training-missing")
    }

    @Test("T6: тихая строка без сети, обе темы и размеры")
    func trainingOfflineBanner() async throws {
        let model = try await sessionModel(TrainingFixture.sample(.textCompletion))
        model.select("A")
        let view = NavigationStack {
            TrainingSessionView(model: model, keyboardAvailable: Self.snapshotHasKeyboard)
        }.environment(\.gpTrainingOffline, true)
        await assertScreens(view, named: "training-offline-banner")
        await assertScreens(
            view.environment(\.textScale, GPType.textScaleLarge), named: "training-offline-banner-larger")
        #if os(iOS)
            await assertScreens(
                view, named: "training-offline-banner-wide", devices: [.pad], padLandscape: true)
        #endif
    }

    private func sessionModel(
        _ question: Question, check: Bool = false, clock: TrainingTestClock = TrainingTestClock(),
        store: TrainingStore = temporaryTrainingStore()
    )
        async throws -> SessionModel
    {
        var t = TrainingFixture.stored()
        t.session.items = (0..<3).map { .init(position: $0, question: question) }
        t.session.questionTypes = [question.questionType]
        t.session.section = question.section
        if check {
            t.session.mode = .check
            t.session.timeLimitSeconds = 270
        }
        try store.saveOwner("person")
        try store.save(t)
        server.on("POST /api/trainings/\(t.id)/answers", .failure(.notConnectedToInternet))
        let trainings = TrainingModel(
            store: store, now: { clock.now }, report: { _, _ in }, unauthorized: {})
        trainings.connect(
            api: API(config: server.config(), session: server.session, tokens: MemoryTokenStore("t")), ownerID: "person"
        )
        await eventually { trainings.trainings[t.id] != nil }
        return SessionModel(id: t.id, trainings: trainings)
    }

    private func assertSession(
        _ model: SessionModel, name: String, file: StaticString = #filePath, testName: String = #function,
        line: UInt = #line
    ) async {
        let view = NavigationStack { TrainingSessionView(model: model, keyboardAvailable: Self.snapshotHasKeyboard) }
        await assertScreens(view, named: name, file: file, testName: testName, line: line)
        await assertScreens(
            view.environment(\.textScale, GPType.textScaleLarge), named: name + "-larger", file: file,
            testName: testName, line: line)
        #if os(iOS)
            // Полноэкранная тренировка после перехода из оболочки должна сохранять широкую раскладку.
            // Та же проверка выполняется в regular-окне хоста, а на iPad — на настоящем устройстве.
            if UIDevice.current.userInterfaceIdiom == .phone,
                [
                    "training-question-tc", "training-overview", "training-summary", "training-summary-perfect",
                    "training-summary-timed-out",
                ].contains(name)
            {
                await assertScreens(
                    NavigationStack { TrainingSessionView(model: model, keyboardAvailable: true) },
                    named: name + "-regular", devices: [.phone], regularWidth: true,
                    file: file, testName: testName, line: line)
            }
            // Эти состояния должны проверить и широкую панель iPad: книжные 834 pt не пересекают breakpointWide.
            if UIDevice.current.userInterfaceIdiom == .pad,
                [
                    "training-question-tc", "training-overview", "training-summary", "training-summary-perfect",
                    "training-summary-timed-out",
                ].contains(name)
            {
                for larger in [false, true] {
                    await assertScreens(
                        view.environment(\.textScale, larger ? GPType.textScaleLarge : 1),
                        named: name + (larger ? "-larger" : "") + "-landscape", devices: [.pad],
                        padLandscape: true, file: file, testName: testName, line: line)
                }
            }
        #endif
    }

    @Test("вопрос: четыре типа и один, два, три пропуска")
    func trainingQuestions() async throws {
        for (type, blanks, name) in [
            (Components.Schemas.QuestionType.textCompletion, 1, "tc"), (.textCompletion, 2, "tc-two"),
            (.textCompletion, 3, "tc-three"), (.sentenceEquivalence, 1, "se"),
            (.quantitativeComparison, 1, "qc"), (.multipleChoice, 1, "mc"),
        ] {
            let q = TrainingFixture.sample(type, blanks: blanks)
            let model = try await sessionModel(q)
            model.select(q.groups[0].options[0].id)
            await assertSession(model, name: "training-question-" + name)
        }
    }

    @Test("разбор: неверно, раскрыт, EN, верно, «Не знаю»")
    func trainingExplanation() async throws {
        let q = TrainingFixture.sample(.textCompletion)
        let model = try await sessionModel(q)
        model.select("C")
        model.check()
        await assertSession(model, name: "training-explanation")
        model.whyNotOpen = true
        await assertSession(model, name: "training-explanation-open")
        model.english = true
        await assertSession(model, name: "training-explanation-en")
        let correct = try await sessionModel(TrainingFixture.sample(.sentenceEquivalence))
        for option in correct.screen!.question.answer { correct.select(option) }
        correct.check()
        await assertSession(correct, name: "training-correct")
        let unknown = try await sessionModel(q)
        unknown.dontKnow()
        await assertSession(unknown, name: "training-dont-know")
    }

    @Test("Проверка: таймер и список вопросов")
    func trainingCheck() async throws {
        let model = try await sessionModel(TrainingFixture.sample(.textCompletion), check: true)
        model.toggleFlag()
        model.next()
        model.select("A")
        await assertSession(model, name: "training-check")
        model.openOverview()
        await assertSession(model, name: "training-overview")
        #if os(iOS)
            if UIDevice.current.userInterfaceIdiom == .pad {
                let q = TrainingFixture.sample(.textCompletion, blanks: 3)
                let partial = try await sessionModel(q, check: true)
                partial.select(q.answer[0])
                partial.openOverview()
                for larger in [false, true] {
                    let view = NavigationStack {
                        TrainingSessionView(model: partial, keyboardAvailable: Self.snapshotHasKeyboard)
                    }

                    .environment(\.textScale, larger ? GPType.textScaleLarge : 1)
                    for dark in [false, true] {
                        assertSnapshot(
                            of: view.gpDesignTokens().environment(\.colorScheme, dark ? .dark : .light),
                            as: .image(
                                drawHierarchyInKeyWindow: true,
                                precision: Self.precision, perceptualPrecision: Self.perceptual,
                                layout: .device(config: Self.padLandscape),
                                traits: UITraitCollection(userInterfaceStyle: dark ? .dark : .light)
                            ),
                            named:
                                "training-overview-partial\(larger ? "-larger" : "")-ipad-landscape-\(dark ? "dark" : "light")"
                        )
                    }
                }
            }
        #endif
    }

    @Test("итог: ошибки и без ошибок")
    func trainingSummary() async throws {
        let q = TrainingFixture.sample(.textCompletion)
        let model = try await sessionModel(q)
        model.select("A")
        model.check()
        model.next()
        model.select("C")
        model.check()
        model.next()
        model.dontKnow()
        model.next()
        await assertSession(model, name: "training-summary")
        let perfect = try await sessionModel(q)
        for _ in 0..<3 {
            perfect.select("A")
            perfect.check()
            perfect.next()
        }
        await assertSession(perfect, name: "training-summary-perfect")
        let clock = TrainingTestClock()
        let timed = try await sessionModel(q, check: true, clock: clock)
        timed.select("C")
        clock.advance(300)
        timed.tick()
        await assertSession(timed, name: "training-summary-timed-out")
    }

    #if os(iOS)
        @Test(
            "разбор целиком виден на iPad с «Крупнее»",
            .enabled { await MainActor.run { UIDevice.current.userInterfaceIdiom == .pad } })
        func trainingExplanationDoesNotTruncate() async throws {
            let model = try await sessionModel(TrainingFixture.sample(.textCompletion))
            model.select("C")
            model.check()
            model.english = false
            model.whyNotOpen = true
            let view = AnyView(
                NavigationStack { TrainingSessionView(model: model, keyboardAvailable: Self.snapshotHasKeyboard) }
                    .environment(\.textScale, GPType.textScaleLarge).gpDesignTokens().environment(\.colorScheme, .light)
            )
            let strategy = Snapshotting<AnyView, UIImage>.image(
                drawHierarchyInKeyWindow: true, layout: .device(config: Self.pad),
                traits: UITraitCollection(userInterfaceStyle: .light))
            let rendered: UIImage = await withCheckedContinuation { continuation in
                strategy.snapshot(view).run { continuation.resume(returning: $0) }
            }
            let cgImage = try #require(rendered.cgImage)
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["ru-RU", "en-US"]
            try VNImageRequestHandler(cgImage: cgImage).perform([request])
            let visible = request.results?.compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ") ?? ""
            // Метка VoiceOver содержит весь текст даже при обрезании; проверяем именно прочитанные пиксели.
            #expect(visible.contains("повтора"), "Конец объяснения не виден: \(visible)")
        }

        @Test("вопрос и разбор с крупным системным шрифтом", .enabled { await ScreenSnapshotTests.isPhone() })
        func trainingDynamicType() async throws {
            let model = try await sessionModel(TrainingFixture.sample(.textCompletion, blanks: 3))
            await assertScreens(
                NavigationStack { TrainingSessionView(model: model, keyboardAvailable: Self.snapshotHasKeyboard) }
                    .environment(\.dynamicTypeSize, .accessibility3),
                named: "training-dynamic-type", devices: [.phone])
            model.dontKnow()
            await assertScreens(
                NavigationStack { TrainingSessionView(model: model, keyboardAvailable: Self.snapshotHasKeyboard) }
                    .environment(\.dynamicTypeSize, .accessibility3),
                named: "training-dynamic-explanation",
                devices: [.phone])
        }
    #endif

    @Test("все ответы: список, ошибки, вопрос, язык и крупный текст")
    func trainingReview() async throws {
        let session = try await sessionModel(TrainingFixture.sample(.textCompletion), check: true)
        session.select("A")
        session.next()
        session.select("C")
        session.end()
        await eventually { session.trainings.trainings[session.id]?.isFinished == true }
        let review = ReviewModel(id: session.id, trainings: session.trainings)
        let view = NavigationStack { TrainingReviewView(model: review, keyboardAvailable: Self.snapshotHasKeyboard) }
        await assertScreens(view, named: "training-review")
        await assertScreens(view.environment(\.textScale, GPType.textScaleLarge), named: "training-review-larger")
        #if os(iOS)
            if UIDevice.current.userInterfaceIdiom == .phone {
                await assertScreens(
                    NavigationStack { TrainingReviewView(model: review, keyboardAvailable: true) },
                    named: "training-review-regular", devices: [.phone], regularWidth: true)
            }
        #endif
        review.onlyMistakes = true
        await assertScreens(view, named: "training-review-mistakes")
        let screen = try #require(review.screen(1))
        let item = NavigationStack { TrainingReviewItemView(screen: screen, trainings: session.trainings) }
        await assertScreens(item, named: "training-review-question")
        await assertScreens(
            item.environment(\.textScale, GPType.textScaleLarge), named: "training-review-question-larger")
        await assertScreens(
            item.environment(\.dynamicTypeSize, .accessibility3), named: "training-review-dynamic", devices: [.phone])
        let perfect = try await sessionModel(TrainingFixture.sample(.textCompletion))
        for _ in 0..<3 {
            perfect.select("A")
            perfect.check()
            perfect.next()
        }
        await eventually { perfect.trainings.trainings[perfect.id]?.isFinished == true }
        let noMistakes = ReviewModel(id: perfect.id, trainings: perfect.trainings)
        noMistakes.onlyMistakes = true
        await assertScreens(
            NavigationStack { TrainingReviewView(model: noMistakes, keyboardAvailable: Self.snapshotHasKeyboard) },
            named: "training-review-perfect")
    }

    @Test("жалоба: выбор, лимит, подтверждение и крупный текст")
    func trainingReport() async throws {
        let store = temporaryTrainingStore()
        let session = try await sessionModel(TrainingFixture.sample(.textCompletion), store: store)
        let model = QuestionReportModel(id: session.id, position: 0, trainings: session.trainings)
        await assertScreens(QuestionReportView(model: model), named: "training-report-empty")
        model.setKind(.explanation)
        await assertScreens(QuestionReportView(model: model), named: "training-report")
        await assertScreens(
            QuestionReportView(model: model).environment(\.textScale, GPType.textScaleLarge),
            named: "training-report-larger")
        await assertScreens(
            QuestionReportView(model: model).environment(\.dynamicTypeSize, .accessibility3),
            named: "training-report-dynamic", devices: [.phone])
        model.setText(String(repeating: "x", count: 2001))
        await assertScreens(QuestionReportView(model: model), named: "training-report-over-limit")
        model.setText("")
        await eventually { session.trainings.reportDraft(session.id, position: 0).text == "" }
        let backup = store.directory.appendingPathExtension("backup")
        try FileManager.default.moveItem(at: store.directory, to: backup)
        try Data().write(to: store.directory)
        model.send()
        await eventually { model.problem && !model.saving }
        await assertScreens(QuestionReportView(model: model), named: "training-report-failed")
        try FileManager.default.removeItem(at: store.directory)
        try FileManager.default.moveItem(at: backup, to: store.directory)
        model.send()
        await eventually { model.sent }
        await assertScreens(QuestionReportView(model: model), named: "training-report-sent")
    }

    #if os(macOS)
        @Test("Первый кадр вопроса итогового разбора содержит объяснение")
        func trainingReviewFirstFrameIncludesExplanation() async throws {
            let session = try await sessionModel(TrainingFixture.sample(.textCompletion), check: true)
            session.end()
            await eventually { session.trainings.trainings[session.id]?.isFinished == true }
            let screen = try #require(ReviewModel(id: session.id, trainings: session.trainings).screen(0))
            let view = ReviewQuestionView(screen: screen, trainings: session.trainings)
                .frame(width: 760).padding(GPSpace.s24).environment(\.locale, Locale(identifier: "ru"))
            let image = try #require(ImageRenderer(content: view).cgImage)
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["ru-RU", "en-US"]
            try VNImageRequestHandler(cgImage: image).perform([request])
            let visible = request.results?.compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ") ?? ""
            #expect(visible.contains("Подсказка"), "Первый кадр не содержит объяснения")
        }

        @Test("Escape закрывает жалобу на Mac и удаляет черновик")
        func trainingMacReportEscape() async throws {
            try await reportEscape(sending: false)
        }
        @Test("Escape не закрывает жалобу, пока идёт её запись")
        func trainingMacReportEscapeWhileSaving() async throws {
            try await reportEscape(sending: true)
        }
        private func reportEscape(sending: Bool) async throws {
            let session = try await sessionModel(TrainingFixture.sample(.textCompletion))
            let form = QuestionReportModel(id: session.id, position: 0, trainings: session.trainings)
            form.setKind(.other)
            let state = ReportSheetState()
            let root = Color.clear.sheet(
                isPresented: Binding(
                    get: { state.presented },
                    set: {
                        state.presented = $0
                        if !$0 { state.dismissals += 1 }
                    })
            ) {
                QuestionReportView(model: form)
            }
            let controller = NSHostingController(rootView: root)
            let window = NSWindow(
                contentRect: NSRect(x: -2000, y: -2000, width: 1100, height: 760),
                styleMask: [.titled, .closable], backing: .buffered, defer: false)
            window.contentViewController = controller
            window.setContentSize(NSSize(width: 1100, height: 760))
            window.makeKeyAndOrderFront(nil)
            defer { window.orderOut(nil) }
            await eventually { window.attachedSheet != nil }
            let sheet = try #require(window.attachedSheet)
            let event = try #require(
                NSEvent.keyEvent(
                    with: .keyDown, location: .zero, modifierFlags: [],
                    timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: sheet.windowNumber, context: nil,
                    characters: "\u{1b}", charactersIgnoringModifiers: "\u{1b}", isARepeat: false, keyCode: 53))
            if sending {
                form.send()
                #expect(form.saving)
                sheet.sendEvent(event)
                #expect(state.presented && form.saving)
                await eventually { form.sent && !form.saving }
                // Ждём новый первый responder и разметку подтверждения, затем посылаем новый NSEvent.
                await Task.yield()
                controller.view.layoutSubtreeIfNeeded()
                sheet.contentView?.layoutSubtreeIfNeeded()
            }
            let exit = try #require(
                NSEvent.keyEvent(
                    with: .keyDown, location: .zero, modifierFlags: [],
                    timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: sheet.windowNumber, context: nil,
                    characters: "\u{1b}", charactersIgnoringModifiers: "\u{1b}", isARepeat: false, keyCode: 53))
            // Как настоящее нажатие: через приложение, чтобы сработали и сочетания клавиш окна (.cancelAction).
            NSApp.sendEvent(exit)
            await eventually { !state.presented }
            #expect(state.dismissals == 1)
            #expect(!form.saving && session.trainings.reportDraft(session.id, position: 0).isEmpty)
        }

        @Test("Return в широком разборе оставляет список и правую панель")
        func trainingMacReviewKeyboard() async throws {
            let session = try await sessionModel(TrainingFixture.sample(.textCompletion), check: true)
            session.end()
            await eventually { session.trainings.trainings[session.id]?.isFinished == true }
            let review = ReviewModel(id: session.id, trainings: session.trainings)
            let controller = NSHostingController(rootView: NavigationStack { TrainingReviewView(model: review) })
            let window = NSWindow(
                contentRect: NSRect(x: -2000, y: -2000, width: 1100, height: 760),
                styleMask: [.titled, .closable], backing: .buffered, defer: false)
            window.contentViewController = controller
            window.setContentSize(NSSize(width: 1100, height: 760))
            window.makeKeyAndOrderFront(nil)
            defer { window.orderOut(nil) }
            await eventually { window.firstResponder != nil }
            controller.view.layoutSubtreeIfNeeded()
            await eventually { window.firstResponder !== window }
            func key(_ characters: String, code: UInt16) throws {
                let event = try #require(
                    NSEvent.keyEvent(
                        with: .keyDown, location: .zero, modifierFlags: [],
                        timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                        context: nil,
                        characters: characters, charactersIgnoringModifiers: characters, isARepeat: false, keyCode: code
                    ))
                window.sendEvent(event)
            }
            try key(String(UnicodeScalar(NSDownArrowFunctionKey)!), code: 125)
            await eventually { review.selectedPosition == 1 }
            try key("\r", code: 36)
            // Вместо копии вопроса должна остаться двухколоночная страница; следующий выбор тоже работает.
            try key(String(UnicodeScalar(NSDownArrowFunctionKey)!), code: 125)
            await eventually { review.selectedPosition == 2 }
            try key(String(UnicodeScalar(NSUpArrowFunctionKey)!), code: 126)
            await eventually { review.selectedPosition == 1 }
            let replacement = ReviewModel(id: session.id, trainings: session.trainings)
            controller.rootView = NavigationStack { TrainingReviewView(model: replacement) }
            await Task.yield()
            controller.view.layoutSubtreeIfNeeded()
            let refreshed = try #require(controller.view.bitmapImageRepForCachingDisplay(in: controller.view.bounds))
            controller.view.cacheDisplay(in: controller.view.bounds, to: refreshed)
            try key(String(UnicodeScalar(NSDownArrowFunctionKey)!), code: 125)
            await eventually { review.selectedPosition == 2 }
            #expect(replacement.selected == nil)
            controller.view.layoutSubtreeIfNeeded()
            let bitmap = try #require(controller.view.bitmapImageRepForCachingDisplay(in: controller.view.bounds))
            controller.view.cacheDisplay(in: controller.view.bounds, to: bitmap)
            let png = try #require(bitmap.representation(using: .png, properties: [:]))
            let path = URL(filePath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
                .deletingLastPathComponent().appending(path: "build/revision-mac-review-keyboard.png")
            try png.write(to: path)
        }

        @Test("клавиши настоящего широкого окна Mac")
        func trainingMacKeyboard() async throws {
            let model = try await sessionModel(TrainingFixture.sample(.textCompletion))
            let controller = NSHostingController(rootView: NavigationStack { TrainingSessionView(model: model) })
            let window = NSWindow(
                contentRect: NSRect(x: -2000, y: -2000, width: 1100, height: 760),
                styleMask: [.titled, .closable], backing: .buffered, defer: false)
            window.contentViewController = controller
            window.makeKeyAndOrderFront(nil)
            defer { window.orderOut(nil) }
            await eventually { window.firstResponder != nil }
            func key(_ characters: String, code: UInt16) throws {
                let event = try #require(
                    NSEvent.keyEvent(
                        with: .keyDown, location: .zero, modifierFlags: [],
                        timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                        context: nil, characters: characters, charactersIgnoringModifiers: characters, isARepeat: false,
                        keyCode: code))
                window.sendEvent(event)
            }
            try key("a", code: 0)
            await eventually { model.screen?.selection == ["A"] }
            try key("\r", code: 36)
            await eventually { model.screen?.revealed == true }
            try key(String(UnicodeScalar(NSRightArrowFunctionKey)!), code: 124)
            await eventually { model.screen?.position == 1 }
            await assertScreens(
                NavigationStack { TrainingSessionView(model: model, keyboardAvailable: Self.snapshotHasKeyboard) },
                named: "training-mac-keyboard")
        }
    #endif

    /// Симулятор может сам подключить клавиатуру при первом окне. Эталон задаёт её явно:
    /// iPad и Mac — с клавишами, iPhone — без них; живые экраны используют GCKeyboard.
    static var snapshotHasKeyboard: Bool {
        #if os(iOS)
            UIDevice.current.userInterfaceIdiom == .pad
        #else
            true
        #endif
    }

    enum Device { case phone, pad }
    enum Presentation { case root, profile, examPicker }
    enum Theme { case light, dark }

    /// Тесты только для телефона на iPad и Mac пропускаются явно (в отчёте — «пропущен», а не пустой «прошёл»).
    nonisolated static func isPhone() async -> Bool {
        #if os(iOS)
            await MainActor.run { UIDevice.current.userInterfaceIdiom == .phone }
        #else
            false
        #endif
    }

    /// Системные панели снимаются в настоящем окне; наши поверхности плоские.
    /// Строгий допуск ловит пропавший значок или цифру (0,5 % пропускали и то и другое).
    static let precision: Float = 0.9999
    static let perceptual: Float = 0.98

    #if os(iOS)
        /// iPhone 18 Pro / iOS 27: 402 × 874 pt, вырез сверху 62, полоса жестов 34.
        static let phone = ViewImageConfig(
            safeArea: UIEdgeInsets(top: 62, left: 0, bottom: 34, right: 0),
            size: CGSize(width: 402, height: 874),
            traits: UITraitCollection { traits in
                traits.userInterfaceIdiom = .phone
                traits.displayScale = 3
                traits.horizontalSizeClass = .compact
                traits.verticalSizeClass = .regular
            }
        )

        /// iPad Pro 11″ (M5) в книжной ориентации — размер экрана симулятора «GrePrep iPad».
        static let pad = ViewImageConfig(
            safeArea: UIEdgeInsets(top: 24, left: 0, bottom: 20, right: 0),
            size: CGSize(width: 834, height: 1210),
            traits: UITraitCollection { traits in
                traits.userInterfaceIdiom = .pad
                traits.displayScale = 2
                traits.horizontalSizeClass = .regular
                traits.verticalSizeClass = .regular
            }
        )

        static let padLandscape = ViewImageConfig(
            safeArea: UIEdgeInsets(top: 24, left: 0, bottom: 20, right: 0),
            size: CGSize(width: 1210, height: 834),
            traits: UITraitCollection { traits in
                traits.userInterfaceIdiom = .pad
                traits.displayScale = 2
                traits.horizontalSizeClass = .regular
                traits.verticalSizeClass = .regular
            }
        )
    #endif

    func assertScreens(
        _ screen: some View,
        named name: String,
        devices: [Device] = [.phone, .pad],
        themes: [Theme] = [.light, .dark],
        precision: Float = ScreenSnapshotTests.precision,
        padLandscape: Bool = false,
        regularWidth: Bool = false,
        largerText: Bool = false,
        presentation: Presentation = .root,
        fileID: StaticString = #fileID,
        file: StaticString = #filePath,
        testName: String = #function,
        line: UInt = #line,
        column: UInt = #column
    ) async {
        // Эталон фиксирует неподвижное состояние: символ загрузки не меняет фазу между кадрами.
        // Нативные панели всё равно снимаются настоящей иерархией, их материал не подменяется.
        let view = screen.gpDesignTokens().symbolEffectsRemoved().transaction { $0.disablesAnimations = true }
        #if os(iOS)
            let current: Device = UIDevice.current.userInterfaceIdiom == .pad ? .pad : .phone
            for device in devices where device == current {
                let config =
                    regularWidth
                    ? Self.padLandscape : device == .phone ? Self.phone : (padLandscape ? Self.padLandscape : Self.pad)
                for style in themes.map({ $0 == .dark ? UIUserInterfaceStyle.dark : .light }) {
                    let preferences = UserDefaults(suiteName: "snapshot-\(UUID().uuidString)")!
                    preferences.set(style == .dark ? "dark" : "light", forKey: AppTheme.storageKey)
                    preferences.set(largerText, forKey: TextSizePreference.storageKey)
                    if presentation != .root {
                        guard
                            let host = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
                                .flatMap(\.windows).first(where: \.isKeyWindow), let scene = host.windowScene
                        else {
                            Issue.record("Нет окна приложения для снимка")
                            continue
                        }
                        let window = UIWindow(windowScene: scene)
                        window.frame = CGRect(origin: host.frame.origin, size: config.size ?? host.frame.size)
                        window.overrideUserInterfaceStyle = style
                        let controller = UIHostingController(
                            rootView: view.defaultAppStorage(preferences)
                                .environment(\.colorScheme, style == .dark ? .dark : .light))
                        if regularWidth { controller.traitOverrides.horizontalSizeClass = .regular }
                        window.rootViewController = controller
                        let previousAnimations = UIView.areAnimationsEnabled
                        UIView.setAnimationsEnabled(false)
                        window.makeKeyAndVisible()
                        defer {
                            controller.dismiss(animated: false)
                            window.isHidden = true
                            window.rootViewController = nil
                            host.makeKeyAndVisible()
                            UIView.setAnimationsEnabled(previousAnimations)
                        }
                        controller.view.layoutIfNeeded()
                        await eventually {
                            controller.view.layoutIfNeeded()
                            let controllers = Self.controllers(controller)
                            if presentation == .examPicker {
                                return controllers.contains {
                                    $0.presentedViewController?.view.window != nil
                                        && $0.presentedViewController?.isBeingPresented == false
                                }
                            }
                            let tabs = controllers.compactMap { $0 as? UITabBarController }
                            if device == .pad || regularWidth {
                                return controllers.compactMap { $0 as? UINavigationController }.contains {
                                    $0.viewControllers.count > 1 && $0.visibleViewController?.view.window != nil
                                }
                            }
                            guard !tabs.isEmpty else { return false }
                            return tabs.allSatisfy {
                                let bar = $0.tabBar
                                return bar.isHidden || bar.alpha == 0
                                    || !bar.convert(bar.bounds, to: window).intersects(window.bounds)
                            }
                        }
                        window.layoutIfNeeded()
                        let format = UIGraphicsImageRendererFormat()
                        format.scale = device == .phone ? 3 : 2
                        let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
                            window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
                        }
                        assertSnapshot(
                            of: image,
                            as: .image(precision: precision, perceptualPrecision: Self.perceptual)
                                .comparingPersistedImage(),
                            named:
                                "\(name)-\(device == .phone ? "iphone" : "ipad")-\(style == .dark ? "dark" : "light")",
                            fileID: fileID, file: file, testName: testName, line: line, column: column)
                        continue
                    }
                    // Системное стекло панели получает тему от окна, а не только от traits контроллера.
                    // Своё окно на каждый кадр не наследует материал и переходы предыдущего снимка.
                    UIView.performWithoutAnimation {
                        guard
                            let host = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
                                .flatMap(\.windows).first(where: \.isKeyWindow),
                            let scene = host.windowScene
                        else {
                            Issue.record("Нет окна приложения для снимка")
                            return
                        }
                        let window = UIWindow(windowScene: scene)
                        if padLandscape || regularWidth, let size = config.size {
                            window.frame = CGRect(origin: host.frame.origin, size: size)
                        } else {
                            window.frame = host.frame
                        }
                        window.overrideUserInterfaceStyle = style
                        window.rootViewController = UIViewController()
                        window.makeKeyAndVisible()
                        defer {
                            window.isHidden = true
                            window.rootViewController = nil
                            host.makeKeyAndVisible()
                        }
                        assertSnapshot(
                            of: view.defaultAppStorage(preferences).environment(
                                \.colorScheme, style == .dark ? .dark : .light),
                            as: .image(
                                drawHierarchyInKeyWindow: true,
                                precision: precision, perceptualPrecision: Self.perceptual,
                                layout: .device(config: config),
                                traits: UITraitCollection(userInterfaceStyle: style)
                            ).comparingPersistedImage(),
                            named:
                                "\(name)-\(device == .phone ? "iphone" : "ipad")-\(style == .dark ? "dark" : "light")",
                            fileID: fileID, file: file, testName: testName, line: line, column: column
                        )
                    }
                }
            }
        #elseif os(macOS)
            // List создаёт строки только после присоединения к окну; снимок пустой боковой панели был бы ложным эталоном.
            guard devices.contains(.pad) else { return }
            for dark in themes.map({ $0 == .dark }) {
                let preferences = UserDefaults(suiteName: "snapshot-\(UUID().uuidString)")!
                preferences.set(dark ? "dark" : "light", forKey: AppTheme.storageKey)
                preferences.set(largerText, forKey: TextSizePreference.storageKey)
                let controller = NSHostingController(
                    rootView: view.defaultAppStorage(preferences).environment(\.colorScheme, dark ? .dark : .light))
                controller.view.frame = CGRect(x: 0, y: 0, width: 1100, height: 760)
                controller.view.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
                let window = NSWindow(
                    contentRect: controller.view.frame, styleMask: [.borderless], backing: .buffered, defer: false)
                window.contentViewController = controller
                window.appearance = controller.view.appearance
                window.orderFront(nil)
                defer {
                    window.orderOut(nil)
                    window.contentViewController = nil
                }
                // AppKit откладывает высоту многострочного поля до раскладки. Иначе после очистки длинного
                // текста cacheDisplay может снять ещё прежнюю высоту и сдвинуть сообщение об ошибке.
                controller.view.layoutSubtreeIfNeeded()
                if presentation == .examPicker {
                    await eventually { window.childWindows?.contains { $0.isVisible && $0.contentView != nil } == true }
                    controller.view.layoutSubtreeIfNeeded()
                    let rendered = NSImage(size: controller.view.bounds.size)
                    rendered.lockFocus()
                    if let bitmap = controller.view.bitmapImageRepForCachingDisplay(in: controller.view.bounds) {
                        controller.view.cacheDisplay(in: controller.view.bounds, to: bitmap)
                        bitmap.draw(in: controller.view.bounds)
                    } else {
                        Issue.record("Не удалось снять окно Mac")
                    }
                    for popup in window.childWindows ?? [] where popup.isVisible {
                        guard let content = popup.contentView?.superview ?? popup.contentView,
                            let bitmap = content.bitmapImageRepForCachingDisplay(in: content.bounds)
                        else {
                            Issue.record("Не удалось снять popover Mac")
                            continue
                        }
                        content.layoutSubtreeIfNeeded()
                        content.cacheDisplay(in: content.bounds, to: bitmap)
                        let frame = content.convert(content.bounds, to: nil)
                        let screenFrame = popup.convertToScreen(frame)
                        let target = window.convertFromScreen(screenFrame)
                        bitmap.draw(in: target)
                    }
                    rendered.unlockFocus()
                    assertSnapshot(
                        of: rendered,
                        as: .image(precision: Self.precision, perceptualPrecision: Self.perceptual),
                        named: "\(name)-mac-\(dark ? "dark" : "light")",
                        fileID: fileID, file: file, testName: testName, line: line, column: column)
                    continue
                }
                assertSnapshot(
                    of: controller,
                    as: .image(
                        precision: Self.precision, perceptualPrecision: Self.perceptual,
                        size: CGSize(width: 1100, height: 760)),
                    named: "\(name)-mac-\(dark ? "dark" : "light")",
                    fileID: fileID, file: file, testName: testName, line: line, column: column
                )
            }
        #endif
    }

    #if os(iOS)
        private static func controllers(_ root: UIViewController) -> [UIViewController] {
            [root] + root.children.flatMap(controllers)
        }
    #endif
}
