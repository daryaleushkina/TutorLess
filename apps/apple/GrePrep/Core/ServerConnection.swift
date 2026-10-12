import Observation

/// Связь подтверждает успешный запрос данных, а не один только путь NWPathMonitor.
@MainActor
@Observable
final class ServerConnection {
    private(set) var revision = 0
    nonisolated init() {}
    func succeeded() { revision += 1 }
}
