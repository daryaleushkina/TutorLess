import Foundation
import GPAPI

@testable import GrePrep

enum ShellFixture {
    static let homeJSON =
        #"{"sections":[{"section":"verbal","total":0,"correct":0},{"section":"quant","total":0,"correct":0},{"section":"essay","total":0,"correct":0}],"mistakes":0,"week":{"days":0,"answers":0,"minutes":0}}"#
    static let examsJSON =
        #"{"exams":[{"id":"gre","sections":["verbal","quant","essay"]},{"id":"toefl","sections":["reading","listening","writing","speaking"]}]}"#
    static func user(exam: Exam? = .gre, locale: Components.Schemas.Locale = .ru) -> UserDTO {
        var user = Fixture.user
        user.name = "Алина Карпова"
        user.locale = locale
        user.activeExam = exam.flatMap { .init(rawValue: $0.rawValue) }
        user.identities = [.init(provider: .apple, linkedAt: Date(timeIntervalSince1970: 1_700_000_000))]
        return user
    }
    static func json<T: Encodable>(_ value: T) -> String {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return String(decoding: try! encoder.encode(value), as: UTF8.self)
    }
    static var stats: HomeDTO { try! JSONDecoder().decode(HomeDTO.self, from: Data(homeJSON.utf8)) }
    static var exams: [ExamInfo] {
        [
            .init(id: .gre, sections: [.verbal, .quant, .essay]),
            .init(id: .toefl, sections: [.reading, .listening, .writing, .speaking]),
        ]
    }
    static var snapshot: ShellSnapshot {
        .init(user: user(), exams: exams, homes: ["gre": .init(stats: stats, options: TrainingFixture.options)])
    }
    static func stub(
        _ server: StubServer, user: UserDTO = user(), stats: HomeDTO = stats,
        options: TrainingOptions = TrainingFixture.options
    ) {
        server.on("GET /api/me", .json(200, json(user)))
        server.on("GET /api/exams", .json(200, examsJSON))
        server.on("GET /api/home", .json(200, json(stats)))
        server.on("GET /api/trainings/options", .json(200, json(options)))
        server.on("POST /api/client-errors", .status(204))
    }
}

@MainActor
extension AppModel {
    /// У каждого теста свои настройки: параллельная смена языка не меняет форматирование соседнего теста.
    convenience init(
        config: AppConfig, tokens: any TokenStore, cache: ShellCache, network: NetworkMonitor,
        session: URLSession = API.session
    ) {
        self.init(
            config: config, tokens: tokens, cache: cache, network: network, session: session,
            preferences: UserDefaults(suiteName: "shell-tests-\(UUID().uuidString)")!)
    }
}
