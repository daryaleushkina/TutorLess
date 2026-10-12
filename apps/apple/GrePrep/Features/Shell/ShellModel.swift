import Foundation
import GPAPI
import Observation

/// Живёт весь вход; поколения не позволяют позднему ответу вернуть прежний экзамен или аккаунт.
@MainActor
@Observable
final class ShellModel {
    enum Problem: Equatable { case offline, failed }
    enum StartAction { case primary, mistakes }
    typealias RecoverySleep = @Sendable (Duration) async throws -> Void
    nonisolated static let recoverySleep: RecoverySleep = { try await Task.sleep(for: $0) }
    private(set) var snapshot: ShellSnapshot {
        didSet { preferences.set(snapshot.user?.locale.rawValue, forKey: InterfaceLocale.storageKey) }
    }
    private(set) var refreshing = false
    private var connectionProblem: Problem?
    private var problemRevision = 0
    private(set) var problem: Problem? {
        get { api.connection.revision == problemRevision ? connectionProblem : nil }
        set {
            connectionProblem = newValue
            problemRevision = api.connection.revision
            if newValue == .offline { scheduleRecovery() }
            if newValue == nil { stopRecovery() }
        }
    }
    private(set) var choosing: Exam?
    private(set) var examProblem: Problem?
    private(set) var changingLocale = false
    private(set) var localeProblem: Problem?
    private(set) var startingAction: StartAction?
    var starting: Bool { startingAction != nil }
    private var actionProblem: Problem?
    private var startProblemRevision = 0
    private(set) var startProblemAction: StartAction?
    private(set) var startProblem: Problem? {
        get {
            actionProblem == .offline && api.connection.revision != startProblemRevision ? nil : actionProblem
        }
        set {
            actionProblem = newValue
            startProblemRevision = api.connection.revision
        }
    }
    @ObservationIgnored private let api: API
    @ObservationIgnored private let cache: ShellCache
    @ObservationIgnored private let preferences: UserDefaults
    @ObservationIgnored private let network: NetworkMonitor
    @ObservationIgnored private let trainings: TrainingModel
    @ObservationIgnored private let unauthorized: () -> Void
    @ObservationIgnored private let report: (String, String?) -> Void
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var retired = false
    @ObservationIgnored private var refreshAgain = false
    @ObservationIgnored private var recoveryTask: Task<Void, Never>?
    @ObservationIgnored private let sleep: RecoverySleep
    @ObservationIgnored private var recoverySeconds = 2

    init(
        api: API, cache: ShellCache, network: NetworkMonitor, trainings: TrainingModel, user: UserDTO? = nil,
        preferences: UserDefaults = .standard,
        recoverySleep: @escaping RecoverySleep = ShellModel.recoverySleep,
        unauthorized: @escaping () -> Void, report: @escaping (String, String?) -> Void
    ) {
        self.api = api
        sleep = recoverySleep
        self.cache = cache
        self.preferences = preferences
        self.network = network
        self.trainings = trainings
        self.unauthorized = unauthorized
        self.report = report
        snapshot = cache.load() ?? ShellSnapshot()
        if let user {
            if snapshot.user?.id != user.id { snapshot.homes = [:] }
            snapshot.user = user
        }
        preferences.set(snapshot.user?.locale.rawValue, forKey: InterfaceLocale.storageKey)
        trainings.exam = exam
    }

    var user: UserDTO? { snapshot.user }
    var exams: [ExamInfo] { snapshot.exams }
    var exam: Exam? { user?.activeExam.flatMap { Exam(rawValue: $0.rawValue) } }
    var locale: Components.Schemas.Locale { user?.locale ?? InterfaceLocale.preferredLanguage }
    var home: HomeContent? { exam.flatMap { snapshot.homes[$0.rawValue] } }
    var sections: [Components.Schemas.Section] { exams.first { $0.id == exam }?.sections ?? [] }
    var staleProblem: Problem? { !network.isOnline ? .offline : problem }
    var hasHistory: Bool {
        guard let stats = home?.stats else { return false }
        return stats.sections.contains { $0.total > 0 } || stats.mistakes > 0 || stats.week.answers > 0
    }
    var activeTraining: StoredTraining? {
        trainings.trainings.values.filter {
            // До появления выбора все сохранённые сессии относились к GRE; поле exam в них отсутствует.
            ($0.session.exam ?? .gre) == exam && !$0.isFinished
                && TrainingRules.remainingSeconds(
                    $0, nowMillis: Int64(trainings.currentDate.timeIntervalSince1970 * 1000)) != 0
        }.max { $0.startedAtMillis < $1.startedAtMillis }
    }
    func types(in section: Components.Schemas.Section) -> [Components.Schemas.TrainingType] {
        home?.options.types.filter {
            $0.section == section
                && $0.topics.contains { $0.available.easy + $0.available.medium + $0.available.hard > 0 }
        } ?? []
    }
    var startRequest: TrainingRequest? {
        guard let exam, let content = home else { return nil }
        if let last = content.stats.lastTraining {
            var request = last.request
            request.count = last.size
            return request
        }
        guard
            let type = content.options.types.first(where: {
                $0.topics.contains { $0.available.easy + $0.available.medium + $0.available.hard > 0 }
            })
        else { return nil }
        let available = type.topics.reduce(0) { $0 + $1.available.easy + $1.available.medium + $1.available.hard }
        guard available > 0 else { return nil }
        return .init(
            exam: exam, section: type.section, questionTypes: [type.questionType],
            count: min(10, available, content.options.maxQuestions), mode: .practice)
    }
    func minutes(_ request: TrainingRequest) -> Int {
        let pace = home?.options.types.first { request.questionTypes.contains($0.questionType) }?.paceSeconds ?? 0
        return Int(ceil(Double(request.count * pace) / 60))
    }

    func refresh() async {
        guard !retired, choosing == nil, !changingLocale else { return }
        if refreshing {
            refreshAgain = true
            return
        }
        refreshing = true
        refreshAgain = false
        let epoch = generation
        defer {
            if generation == epoch {
                refreshing = false
                if refreshAgain { Task { await refresh() } }
            }
        }
        do {
            guard network.isOnline else { throw APIFailure.offline }
            async let account = api.me()
            async let catalog = api.exams()
            let (user, exams) = try await (account, catalog)
            guard current(epoch) else { return }
            if snapshot.user?.id != user.id { snapshot.homes = [:] }
            snapshot.user = user
            snapshot.exams = exams
            trainings.exam = exam
            persist()
            if let exam { try await loadHome(exam: exam, epoch: epoch) }
            guard current(epoch) else { return }
            problem = nil
        } catch {
            guard current(epoch) else { return }
            problem = handle(APIFailure(error), route: "home")
        }
    }

    func choose(_ selected: Exam) async -> Bool {
        guard !retired, choosing == nil, !changingLocale, exams.contains(where: { $0.id == selected }) else {
            return false
        }
        if selected == exam { return true }
        generation += 1
        let epoch = generation
        refreshing = false
        startingAction = nil
        refreshAgain = false
        choosing = selected
        examProblem = nil
        defer { if current(epoch) { choosing = nil } }
        do {
            guard network.isOnline else { throw APIFailure.offline }
            let user = try await api.setExam(selected)
            guard current(epoch) else { return false }
            guard user.activeExam?.rawValue == selected.rawValue else {
                throw APIFailure.unexpected("exam choice not saved")
            }
            snapshot.user = user
            trainings.exam = selected
            problem = nil
            persist()
            // Выбор завершён сразу после PUT; загрузка главной не удерживает шторку.
            Task { await refresh() }
            return true
        } catch {
            guard current(epoch) else { return false }
            examProblem = handle(APIFailure(error), route: "exam")
            return false
        }
    }

    func setLocale(_ selected: Components.Schemas.Locale) async {
        guard !retired, !changingLocale, choosing == nil, var user, selected != user.locale else { return }
        let wasRefreshing = refreshing
        generation += 1
        refreshing = false
        startingAction = nil
        let previous = user.locale
        let epoch = generation
        changingLocale = true
        localeProblem = nil
        user.locale = selected
        snapshot.user = user
        defer {
            if current(epoch) {
                changingLocale = false
                // Перезапускается только прерванная загрузка; смена языка не требует повторного каталога.
                if wasRefreshing { Task { await refresh() } }
            }
        }
        do {
            guard network.isOnline else { throw APIFailure.offline }
            let saved = try await api.setLocale(selected)
            guard current(epoch) else { return }
            guard saved.locale == selected else { throw APIFailure.unexpected("locale choice not saved") }
            snapshot.user = saved
            problem = nil
            persist()
        } catch {
            guard current(epoch) else { return }
            snapshot.user?.locale = previous
            localeProblem = handle(APIFailure(error), route: "locale")
        }
    }

    func start(mistakes: Bool = false) async -> String? {
        guard !retired, !starting, var request = startRequest else { return nil }
        if mistakes {
            guard let home, home.stats.mistakes > 0 else { return nil }
            request.source = .mistakes
            request.questionTypes = API.trainingTypes.filter { type in
                home.options.types.contains { $0.section == request.section && $0.questionType == type }
            }
            request.topicIds = nil
            request.difficulty = nil
            request.count = min(home.stats.mistakes, home.options.maxQuestions)
            request.mode = .practice
        }
        let epoch = generation
        startingAction = mistakes ? .mistakes : .primary
        startProblemAction = startingAction
        startProblem = nil
        defer { if current(epoch) { startingAction = nil } }
        do {
            guard network.isOnline else { throw APIFailure.offline }
            if connectionProblem == .offline {
                await refresh()
                guard current(epoch) else { return nil }
            }
            let candidateSections =
                mistakes
                ? [request.section] + sections.filter { $0 != request.section && !types(in: $0).isEmpty }
                : [request.section]
            for (index, section) in candidateSections.enumerated() {
                guard current(epoch) else { return nil }
                request.section = section
                if mistakes { request.questionTypes = types(in: section).map(\.questionType) }
                do {
                    let id = try await trainings.start(request)
                    guard current(epoch) else { return nil }
                    problem = nil
                    startProblem = nil
                    return id
                } catch {
                    // Сессия содержит один раздел; ошибки могут быть в другом, чем последняя тренировка.
                    if mistakes, case let .server(_, code, _) = error, code == "no_questions",
                        index + 1 < candidateSections.count
                    {
                        continue
                    }
                    throw error
                }
            }
            return nil
        } catch {
            guard current(epoch) else { return nil }
            startProblem = handle(APIFailure(error), route: "training-start")
            return nil
        }
    }

    func networkChanged() async {
        stopRecovery()
        if network.isOnline {
            startProblem = nil
            await refresh()
        }
    }
    func clearExamProblem() { examProblem = nil }
    func clearLocaleProblem() { localeProblem = nil }

    private func stopRecovery() {
        recoveryTask?.cancel()
        recoveryTask = nil
        recoverySeconds = 2
    }
    private func scheduleRecovery() {
        guard !retired, network.isOnline, recoveryTask == nil else { return }
        let seconds = recoverySeconds
        recoverySeconds = min(seconds * 2, 30)
        let sleep = sleep
        recoveryTask = Task { [weak self] in
            do { try await sleep(.seconds(seconds)) } catch is CancellationError {
                return
            } catch {
                self?.report("shell recovery delay failed: \(error)", nil)
                return
            }
            guard !Task.isCancelled, let self else { return }
            self.recoveryTask = nil
            guard self.network.isOnline, self.connectionProblem == .offline, !self.retired else { return }
            await self.refresh()
        }
    }
    func retire() {
        stopRecovery()
        retired = true
        generation += 1
    }

    private func current(_ epoch: Int) -> Bool { !retired && generation == epoch }
    private func loadHome(exam: Exam, epoch: Int) async throws {
        async let stats = api.home(exam: exam)
        async let options = api.trainingOptions(exam: exam)
        let content = try await HomeContent(stats: stats, options: options)
        guard current(epoch), self.exam == exam else { return }
        snapshot.homes[exam.rawValue] = content
        persist()
    }
    private func persist() {
        do { try cache.save(snapshot) } catch { report("shell cache save failed: \(TrainingStore.reason(error))", nil) }
    }
    private func handle(_ error: APIFailure, route: String) -> Problem? {
        if error == .cancelled { return nil }
        if error == .unauthorized {
            unauthorized()
            return nil
        }
        if error == .offline {
            problem = .offline
            return .offline
        }
        report("\(route) failed: \(error)", error.requestID)
        return .failed
    }
}
