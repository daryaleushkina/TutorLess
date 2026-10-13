import Foundation
import Testing

@testable import GrePrep

@Suite("Оболочка: сервер получает только поддерживаемые задания")
struct ShellCapabilityTests {
    @Test("каталог ограничен четырьмя типами и объявляет формы ответов")
    func supportedTrainingTypes() async throws {
        let server = StubServer()
        let json = String(decoding: try JSONEncoder().encode(TrainingFixture.options), as: UTF8.self)
        server.on("GET /api/trainings/options", .json(200, json))
        let api = API(config: server.config(), session: server.session, tokens: MemoryTokenStore("t"))
        _ = try await api.trainingOptions()
        let request = try #require(server.requests("GET /api/trainings/options").first)
        let query = URLComponents(string: "https://example.test/?" + (request.query ?? ""))
        let types =
            query?.queryItems?.filter { $0.name == "types" }.compactMap(\.value)
            .flatMap { $0.split(separator: ",").map(String.init) } ?? []
        #expect(
            Set(types)
                == Set(["text_completion", "sentence_equivalence", "multiple_choice", "quantitative_comparison"]))
        let capabilities = request.headers.first { $0.key.lowercased() == "x-training-capabilities" }?.value
        #expect(capabilities == "text_completion,sentence_equivalence,multiple_choice,quantitative_comparison")
    }
}
