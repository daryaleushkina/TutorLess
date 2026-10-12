import Foundation
import GPAPI
import OSLog

typealias UserDTO = Components.Schemas.User
typealias Exam = Components.Schemas.Exam
typealias ExamInfo = Components.Schemas.ExamInfo
typealias HomeDTO = Components.Schemas.Home

/// Успешный вход: токен уходит в Keychain, пользователь — на экран.
struct SignedIn: Sendable, Equatable {
    let token: String
    let user: UserDTO
}

/// Запросы приложения к серверу. Каждый метод отвечает либо данными, либо APIFailure — экран не видит
/// ни HTTP, ни генератора.
struct API: Sendable {
    private let client: Client
    private let clientKind: Components.Schemas.ClientKind
    private let appVersion: String
    let connection: ServerConnection

    init(
        config: AppConfig, session: URLSession = API.session, tokens: any TokenStore,
        connection: ServerConnection = ServerConnection()
    ) {
        self.connection = connection
        client = GPAPIClient.make(
            baseURL: config.apiBaseURL, session: Self.withCapabilities(session),
            token: {
                // Ошибка Keychain уже сообщается корнем; отсутствие токена сервер подтвердит ответом 401.
                try? tokens.token()
            })
        clientKind = config.clientKind == .macos ? .macos : .ios
        appVersion = config.appVersion
    }

    /// Свой URLSession: без кук и кэша (токен — только в заголовке), каждый запрос — со сроком
    /// (AGENTS.md, «Многопоточность»). Ждать сеть не нужно: экран сам покажет «Нет сети» и повторит.
    static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 30
        configuration.waitsForConnectivity = false
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        configuration.httpAdditionalHeaders = [Self.capabilitiesHeader: Self.capabilities]
        return URLSession(configuration: configuration)
    }()

    // MARK: - Вход

    #if DEBUG
        /// Вход подменой (`/api/auth/dev`) — только отладочная сборка: в релизе этого кода нет, а сервер в бою
        /// отвечает на путь 404.
        func signInForDevelopment(name: String, locale: Components.Schemas.Locale = .ru) async throws(APIFailure)
            -> SignedIn
        {
            let output = try await call {
                try await client.signInForDevelopment(
                    body: .json(.init(name: name, transport: .bearer, clientKind: clientKind, locale: locale)))
            }
            switch output {
            case let .ok(ok):
                guard case let .json(session) = ok.body else { throw .unexpected("dev sign-in: unexpected body") }
                return try signedIn(session)
            case let .default(status, error):
                throw failure(status, error)
            }
        }
    #endif

    func signInWithIdToken(
        provider: Components.Schemas.IdentityProvider,
        idToken: String,
        nonce: String,
        displayName: String?,
        locale: Components.Schemas.Locale = .ru
    ) async throws(APIFailure) -> SignedIn {
        let body = Components.Schemas.IdTokenSignIn(
            provider: provider, idToken: idToken, nonce: nonce, displayName: displayName,
            transport: .bearer, clientKind: clientKind, locale: locale
        )
        let output = try await call { try await client.signInWithIdToken(body: .json(body)) }
        switch output {
        case let .ok(ok):
            guard case let .json(session) = ok.body else { throw .unexpected("id token sign-in: unexpected body") }
            return try signedIn(session)
        case let .default(status, error):
            throw failure(status, error)
        }
    }

    func signInWithAuthorizationCode(
        provider: Components.Schemas.IdentityProvider,
        code: String,
        codeVerifier: String,
        redirectURI: String,
        nonce: String,
        locale: Components.Schemas.Locale = .ru
    ) async throws(APIFailure) -> SignedIn {
        let body = Components.Schemas.AuthorizationCodeSignIn(
            provider: provider, code: code, codeVerifier: codeVerifier, redirectUri: redirectURI, nonce: nonce,
            transport: .bearer, clientKind: clientKind, locale: locale
        )
        let output = try await call { try await client.signInWithAuthorizationCode(body: .json(body)) }
        switch output {
        case let .ok(ok):
            guard case let .json(session) = ok.body else { throw .unexpected("code sign-in: unexpected body") }
            return try signedIn(session)
        case let .default(status, error):
            throw failure(status, error)
        }
    }

    func signOut() async throws(APIFailure) {
        let output = try await call { try await client.signOut() }
        switch output {
        case .noContent:
            return
        case let .default(status, error):
            throw failure(status, error)
        }
    }

    // MARK: - Данные

    func me() async throws(APIFailure) -> UserDTO {
        let output = try await call { try await client.getMe() }
        switch output {
        case let .ok(ok):
            guard case let .json(value) = ok.body else { throw .unexpected("training: unexpected body") }
            return await confirmed(value)
        case let .default(status, error): throw failure(status, error)
        }
    }

    func trainingOptions(exam: Exam = .gre) async throws(APIFailure) -> TrainingOptions {
        let output = try await call {
            try await client.getTrainingOptions(
                query: .init(exam: exam, types: Self.trainingTypes))
        }
        switch output {
        case let .ok(ok):
            guard case let .json(value) = ok.body else { throw .unexpected("training: unexpected body") }
            return await confirmed(value)
        case let .default(status, error): throw failure(status, error)
        }
    }

    func startTraining(_ request: TrainingRequest) async throws(APIFailure) -> TrainingSession {
        let output = try await call { try await client.startTraining(body: .json(request)) }
        switch output {
        case let .created(created):
            guard case let .json(value) = created.body else { throw .unexpected("training: unexpected body") }
            return await confirmed(value)
        case let .default(status, error): throw failure(status, error)
        }
    }

    func trainingAnswers(_ id: String, answers: [GivenAnswer]) async throws(APIFailure) {
        let output = try await call {
            try await client.submitTrainingAnswers(path: .init(trainingId: id), body: .json(.init(answers: answers)))
        }
        switch output {
        case .noContent:
            await connection.succeeded()
            return
        case let .default(status, error): throw failure(status, error)
        }
    }

    func trainingFinish(_ id: String, finish: TrainingFinish) async throws(APIFailure) {
        let output = try await call {
            try await client.finishTraining(path: .init(trainingId: id), body: .json(finish))
        }
        switch output {
        case .ok:
            await connection.succeeded()
            return
        case let .default(status, error): throw failure(status, error)
        }
    }

    func reportQuestion(_ id: String, report: QuestionReport) async throws(APIFailure) {
        let output = try await call {
            try await client.reportQuestion(path: .init(questionId: id), body: .json(report))
        }
        switch output {
        case .noContent:
            await connection.succeeded()
            return
        case let .default(status, error): throw failure(status, error)
        }
    }

    func exams() async throws(APIFailure) -> [ExamInfo] {
        let output = try await call { try await client.getExams() }
        switch output {
        case let .ok(ok):
            guard case let .json(value) = ok.body else { throw .unexpected("exams: unexpected body") }
            return await confirmed(value.exams)
        case let .default(status, error): throw failure(status, error)
        }
    }

    func home(exam: Exam) async throws(APIFailure) -> HomeDTO {
        let output = try await call {
            try await client.getHome(
                query: .init(exam: exam, tz: TimeZone.current.identifier, types: Self.trainingTypes))
        }
        switch output {
        case let .ok(ok):
            guard case let .json(value) = ok.body else { throw .unexpected("home: unexpected body") }
            return await confirmed(value)
        case let .default(status, error): throw failure(status, error)
        }
    }

    func setExam(_ exam: Exam) async throws(APIFailure) -> UserDTO {
        let output = try await call { try await client.setActiveExam(body: .json(.init(exam: exam))) }
        switch output {
        case let .ok(ok):
            guard case let .json(value) = ok.body else { throw .unexpected("exam: unexpected body") }
            return await confirmed(value)
        case let .default(status, error): throw failure(status, error)
        }
    }

    func setLocale(_ locale: Components.Schemas.Locale) async throws(APIFailure) -> UserDTO {
        let output = try await call { try await client.setLocale(body: .json(.init(locale: locale))) }
        switch output {
        case let .ok(ok):
            guard case let .json(value) = ok.body else { throw .unexpected("locale: unexpected body") }
            return await confirmed(value)
        case let .default(status, error): throw failure(status, error)
        }
    }

    // Полный список клиента, а не allCases договора: новые формы появятся в части 3 (решение Даши 12.10.2026).
    static let trainingTypes: [Components.Schemas.QuestionType] = [
        .textCompletion, .sentenceEquivalence, .multipleChoice, .quantitativeComparison,
    ]

    /// Ошибка на устройстве — в таблицу client_errors. Не бросает: отчёт об ошибке не должен сам стать ошибкой
    /// на экране; не дошёл — значит, нет сети, и сообщить всё равно некуда.
    func reportClientError(message: String, route: String, requestID: String?) async {
        let body = Components.Schemas.ClientError(
            message: Self.prefix(message, 2000),
            route: Self.prefix(route, 512),
            requestId: requestID.map { Self.prefix($0, 64) },
            clientKind: clientKind,
            appVersion: appVersion,
            occurredAt: Date()
        )
        do {
            if case .noContent = try await client.reportClientError(body: .json(body)) { return }
            Self.log.error("client error report rejected by server")
        } catch {
            // Без сети отчёт не дойдёт — это ожидаемо; в системный журнал, чтобы сломанный канал было видно.
            Self.log.error("client error report failed: \(String(describing: APIFailure(error)), privacy: .public)")
        }
    }

    private static let log = Logger(subsystem: "dev.greprepapp.app", category: "client-errors")

    /// Обрезка по кодовым точкам: сервер (ogen) считает длину строки так, а не по графемам — иначе флаг или
    /// эмодзи из нескольких точек сделали бы отчёт длиннее предела, и сервер отклонил бы его.
    static func prefix(_ text: String, _ limit: Int) -> String {
        String(String.UnicodeScalarView(text.unicodeScalars.prefix(limit)))
    }

    private static let capabilitiesHeader = "X-Training-Capabilities"
    private static var capabilities: String { trainingTypes.map(\.rawValue).joined(separator: ",") }

    /// В приложении общая сессия уже имеет заголовок; переданный тестовый/специальный транспорт сохраняет
    /// свою конфигурацию. Bearer ставится единственным GPAPIClient.make, возможности — URLSession.
    private static func withCapabilities(_ session: URLSession) -> URLSession {
        let configuration = session.configuration
        if configuration.httpAdditionalHeaders?[capabilitiesHeader] as? String == capabilities { return session }
        var headers = configuration.httpAdditionalHeaders ?? [:]
        headers[capabilitiesHeader] = capabilities
        configuration.httpAdditionalHeaders = headers
        return URLSession(
            configuration: configuration, delegate: session.delegate, delegateQueue: session.delegateQueue)
    }

    private func confirmed<T: Sendable>(_ value: T) async -> T {
        await connection.succeeded()
        return value
    }

    // MARK: - Разбор

    private func call<T>(_ request: () async throws -> T) async throws(APIFailure) -> T {
        do {
            return try await request()
        } catch {
            throw APIFailure(error)
        }
    }

    private func signedIn(_ session: Components.Schemas.Session) throws(APIFailure) -> SignedIn {
        // transport=bearer обязан вернуть токен в теле; нет его — сервер нарушил договор.
        guard let token = session.token, !token.isEmpty else {
            throw .unexpected("session without token for bearer transport")
        }
        return SignedIn(token: token, user: session.user)
    }

    private func failure(_ status: Int, _ response: Components.Responses._Error) -> APIFailure {
        guard case let .json(error) = response.body else {
            return .response(status: status, code: nil, requestID: nil)
        }
        return .response(status: status, code: error.code, requestID: error.requestId)
    }
}
