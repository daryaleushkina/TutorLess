import Foundation
import GPAPI
import Testing

@testable import GrePrep

@MainActor
@Suite("Оболочка: аккаунт, экзамены, главная и откаты")
struct ShellModelTests {
    let server = StubServer()
    let cache = temporaryCache()
    let network = NetworkMonitor()

    func app(user: UserDTO = ShellFixture.user()) throws -> AppModel {
        ShellFixture.stub(server, user: user)
        let app = AppModel(
            config: server.config(), tokens: MemoryTokenStore(), cache: cache, network: network, session: server.session
        )
        try app.didSignIn(.init(token: "t", user: user))
        return app
    }

    @Test("до ответа аккаунта язык берётся из локализаций приложения")
    func languageBeforeAccountLoads() {
        let app = AppModel(
            config: server.config(), tokens: MemoryTokenStore("t"), cache: cache, network: network,
            session: server.session)
        #expect(app.shell?.user == nil)
        #expect(app.shell?.locale == InterfaceLocale.preferredLanguage)
        #expect(InterfaceLocale.preferredLanguage.rawValue == Bundle.main.preferredLocalizations.first)
    }

    @Test("первый вход: экзамен отсутствует, каталог только от сервера")
    func firstEntry() async throws {
        let app = try app(user: ShellFixture.user(exam: nil))
        let model = try #require(app.shell)
        await model.refresh()
        #expect(model.exam == nil)
        #expect(model.exams.map(\.id) == [.gre, .toefl])
        #expect(model.home == nil)
        #expect(server.requests("GET /api/home").isEmpty)
        #expect(server.requests("GET /api/today").isEmpty)
        #expect(!(await model.choose(.gre)))
        #expect(model.exam == nil && model.examProblem == .failed)
    }

    @Test("успех PUT exam сохраняет выбор и запрашивает главную выбранного экзамена")
    func changeExam() async throws {
        let app = try app()
        let model = try #require(app.shell)
        await model.refresh()
        server.on("PUT /api/me/exam", .json(200, ShellFixture.json(ShellFixture.user(exam: .toefl))))
        server.on("GET /api/me", .json(200, ShellFixture.json(ShellFixture.user(exam: .toefl))))
        server.on(
            "GET /api/trainings/options",
            .json(200, ShellFixture.json(TrainingOptions(types: [], presets: [], maxQuestions: 50))))
        #expect(await model.choose(.toefl))
        await eventually { model.home != nil && model.choosing == nil }
        #expect(model.exam == .toefl && app.trainings.exam == .toefl)
        #expect(model.sections == [.reading, .listening, .writing, .speaking])
        #expect(model.startRequest == nil)
        #expect(model.sections.allSatisfy { model.types(in: $0).isEmpty })
        #expect(try server.requests("PUT /api/me/exam").first?.json()["exam"] as? String == "toefl")
        #expect(server.requests("GET /api/home").last?.query?.contains("exam=toefl") == true)
        #expect(cache.load()?.user?.activeExam == .toefl)
        #expect(await model.choose(.toefl))
        #expect(server.requests("PUT /api/me/exam").count == 1)
    }

    @Test("ошибка и отсутствие сети при выборе оставляют прежний экзамен", arguments: [false, true])
    func examFailure(offline: Bool) async throws {
        let app = try app()
        let model = try #require(app.shell)
        await model.refresh()
        server.on(
            "PUT /api/me/exam", offline ? .failure(.notConnectedToInternet) : .json(500, Fixture.error("internal")))
        #expect(!(await model.choose(.toefl)))
        #expect(model.exam == .gre)
        #expect(model.examProblem == (offline ? .offline : .failed))
        #expect(model.choosing == nil)
    }

    @Test("на время сохранения второе нажатие ничего не отправляет")
    func busyChoice() async throws {
        let app = try app(user: ShellFixture.user(exam: nil))
        let model = try #require(app.shell)
        await model.refresh()
        let gate = StubServer.Gate()
        server.on("PUT /api/me/exam", .gated(gate, 200, ShellFixture.json(ShellFixture.user())))
        let task = Task { await model.choose(.gre) }
        await eventually { model.choosing == .gre }
        #expect(!(await model.choose(.toefl)))
        await eventually { server.requests("PUT /api/me/exam").count == 1 }
        #expect(server.requests("PUT /api/me/exam").count == 1)
        gate.open()
        #expect(await task.value)
        #expect(server.requests("PUT /api/me/exam").count == 1)
    }

    @Test("503 не блокирует следующий старт при живой сети", arguments: [502, 503, 504])
    func startAfterServerReturns(status: Int) async throws {
        let app = try app()
        let model = try #require(app.shell)
        await model.refresh()
        server.on("GET /api/home", .status(status))
        await model.refresh()
        #expect(model.problem == .offline)
        server.on("GET /api/home", .json(200, ShellFixture.homeJSON))
        server.on("POST /api/trainings", .json(201, TrainingFixture.json(TrainingFixture.session)))
        #expect(await model.start() == TrainingFixture.session.id)
        #expect(model.problem == nil && model.startProblem == nil)
        await eventually { server.requests("GET /api/home").count >= 3 }
    }

    @Test("503 → 200 восстанавливается сам, без pull-to-refresh")
    func serverRecoversWhileTrainingIsOpen() async throws {
        let app = try app()
        let model = try #require(app.shell)
        server.on("GET /api/home", .status(503), .json(200, ShellFixture.homeJSON))
        await model.refresh()
        #expect(model.problem == .offline)
        await eventually { model.problem == nil && model.home != nil }
        #expect(server.requests("GET /api/home").count == 2)
    }

    @Test("успех запроса языка снимает старую ошибку связи")
    func successfulRequestClearsOffline() async throws {
        let app = try app()
        let model = try #require(app.shell)
        await model.refresh()
        server.on("GET /api/home", .status(503))
        await model.refresh()
        server.on("PUT /api/me/locale", .json(200, ShellFixture.json(ShellFixture.user(locale: .en))))
        await model.setLocale(.en)
        #expect(model.problem == nil)
    }

    @Test("повторение ошибок использует лимит сервера, без ограничения десятью")
    func mistakesUseServerLimit() async throws {
        let app = try app()
        let model = try #require(app.shell)
        var stats = ShellFixture.stats
        stats.mistakes = 24
        server.on("GET /api/home", .json(200, ShellFixture.json(stats)))
        await model.refresh()
        server.on("POST /api/trainings", .json(201, TrainingFixture.json(TrainingFixture.session)))
        #expect(await model.start(mistakes: true) == TrainingFixture.session.id)
        #expect(try server.requests("POST /api/trainings").first?.json()["count"] as? Int == 24)
    }

    @Test("пауза повтора растёт, выход отменяет ожидающий запрос", arguments: [false, true])
    func recoveryDelayAndCancellation(retire: Bool) async throws {
        let app = try app()
        await app.shell?.refresh()
        let clock = RecoveryGate()
        let model = ShellModel(
            api: app.api, cache: cache, network: network, trainings: app.trainings,
            recoverySleep: { try await clock.sleep($0) }, unauthorized: {}, report: { _, _ in })
        server.on("GET /api/home", .status(503))
        let initial = server.requests("GET /api/home").count
        await model.refresh()
        await eventually { clock.delays.count == 1 }
        #expect(clock.delays == [.seconds(2)])
        #expect(server.requests("GET /api/home").count == initial + 1)
        if retire {
            model.retire()
            clock.advance()
            await eventually { clock.completed == 1 }
            #expect(server.requests("GET /api/home").count == initial + 1)
        } else {
            clock.advance()
            await eventually { clock.delays.count == 2 }
            #expect(clock.delays == [.seconds(2), .seconds(4)])
            server.on("GET /api/home", .json(200, ShellFixture.homeJSON))
            clock.advance()
            await eventually { server.requests("GET /api/home").count == initial + 3 && !model.refreshing }
            #expect(model.problem == nil)
            model.retire()
        }
    }

    @Test("ошибка относится к нажатой строке, ACK ответов подтверждает восстановление сервера")
    func startFailureBelongsToActionAndAcknowledgementRecovers() async throws {
        let app = try app()
        let model = try #require(app.shell)
        var stats = ShellFixture.stats
        stats.mistakes = 2
        server.on("GET /api/home", .json(200, ShellFixture.json(stats)))
        await model.refresh()
        server.on("POST /api/trainings", .failure(.timedOut))
        #expect(await model.start(mistakes: true) == nil)
        #expect(model.startProblem == .offline && model.startProblemAction == .mistakes)
        #expect(model.startingAction == nil)
        server.on("POST /api/trainings/ack/answers", .status(204))
        try await app.api.trainingAnswers("ack", answers: [])
        #expect(model.problem == nil && model.startProblem == nil)
        model.retire()
    }

    @Test("индикатор только у нажатой строки; восстановление пути снимает ошибку старта")
    func startBusyAndNetworkReturn() async throws {
        let app = try app()
        let model = try #require(app.shell)
        var stats = ShellFixture.stats
        stats.mistakes = 2
        server.on("GET /api/home", .json(200, ShellFixture.json(stats)))
        await model.refresh()
        let gate = StubServer.Gate()
        server.on("POST /api/trainings", .gated(gate, 201, TrainingFixture.json(TrainingFixture.session)))
        let task = Task { await model.start(mistakes: true) }
        await eventually { model.startingAction == .mistakes }
        #expect(await model.start() == nil)
        gate.open()
        #expect(await task.value != nil)
        #expect(server.requests("POST /api/trainings").count == 1)
        network.set(online: false)
        #expect(await model.start() == nil)
        #expect(model.startProblem == .offline)
        network.set(online: true)
        await model.networkChanged()
        #expect(model.startProblem == nil)
    }

    @Test("повторное открытие экзамена и профиля не возвращает старое сообщение")
    func dismissActionErrors() async throws {
        let app = try app()
        let model = try #require(app.shell)
        await model.refresh()
        server.on("PUT /api/me/exam", .json(500, Fixture.error("internal")))
        #expect(!(await model.choose(.toefl)))
        #expect(model.examProblem == .failed)
        model.clearExamProblem()
        #expect(model.examProblem == nil)
        server.on("PUT /api/me/locale", .json(500, Fixture.error("internal")))
        await model.setLocale(.en)
        #expect(model.localeProblem == .failed)
        model.clearLocaleProblem()
        #expect(model.localeProblem == nil)
    }

    @Test("язык меняется сразу, принадлежит аккаунту и откатывается при сбое", arguments: [200, 500])
    func localeChange(status: Int) async throws {
        let app = try app()
        let model = try #require(app.shell)
        await model.refresh()
        let gate = StubServer.Gate()
        server.on(
            "PUT /api/me/locale",
            .gated(
                gate, status,
                status == 200 ? ShellFixture.json(ShellFixture.user(locale: .en)) : Fixture.error("internal")))
        if status == 200 {
            server.on("GET /api/me", .json(200, ShellFixture.json(ShellFixture.user(locale: .en))))
        }
        let task = Task { await model.setLocale(.en) }
        await eventually { model.changingLocale }
        #expect(model.locale == .en)
        await model.setLocale(.ru)
        gate.open()
        await task.value
        #expect(model.locale == (status == 200 ? .en : .ru))
        #expect(model.localeProblem == (status == 200 ? nil : .failed))
        #expect(!model.changingLocale)
        #expect(try server.requests("PUT /api/me/locale").first?.json()["locale"] as? String == "en")
        #expect(cache.load()?.user?.locale == (status == 200 ? .en : .ru))
    }

    @Test("язык при отсутствии сети не меняется")
    func localeOffline() async throws {
        let app = try app()
        let model = try #require(app.shell)
        await model.refresh()
        network.set(online: false)
        await model.setLocale(.en)
        #expect(model.locale == .ru && model.localeProblem == .offline)
        #expect(server.requests("PUT /api/me/locale").isEmpty)
    }

    @Test("смена языка во время старта не оставляет главную в состоянии ожидания")
    func localeDuringStart() async throws {
        let app = try app()
        let model = try #require(app.shell)
        await model.refresh()
        let gate = StubServer.Gate()
        server.on("POST /api/trainings", .gated(gate, 201, TrainingFixture.json(TrainingFixture.session)))
        let start = Task { await model.start() }
        await eventually { model.starting }
        server.on("PUT /api/me/locale", .json(200, ShellFixture.json(ShellFixture.user(locale: .en))))
        server.on("GET /api/me", .json(200, ShellFixture.json(ShellFixture.user(locale: .en))))
        await model.setLocale(.en)
        gate.open()
        #expect(await start.value == nil)
        #expect(!model.starting)
        #expect(model.activeTraining != nil)
    }

    @Test("смена языка во время первой загрузки не оставляет главную скелетоном")
    func localeDuringFirstHomeLoad() async throws {
        let app = try app()
        let model = try #require(app.shell)
        let gate = StubServer.Gate()
        server.on("GET /api/home", .gated(gate, 200, ShellFixture.homeJSON))
        let loading = Task { await model.refresh() }
        await eventually { !server.requests("GET /api/home").isEmpty }
        #expect(model.home == nil)
        server.on("PUT /api/me/locale", .json(200, ShellFixture.json(ShellFixture.user(locale: .en))))
        server.on("GET /api/me", .json(200, ShellFixture.json(ShellFixture.user(locale: .en))))
        server.on("GET /api/home", .json(200, ShellFixture.homeJSON))
        await model.setLocale(.en)
        gate.open()
        await loading.value
        await eventually { model.home != nil && !model.refreshing }
        #expect(model.locale == .en)
    }

    @Test("главная читает настоящую историю, ошибки, слабое место и неделю")
    func historyAndMistakes() async throws {
        let app = try app()
        let model = try #require(app.shell)
        var stats = ShellFixture.stats
        stats.lastTraining = .init(request: TrainingFixture.options.presets[0].request, size: 3)
        stats.mistakes = 2
        stats.sections[0] = .init(section: .verbal, total: 20, correct: 12)
        stats.weakSpot = .init(questionType: .textCompletion, section: .verbal, accuracy: 60)
        stats.week = .init(days: 3, answers: 20, minutes: 12)
        server.on("GET /api/home", .json(200, ShellFixture.json(stats)))
        await model.refresh()
        #expect(model.hasHistory)
        #expect(model.home?.stats == stats)
        #expect(model.startRequest?.count == 3)
        #expect(model.minutes(try #require(model.startRequest)) == 5)
        server.on("POST /api/trainings", .json(201, TrainingFixture.json(TrainingFixture.session)))
        let id = await model.start(mistakes: true)
        #expect(id == TrainingFixture.session.id)
        let body = try #require(server.requests("POST /api/trainings").first).json()
        #expect(body["source"] as? String == "mistakes")
        #expect(body["count"] as? Int == 2)
        #expect(body["topicIds"] == nil && body["difficulty"] == nil)
    }

    @Test("T2-history: начатая без ответов не придумывает точность и неделю")
    func historyWithoutAnswers() async throws {
        let app = try app()
        let model = try #require(app.shell)
        var stats = ShellFixture.stats
        stats.lastTraining = .init(request: TrainingFixture.options.presets[0].request, size: 3)
        server.on("GET /api/home", .json(200, ShellFixture.json(stats)))
        await model.refresh()
        #expect(model.startRequest?.count == 3)
        #expect(!model.hasHistory)
    }

    @Test("ошибки в другом разделе: пустой первый раздел не блокирует повторение")
    func mistakesInOtherSection() async throws {
        let app = try app()
        let model = try #require(app.shell)
        var stats = ShellFixture.stats
        stats.mistakes = 2
        server.on("GET /api/home", .json(200, ShellFixture.json(stats)))
        await model.refresh()
        var session = TrainingFixture.session
        session.section = .quant
        session.questionTypes = [.quantitativeComparison]
        server.on(
            "POST /api/trainings", .json(409, Fixture.error("no_questions")), .json(201, TrainingFixture.json(session)))
        #expect(await model.start(mistakes: true) == session.id)
        let requests = try server.requests("POST /api/trainings").map { try $0.json() }
        #expect(requests.count == 2)
        #expect(requests[0]["section"] as? String == "verbal")
        #expect(requests[1]["section"] as? String == "quant")
        #expect(requests.allSatisfy { $0["source"] as? String == "mistakes" })
    }

    @Test("кэш показывается сразу и сохраняется при ошибке обновления", arguments: [500, 0])
    func cachedHome(status: Int) async throws {
        let app = try app()
        let model = try #require(app.shell)
        await model.refresh()
        server.on(
            "GET /api/home", status == 0 ? .failure(.notConnectedToInternet) : .json(status, Fixture.error("internal")))
        await model.refresh()
        #expect(model.home != nil)
        #expect(model.problem == (status == 0 ? .offline : .failed))
        let restored = ShellModel(
            api: app.api, cache: cache, network: network, trainings: app.trainings, unauthorized: {},
            report: { _, _ in })
        #expect(restored.home == model.home)
        #expect(restored.startRequest?.exam == .gre)
        network.set(online: false)
        #expect(restored.staleProblem == .offline)
        #expect(await restored.start() == nil)
        #expect(restored.startProblem == .offline)
        network.set(online: true)
        server.on("GET /api/home", .json(200, ShellFixture.homeJSON))
        await model.networkChanged()
        #expect(model.problem == nil)
    }

    @Test("нет кэша: ошибка загрузки, повтор, первый старт")
    func emptyLoadAndRetry() async throws {
        let app = try app()
        let model = try #require(app.shell)
        server.on("GET /api/home", .failure(.notConnectedToInternet))
        await model.refresh()
        #expect(model.home == nil && model.problem == .offline)
        server.on("GET /api/home", .json(200, ShellFixture.homeJSON))
        await model.refresh()
        #expect(!model.hasHistory)
        #expect(model.startRequest?.questionTypes == [.textCompletion])
        #expect(model.types(in: .essay).isEmpty)
        server.on("POST /api/trainings", .failure(.notConnectedToInternet))
        #expect(await model.start() == nil)
        #expect(model.startProblem == .offline)
        server.on("POST /api/trainings", .json(500, Fixture.error("internal")))
        #expect(await model.start() == nil)
        #expect(model.startProblem == .failed)
        #expect(await model.start(mistakes: true) == nil)
    }

    @Test("поздняя главная прежнего экзамена не попадает в выбранный")
    func lateHome() async throws {
        let app = try app()
        let model = try #require(app.shell)
        let gate = StubServer.Gate()
        server.on("GET /api/home", .gated(gate, 200, ShellFixture.homeJSON))
        let refresh = Task { await model.refresh() }
        await eventually { !server.requests("GET /api/home").isEmpty }
        server.on("PUT /api/me/exam", .json(200, ShellFixture.json(ShellFixture.user(exam: .toefl))))
        server.on("GET /api/me", .json(200, ShellFixture.json(ShellFixture.user(exam: .toefl))))
        server.on("GET /api/home", .json(200, ShellFixture.homeJSON))
        #expect(await model.choose(.toefl))
        gate.open()
        await refresh.value
        await eventually { model.home != nil }
        #expect(model.exam == .toefl)
        #expect(cache.load()?.user?.activeExam == .toefl)
    }

    @Test("выход из профиля: сбой оставляет аккаунт, успех стирает данные", arguments: [200, 500, 0, 401])
    func signOut(status: Int) async throws {
        ShellFixture.stub(server)
        let tokens = MemoryTokenStore()
        let preferences = UserDefaults(suiteName: "logout-\(UUID().uuidString)")!
        let app = AppModel(
            config: server.config(), tokens: tokens, cache: cache, network: network, session: server.session,
            preferences: preferences)
        try app.didSignIn(.init(token: "t", user: ShellFixture.user()))
        let model = try #require(app.shell)
        await model.refresh()
        server.on("POST /api/trainings", .json(201, TrainingFixture.json(TrainingFixture.session)))
        #expect(await model.start() == TrainingFixture.session.id)
        #expect(FileManager.default.fileExists(atPath: cache.fileURL.path))
        #expect(preferences.string(forKey: InterfaceLocale.storageKey) == "ru")
        server.on(
            "POST /api/auth/logout",
            status == 0
                ? .failure(.notConnectedToInternet)
                : status == 200 ? .status(204) : .json(status, Fixture.error("internal")))
        await app.requestSignOut()
        #expect(app.phase == (status == 200 || status == 401 ? .signedOut(nil) : .signedIn))
        #expect(app.signOutProblem == (status == 0 ? .offline : status == 500 ? .failed : nil))
        #expect(!app.signingOut)
        if status == 200 || status == 401 {
            #expect(try tokens.token() == nil)
            #expect(!FileManager.default.fileExists(atPath: cache.fileURL.path))
            #expect(preferences.object(forKey: InterfaceLocale.storageKey) == nil)
            #expect(app.shell == nil && app.trainings.trainings.isEmpty)
            let directory = TrainingStore.live(beside: cache).directory
            await eventually { !FileManager.default.fileExists(atPath: directory.path) }
        } else {
            #expect(try tokens.token() == "t")
            #expect(cache.load() != nil && !app.trainings.trainings.isEmpty)
            #expect(preferences.string(forKey: InterfaceLocale.storageKey) == "ru")
        }
    }
}

/// Вместо реальных пауз тест сам разрешает продолжение восстановления; отмена проверяется после сигнала.
@MainActor
private final class RecoveryGate {
    var delays: [Duration] = []
    var completed = 0
    private var continuation: CheckedContinuation<Void, Never>?
    func sleep(_ duration: Duration) async throws {
        delays.append(duration)
        await withCheckedContinuation { continuation = $0 }
        completed += 1
        try Task.checkCancellation()
    }
    func advance() {
        continuation?.resume()
        continuation = nil
    }
}
