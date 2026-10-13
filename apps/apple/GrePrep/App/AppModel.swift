import Foundation
import Observation

/// Корень состояния: вошёл человек или нет, и общие на всё приложение части (сеть, сервер, Keychain).
@MainActor
@Observable
final class AppModel {
    enum Phase: Equatable {
        case signedOut(SignOutReason?)
        case signedIn
    }

    /// Почему человек снова на экране входа — чтобы не гадал, куда делся вход.
    enum SignOutReason: Equatable {
        case sessionExpired
    }

    private(set) var phase: Phase
    /// Экран оболочки живёт, пока человек вошёл: выход сбрасывает его вместе с данными.
    private(set) var shell: ShellModel?
    private(set) var signingOut = false
    private(set) var signOutProblem: ShellModel.Problem?

    let api: API
    let config: AppConfig
    let network: NetworkMonitor
    let trainings: TrainingModel
    @ObservationIgnored private let tokens: any TokenStore
    @ObservationIgnored private let cache: ShellCache
    @ObservationIgnored private let preferences: UserDefaults
    @ObservationIgnored private let makeAPI: @Sendable (_ token: String) -> API
    @ObservationIgnored private var tokenReadFailed = false

    init(
        config: AppConfig,
        tokens: any TokenStore,
        cache: ShellCache,
        network: NetworkMonitor,
        session: URLSession = API.session,
        preferences: UserDefaults = .standard
    ) {
        // Токен — в памяти поверх Keychain: запросов много, а каждое чтение Keychain — обращение к системе.
        let tokens = CachedTokenStore(tokens)
        self.config = config
        self.tokens = tokens
        self.cache = cache
        self.preferences = preferences
        self.network = network
        let api = API(config: config, session: session, tokens: tokens)
        self.api = api
        makeAPI = { token in
            API(config: config, session: session, tokens: MemoryTokenStore(token), connection: api.connection)
        }
        trainings = TrainingModel(
            store: TrainingStore.live(beside: cache),
            report: { message, requestID in
                Task { await api.reportClientError(message: message, route: "training", requestID: requestID) }
            }, unauthorized: {})
        phase = .signedOut(nil)

        trainings.onUnauthorized = { [weak self] in self?.handleUnauthorized() }

        restoreSession()
    }

    /// Вход живёт в Keychain: открыл приложение — сразу оболочки, без ожидания сети. Протух — первый же
    /// запрос ответит 401 и вернёт на вход (handleUnauthorized).
    private func restoreSession() {
        do {
            tokenReadFailed = false
            if let token = try tokens.token(), !token.isEmpty {
                becomeSignedIn()
                trainings.connect(api: makeAPI(token), ownerID: nil, credentialID: TrainingStore.credentialID(token))
            }
        } catch {
            tokenReadFailed = true
            report("keychain read failed: \(error)", route: "launch")
        }
    }

    static func live() -> AppModel {
        let tokens = KeychainTokenStore.live()
        FreshInstall.forgetPreviousSession(tokens: tokens)
        return AppModel(config: .load(), tokens: tokens, cache: .live(), network: .live())
    }

    #if DEBUG
        /// Чистое устройство для сценариев UI (аргумент запуска -GPResetState, только отладочная сборка).
        static func resetLocalState() {
            UserDefaults.standard.removeObject(forKey: AppTheme.storageKey)
            UserDefaults.standard.removeObject(forKey: TextSizePreference.storageKey)
            UserDefaults.standard.removeObject(forKey: InterfaceLocale.storageKey)
            // Необязательный фон: стереть то, чего может и не быть.
            _ = try? KeychainTokenStore.live().clear()
            _ = try? ShellCache.live().clear()
            _ = try? TrainingStore.live().clear()
        }
    #endif

    /// Вход прошёл: токен — в Keychain, данные прошлого человека — прочь.
    func didSignIn(_ signedIn: SignedIn) throws {
        try tokens.save(signedIn.token)
        do {
            try cache.clear()
        } catch {
            let error = error as NSError
            report("shell cache clear failed: \(error.domain) \(error.code)", route: "sign-in")
        }
        becomeSignedIn(user: signedIn.user)
        trainings.connect(
            api: makeAPI(signedIn.token), ownerID: signedIn.user.id,
            credentialID: TrainingStore.credentialID(signedIn.token))
    }

    /// Нажатие в профиле подтверждается сервером: при сбое человек остаётся на прежнем экране.
    func requestSignOut() async {
        guard phase == .signedIn, !signingOut else { return }
        signingOut = true
        signOutProblem = nil
        let currentShell = shell
        defer { signingOut = false }
        do {
            try await api.signOut()
            guard shell === currentShell else { return }
            forgetSession(reason: nil)
        } catch {
            guard shell === currentShell else { return }
            if error == .unauthorized {
                forgetSession(reason: nil)
            } else {
                signOutProblem = error == .offline ? .offline : .failed
                if error != .offline {
                    report("sign-out failed: \(error)", route: "sign-out", requestID: error.requestID)
                }
            }
        }
    }

    /// Keychain не ответил при запуске (например, iOS запустила приложение заранее, до первой разблокировки):
    /// когда его откроют, вход читается ещё раз, а не теряется до перезапуска.
    func retrySessionIfNeeded() {
        guard tokenReadFailed, phase == .signedOut(nil) else { return }
        restoreSession()
    }

    /// Сервер ответил 401: сессии больше нет (истекла или вышли на другом устройстве).
    func handleUnauthorized() {
        forgetSession(reason: .sessionExpired)
    }

    /// Ошибка на устройстве — на сервер, в client_errors, не задерживая экран.
    func report(_ message: String, route: String, requestID: String? = nil) {
        let api = api
        Task { await api.reportClientError(message: message, route: route, requestID: requestID) }
    }

    private func becomeSignedIn(user: UserDTO? = nil) {
        shell?.retire()
        shell = ShellModel(
            api: api, cache: cache, network: network, trainings: trainings, user: user, preferences: preferences,
            unauthorized: { [weak self] in self?.handleUnauthorized() },
            report: { [weak self] message, requestID in self?.report(message, route: "shell", requestID: requestID) })
        phase = .signedIn
    }

    private func forgetSession(reason: SignOutReason?) {
        // 401 оставляет ответы до следующего входа; явный выход стирает их (решение Даши 08.10.2026).
        trainings.disconnect(clear: reason != .sessionExpired)
        shell?.retire()
        do {
            try tokens.clear()
        } catch {
            report("keychain clear failed: \(error)", route: "sign-out")
            // Не стёрлось — затереть пустым: пустой токен — это «не вошёл» (restoreSession), и вход не вернётся
            // при следующем запуске. Не вышло и это — отчёт уже ушёл, больше сделать нечего.
            _ = try? tokens.save("")
        }
        do {
            try cache.clear()
        } catch {
            let error = error as NSError
            report("shell cache clear failed: \(error.domain) \(error.code)", route: "sign-out")
        }
        shell = nil
        preferences.removeObject(forKey: InterfaceLocale.storageKey)
        phase = .signedOut(reason)
    }
}
