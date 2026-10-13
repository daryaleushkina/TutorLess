import Foundation

struct HomeContent: Codable, Equatable, Sendable {
    let stats: HomeDTO
    let options: TrainingOptions
}

/// Только метаданные: аккаунт, каталог и статистика. Платные задания остаются в отдельном хранилище тренировок.
struct ShellSnapshot: Codable, Equatable, Sendable {
    var user: UserDTO?
    var exams: [ExamInfo] = []
    var homes: [String: HomeContent] = [:]
}

struct ShellCache: Sendable {
    let fileURL: URL

    static func live() -> ShellCache {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let folder = Bundle.main.bundleIdentifier ?? "dev.greprepapp.app"
        return ShellCache(fileURL: base.appending(path: folder).appending(path: "shell.json"))
    }

    func load() -> ShellSnapshot? {
        // Необязательный кэш: повреждённое или отсутствующее прочитаем заново с сервера.
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        do { return try JSONDecoder().decode(ShellSnapshot.self, from: data) } catch {
            // Испорченный файл не используется даже если его не удалось удалить.
            _ = try? clear()
            return nil
        }
    }

    func save(_ snapshot: ShellSnapshot) throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(snapshot)
        #if os(iOS)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
            try data.write(to: fileURL, options: .atomic)
        #endif
    }

    func clear() throws {
        do { try FileManager.default.removeItem(at: fileURL) } catch CocoaError.fileNoSuchFile { return }
    }
}
