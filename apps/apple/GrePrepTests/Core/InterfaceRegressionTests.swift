import CoreText
import SwiftUI
import Testing

@testable import GrePrep

#if os(iOS)
    import UIKit
#else
    import AppKit
#endif

@MainActor
@Suite("Регрессии основы интерфейса", .serialized)
struct InterfaceRegressionTests {
    @Test(
        "установленное семейство не считается сбоем регистрации",
        arguments: [
            CTFontManagerError.alreadyRegistered.rawValue, CTFontManagerError.duplicatedName.rawValue,
        ])
    func availableFont(code: CFIndex) {
        #expect(Fonts.isAlreadyAvailable(code))
    }

    @Test(
        "неизвестная ошибка шрифта требует диагностики",
        arguments: [
            CTFontManagerError.invalidFontData.rawValue, CTFontManagerError.fileNotFound.rawValue, -1,
        ])
    func invalidFont(code: CFIndex) {
        #expect(!Fonts.isAlreadyAvailable(code))
    }

    #if DEBUG
        @Test("сброс устройства стирает сохранённую тему")
        func resetTheme() {
            let defaults = UserDefaults.standard
            let previous = defaults.object(forKey: AppTheme.storageKey)
            defer {
                if let previous {
                    defaults.set(previous, forKey: AppTheme.storageKey)
                } else {
                    defaults.removeObject(forKey: AppTheme.storageKey)
                }
            }
            defaults.set("light", forKey: AppTheme.storageKey)
            AppModel.resetLocalState()
            #expect(AppTheme.load() == .dark)
        }
    #endif

    @Test("верный выбранный ответ не содержит цвета ошибки")
    func selectedCorrectColor() async throws {
        let stored = TrainingFixture.stored()
        let store = temporaryTrainingStore()
        try store.saveOwner("person")
        try store.save(stored)
        let server = StubServer()
        server.on("POST /api/trainings/\(stored.id)/answers", .failure(.notConnectedToInternet))
        let trainings = TrainingModel(store: store, report: { _, _ in }, unauthorized: {})
        trainings.connect(
            api: API(config: server.config(), session: server.session, tokens: MemoryTokenStore("t")), ownerID: "person"
        )
        await eventually { trainings.trainings[stored.id] != nil }
        let model = SessionModel(id: stored.id, trainings: trainings)
        let screen = try #require(model.screen)
        for answer in screen.question.answer { model.select(answer) }
        model.check()
        let revealed = try #require(model.screen)
        #expect(revealed.revealed)
        let image = try rendered(SessionQuestion(screen: revealed, onSelect: { _ in }, onReport: {}))
        #expect(try matchingPixels(image, color: .wrong) == 0)
        #expect(try matchingPixels(image, color: .right) > 10)
    }

    @Test("ожидание старта сохраняет акцентную капсулу")
    func busyStartColor() async throws {
        let server = StubServer()
        let app = AppModel(
            config: server.config(), tokens: MemoryTokenStore(), cache: temporaryCache(), network: NetworkMonitor(),
            session: server.session)
        try app.didSignIn(.init(token: "t", user: Fixture.user))
        let model = BuilderModel(trainings: app.trainings, loadsOnInit: false)
        model.use(TrainingFixture.options)
        let gate = StubServer.Gate()
        server.on("POST /api/trainings", .gated(gate, 201, TrainingFixture.json(TrainingFixture.session)))
        let start = Task { await model.start() }
        await eventually { model.starting }
        defer { gate.open() }
        let image = try rendered(TrainingBuilderView(model: model).environment(app))
        #expect(try matchingPixels(image, color: .accent, bottom: 90) > 5000)
        gate.open()
        _ = await start.value
    }

    @Test("действия одноколоночной сессии не выходят за contentMax", arguments: [false, true])
    func sessionActionColumn(summary: Bool) async throws {
        let stored = TrainingFixture.stored()
        let store = temporaryTrainingStore()
        try store.saveOwner("person")
        try store.save(stored)
        let server = StubServer()
        let trainings = TrainingModel(store: store, report: { _, _ in }, unauthorized: {})
        trainings.connect(
            api: API(config: server.config(), session: server.session, tokens: MemoryTokenStore("t")), ownerID: "person"
        )
        await eventually { trainings.trainings[stored.id] != nil }
        let model = SessionModel(id: stored.id, trainings: trainings)
        if summary {
            while let screen = model.screen, screen.result == nil {
                for answer in screen.question.answer { model.select(answer) }
                model.check()
                model.next()
            }
        } else {
            for answer in try #require(model.screen).question.answer { model.select(answer) }
        }
        let width: CGFloat = 1100
        let image = try rendered(TrainingSessionView(model: model, keyboardAvailable: false), width: width)
        let left = Int((width - GPLayout.contentMax) / 2)
        let right = Int((width + GPLayout.contentMax) / 2)
        #expect(try matchingPixels(image, color: .accent, bottom: 90) > 100)
        #expect(try matchingPixels(image, color: .accent, bottom: 90, outside: left..<right) == 0)
    }

    private func rendered(_ view: some View, width: CGFloat = 720) throws -> CGImage {
        let renderer = ImageRenderer(
            content: view.gpDesignTokens().environment(\.colorScheme, .dark)
                .frame(width: width, height: 760).background(Color(.bg)))
        return try #require(renderer.cgImage)
    }

    private func matchingPixels(_ image: CGImage, color: ColorResource, bottom: Int? = nil, outside: Range<Int>? = nil)
        throws -> Int
    {
        #if os(iOS)
            let resolved = UIColor(resource: color).resolvedColor(with: UITraitCollection(userInterfaceStyle: .dark))
            var r: CGFloat = 0
            var g: CGFloat = 0
            var b: CGFloat = 0
            var a: CGFloat = 0
            #expect(resolved.getRed(&r, green: &g, blue: &b, alpha: &a))
        #else
            var resolved: NSColor?
            NSAppearance(named: .darkAqua)!.performAsCurrentDrawingAppearance {
                resolved = NSColor(resource: color).usingColorSpace(.sRGB)
            }
            let components = try #require(resolved)
            let r = components.redComponent
            let g = components.greenComponent
            let b = components.blueComponent
        #endif
        let width = image.width
        let height = image.height
        let space = try #require(CGColorSpace(name: CGColorSpace.sRGB))
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        return try bytes.withUnsafeMutableBytes { buffer in
            let context = try #require(
                CGContext(
                    data: buffer.baseAddress, width: width, height: height,
                    bitsPerComponent: 8, bytesPerRow: width * 4, space: space,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            var count = 0
            for y in (bottom.map { max(0, height - $0) } ?? 0)..<height {
                for x in 0..<width {
                    if outside?.contains(x) == true { continue }
                    let offset = (y * width + x) * 4
                    if abs(CGFloat(buffer[offset]) / 255 - r) < 0.04,
                        abs(CGFloat(buffer[offset + 1]) / 255 - g) < 0.04,
                        abs(CGFloat(buffer[offset + 2]) / 255 - b) < 0.04
                    {
                        count += 1
                    }
                }
            }
            return count
        }
    }
}
