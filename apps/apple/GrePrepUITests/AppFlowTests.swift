import UIKit
import XCTest

/// Сценарии через интерфейс, как это делает человек, против настоящего локального сервера (вход подменой,
/// DEV_AUTH=1). Адрес сервера — GP_UI_SERVER (гейт поднимает свой на отдельном порту), без него —
/// сервер разработки 127.0.0.1:8090. У каждого сценария свой пользователь.
@MainActor
final class AppFlowTests: XCTestCase {
    private var serverURL: String {
        ProcessInfo.processInfo.environment["GP_UI_SERVER"] ?? "http://127.0.0.1:8090"
    }

    /// Адрес, где точно никто не слушает: так выглядит «нет сети» для приложения.
    private var userPrefix = "ui"

    private let unreachableServer = "http://127.0.0.1:9"

    override func setUp() async throws {
        continueAfterFailure = false
    }

    private func launch(
        reset: Bool, server: String? = nil, largeText: Bool = false, language: String = "ru", theme: String? = nil,
        useReviewTheme: Bool = true
    )
        -> XCUIApplication
    {
        let app = XCUIApplication()
        app.launchArguments =
            ["-AppleLanguages", "(\(language))", "-AppleLocale", language == "ru" ? "ru_RU" : "en_US"]
            + (reset ? ["-GPResetState"] : [])
        if let theme = theme ?? (useReviewTheme ? ProcessInfo.processInfo.environment["GP_REVIEW_THEME"] : nil) {
            guard ["light", "dark"].contains(theme) else {
                XCTFail("Неизвестное значение GP_REVIEW_THEME: \(theme)")
                return app
            }
            app.launchArguments += ["-GPColorTheme", theme]
        }
        if largeText {
            app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        }
        app.launchEnvironment["GP_API_BASE_URL"] = server ?? serverURL
        app.launch()
        return app
    }

    func testFirstLaunchOverridesLightSystemAndAppleIsWhite() throws {
        let previous = XCUIDevice.shared.appearance
        defer { XCUIDevice.shared.appearance = previous }
        XCUIDevice.shared.appearance = .light
        XCTAssertEqual(XCUIDevice.shared.appearance, .light)
        let app = launch(reset: true, useReviewTheme: false)
        let apple = app.buttons["signin.apple"]
        XCTAssertTrue(apple.waitForExistence(timeout: 10))
        let image = XCUIScreen.main.screenshot().image
        try expectPixel(image, at: CGPoint(x: 4, y: image.size.height / 2), rgb: backgroundRGB("dark"))
        try expectPixel(
            image, at: CGPoint(x: apple.frame.minX + apple.frame.height / 2, y: apple.frame.midY), rgb: (255, 255, 255))
        if let path = ProcessInfo.processInfo.environment["GP_REVIEW_OUTPUT"] {
            try XCUIScreen.main.screenshot().pngRepresentation.write(
                to: URL(filePath: path).appending(path: "first-launch-system-light-app-dark.png"))
        }
    }

    func testFoundationScreensForReview() throws {
        XCUIDevice.shared.orientation = .portrait
        let app = launch(reset: true)
        XCTAssertTrue(app.buttons["signin.apple"].waitForExistence(timeout: 10))
        try capture("signin")
        signIn(app)
        try capture("home")
        // На iPad родная навигация переезжает в верхнюю панель и не имеет роли TabBar.
        app.buttons["Прогресс"].firstMatch.tap()
        app.buttons["shell.profile"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["settings.etsDisclaimer"].waitForExistence(timeout: 5))
        try capture("settings")
    }

    func testStoredLightThemeSurvivesLaunchAndResetReturnsDark() throws {
        var app = launch(reset: true, theme: "light", useReviewTheme: false)
        XCTAssertTrue(app.buttons["signin.apple"].waitForExistence(timeout: 10))
        var image = XCUIScreen.main.screenshot().image
        try expectPixel(image, at: CGPoint(x: 4, y: image.size.height / 2), rgb: backgroundRGB("light"))
        app.terminate()
        app = launch(reset: false, useReviewTheme: false)
        XCTAssertTrue(app.buttons["signin.apple"].waitForExistence(timeout: 10))
        image = XCUIScreen.main.screenshot().image
        try expectPixel(image, at: CGPoint(x: 4, y: image.size.height / 2), rgb: backgroundRGB("light"))
        app.terminate()
        app = launch(reset: true, useReviewTheme: false)
        XCTAssertTrue(app.buttons["signin.apple"].waitForExistence(timeout: 10))
        image = XCUIScreen.main.screenshot().image
        try expectPixel(image, at: CGPoint(x: 4, y: image.size.height / 2), rgb: backgroundRGB("dark"))
    }

    func testBuilderModeDoesNotOverlapStartWhileKeyboardIsOpen() {
        let app = launch(reset: true)
        signIn(app)
        app.swipeUp()
        app.buttons["home.configure"].tap()
        let count = app.textFields["builder.count"]
        XCTAssertTrue(count.waitForExistence(timeout: 10))
        count.tap()
        count.typeText(XCUIKeyboardKey.delete.rawValue + "3")
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        let mode = app.segmentedControls["builder.mode"].buttons["Проверка"]
        XCTAssertTrue(mode.exists)
        let fits = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in
                mode.frame.maxY <= app.buttons["builder.start"].frame.minY && mode.isHittable
            }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [fits], timeout: 5), .completed)
    }

    func testBuilderEmptyCountHasNoClippedPlaceholder() throws {
        let app = launch(reset: true)
        signIn(app)
        app.swipeUp()
        app.buttons["home.configure"].tap()
        let count = app.textFields["builder.count"]
        XCTAssertTrue(count.waitForExistence(timeout: 10))
        count.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        count.typeText(XCUIKeyboardKey.delete.rawValue + XCUIKeyboardKey.delete.rawValue)
        // Пустой UITextField сообщает nil либо пустую строку; placeholder был непустым value.
        let empty = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in (count.value as? String ?? "").isEmpty }, object: count)
        XCTAssertEqual(
            XCTWaiter.wait(for: [empty], timeout: 5), .completed, "Очищенное поле: \(String(describing: count.value))")
        XCTAssertEqual(count.label, "Вопросов")
        try capture("builder-empty")
    }

    func testTrainingStartsWhenCountKeyboardToolbarIsAbsent() {
        let app = launch(reset: true)
        startSession(
            app,
            beforeKeyboardDismissal: {
                // Потеря фокуса убирает ту же панель, которой нет с аппаратной клавиатурой.
                app.buttons["builder.topics"].tap()
                XCTAssertTrue(app.buttons["builder.topics.done"].waitForExistence(timeout: 5))
                app.buttons["builder.topics.done"].tap()
                let absent = XCTNSPredicateExpectation(
                    predicate: NSPredicate { _, _ in
                        !app.buttons["builder.keyboardDone"].exists && !app.buttons["builder.topics.done"].exists
                    }, object: nil)
                XCTAssertEqual(XCTWaiter.wait(for: [absent], timeout: 5), .completed)
            })
    }

    private func backgroundRGB(_ theme: String) throws -> (Int, Int, Int) {
        // Проверяем пиксель приложения против источника цветов, без второй палитры в тестах.
        struct Asset: Decodable {
            struct Entry: Decodable {
                struct Appearance: Decodable { let value: String }
                struct Color: Decodable {
                    struct Components: Decodable {
                        let red: String
                        let green: String
                        let blue: String
                    }
                    let components: Components
                }
                let color: Color
                let appearances: [Appearance]?
            }
            let colors: [Entry]
        }
        let root = URL(filePath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
        let url = root.appending(path: "design/tokens/generated/apple/GPColors.xcassets/bg.colorset/Contents.json")
        let asset = try JSONDecoder().decode(Asset.self, from: Data(contentsOf: url))
        let color = try XCTUnwrap(
            asset.colors.first { entry in
                theme == "dark" ? entry.appearances?.contains { $0.value == "dark" } == true : entry.appearances == nil
            }
        ).color.components
        func channel(_ value: String) throws -> Int { Int((try XCTUnwrap(Double(value)) * 255).rounded()) }
        return try (channel(color.red), channel(color.green), channel(color.blue))
    }

    private func expectPixel(
        _ image: UIImage, at point: CGPoint, rgb: (Int, Int, Int), file: StaticString = #filePath, line: UInt = #line
    ) throws {
        let cg = try XCTUnwrap(image.cgImage, file: file, line: line)
        let scale = CGFloat(cg.width) / image.size.width
        let pixel = try XCTUnwrap(
            cg.cropping(to: CGRect(x: point.x * scale, y: point.y * scale, width: 1, height: 1)), file: file, line: line
        )
        var data = [UInt8](repeating: 0, count: 4)
        let space = try XCTUnwrap(CGColorSpace(name: CGColorSpace.sRGB), file: file, line: line)
        try data.withUnsafeMutableBytes { buffer in
            let context = try XCTUnwrap(
                CGContext(
                    data: buffer.baseAddress, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: space,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue), file: file, line: line)
            context.draw(pixel, in: CGRect(x: 0, y: 0, width: 1, height: 1))
        }
        for (index, expected) in [rgb.0, rgb.1, rgb.2].enumerated() {
            XCTAssertLessThanOrEqual(
                abs(Int(data[index]) - expected), 3, "Цвет пикселя \(point)", file: file, line: line)
        }
    }

    @discardableResult
    private func signIn(_ app: XCUIApplication) -> String {
        let name = app.textFields["signin.dev.name"]
        XCTAssertTrue(name.waitForExistence(timeout: 10), "нет поля входа подменой")
        name.tap()
        let userName = "\(userPrefix)-\(UUID().uuidString.prefix(12).lowercased())"
        name.typeText(userName)
        app.buttons["signin.dev.submit"].tap()
        let choice = app.buttons["exam.choose.gre"]
        XCTAssertTrue(choice.waitForExistence(timeout: 15), "после первого входа нет выбора экзамена")
        choice.tap()
        XCTAssertTrue(app.buttons["home.configure"].waitForExistence(timeout: 15), "нет главной тренировки")
        return userName
    }

    func testEnglishNewAccountUsesInterfaceLanguage() async throws {
        let app = launch(reset: true, language: "en")
        let name = signIn(app)
        // Повторный вход в тот же тестовый аккаунт язык не меняет: ответ проверяет, с чем его создало приложение.
        var request = URLRequest(url: try XCTUnwrap(URL(string: serverURL + "/api/auth/dev")))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "name": name, "transport": "bearer", "clientKind": "ios",
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        struct Session: Decodable {
            struct User: Decodable { let locale: String }
            let user: User
        }
        XCTAssertEqual(try JSONDecoder().decode(Session.self, from: data).user.locale, "en")
        app.tabBars.buttons["Progress"].firstMatch.tap()
        app.buttons["shell.profile"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["settings.etsDisclaimer"].waitForExistence(timeout: 5))
        XCTAssertTrue(
            app.staticTexts["settings.etsDisclaimer"].label.hasPrefix("GRE® and TOEFL® are registered trademarks"))
    }

    func testFirstEntryChoosesExamAndEmptyTabs() {
        let app = launch(reset: true)
        signIn(app)
        app.buttons["Слова"].firstMatch.tap()
        XCTAssertTrue(app.scrollViews["shell.empty.words"].waitForExistence(timeout: 5))
        app.buttons["Экзамен"].firstMatch.tap()
        XCTAssertTrue(app.scrollViews["shell.empty.exam"].waitForExistence(timeout: 5))
        app.buttons["Тренировка"].firstMatch.tap()
        XCTAssertTrue(app.buttons["home.configure"].waitForExistence(timeout: 5))
    }

    func testSessionSurvivesRelaunch() {
        let app = launch(reset: true)
        signIn(app)
        app.terminate()

        let again = launch(reset: false)
        XCTAssertTrue(again.buttons["home.configure"].waitForExistence(timeout: 15))
        XCTAssertFalse(again.buttons["signin.apple"].exists)
    }

    func testSignOutReturnsToSignInForGood() {
        let app = launch(reset: true)
        signIn(app)
        app.tabBars.buttons["Прогресс"].firstMatch.tap()
        app.buttons["shell.profile"].firstMatch.tap()
        let disclaimer = app.staticTexts["settings.etsDisclaimer"]
        XCTAssertTrue(disclaimer.waitForExistence(timeout: 5))
        XCTAssertEqual(
            disclaimer.label,
            "GRE® and TOEFL® are registered trademarks of Educational Testing Service (ETS). This product is not endorsed or approved by ETS."
        )
        app.buttons["settings.signOut"].tap()
        XCTAssertTrue(app.buttons["signin.apple"].waitForExistence(timeout: 5))
        app.terminate()

        let again = launch(reset: false)
        XCTAssertTrue(
            again.buttons["signin.apple"].waitForExistence(timeout: 10),
            "после выхода и перезапуска вход не должен вернуться")
    }

    func testOfflineKeepsCachedHomeAndExplainsStart() {
        let app = launch(reset: true)
        signIn(app)
        app.terminate()

        let offline = launch(reset: false, server: unreachableServer)
        XCTAssertTrue(
            offline.buttons["home.configure"].waitForExistence(timeout: 10),
            "без сети должна остаться сохранённая главная")
        // ShellNotice объединён для VoiceOver и имеет роль текста; прежний контейнер Today имел роль Other.
        let notice = offline.descendants(matching: .any)["home.stale"]
        XCTAssertTrue(notice.waitForExistence(timeout: 15), "нет строки «Нет сети»")
        XCTAssertTrue(notice.label.contains("Нет сети"))
        offline.buttons["home.start"].tap()
        XCTAssertTrue(
            offline.descendants(matching: .any)["home.startError"].waitForExistence(timeout: 5),
            "нет объяснения, что нужна сеть")
        XCTAssertFalse(offline.navigationBars["Слова"].exists, "без сети шаг не должен открываться")
    }

    func testProvidersWithoutAccountsSayItHonestly() {
        let app = launch(reset: true)
        let google = app.buttons["signin.google"]
        XCTAssertTrue(google.waitForExistence(timeout: 10))
        google.tap()
        let message = app.staticTexts["signin.message"]
        XCTAssertTrue(message.waitForExistence(timeout: 5))
        XCTAssertTrue(message.label.contains("ещё не подключён"), message.label)
    }

    func testTrainingBuilderStartAndContinueAfterRelaunch() {
        let app = launch(reset: true)
        signIn(app)
        app.swipeUp()
        app.buttons["home.configure"].tap()
        XCTAssertTrue(app.buttons["builder.start"].waitForExistence(timeout: 10))
        // Full-screen cover сохраняет TabView в иерархии; под экраном тренировки вкладки недоступны.
        let hiddenTabs = expectation(
            for: NSPredicate(format: "hittable == false"), evaluatedWith: app.tabBars.firstMatch)
        wait(for: [hiddenTabs], timeout: 5)
        let count = app.textFields["builder.count"]
        // Касание справа от числа ставит курсор в конец поля, как при обычном редактировании.
        count.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        count.typeText(XCUIKeyboardKey.delete.rawValue + XCUIKeyboardKey.delete.rawValue + "345")
        let clipped = expectation(for: NSPredicate(format: "value == %@", "34"), evaluatedWith: count)
        wait(for: [clipped], timeout: 5)
        count.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        count.typeText(XCUIKeyboardKey.delete.rawValue + XCUIKeyboardKey.delete.rawValue + "3")
        let changed = expectation(for: NSPredicate(format: "value == %@", "3"), evaluatedWith: count)
        wait(for: [changed], timeout: 5)
        app.buttons["builder.topics"].tap()
        XCTAssertTrue(app.buttons["builder.topics.done"].waitForExistence(timeout: 5))
        let topics = app.switches.matching(NSPredicate(format: "identifier BEGINSWITH %@", "builder.topic."))
        XCTAssertGreaterThan(topics.count, 1)
        // В наборе для разработки здесь один средний вопрос; в остальных темах остаются ещё четыре.
        app.switches["builder.topic.cause-effect"].tap()
        app.segmentedControls["builder.difficulty"].buttons["Средняя"].tap()
        app.buttons["builder.topics.done"].tap()
        let retained = expectation(for: NSPredicate(format: "value == %@", "3"), evaluatedWith: count)
        wait(for: [retained], timeout: 5)
        XCTAssertTrue(app.buttons["builder.topics"].label.contains("Средняя"))
        XCTAssertTrue(app.buttons["builder.topics"].label.contains("2 из 3"))
        app.buttons["builder.topics"].tap()
        XCTAssertTrue(app.buttons["builder.topics.done"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.switches["builder.topic.cause-effect"].value as? String, "0")
        XCTAssertTrue(app.segmentedControls["builder.difficulty"].buttons["Средняя"].isSelected)
        app.buttons["builder.topics.done"].tap()
        XCTAssertTrue(app.buttons["builder.start"].label.contains("3 вопроса"))
        app.buttons["builder.start"].tap()
        XCTAssertTrue(app.otherElements["training.session"].waitForExistence(timeout: 10))
        app.terminate()

        let again = launch(reset: false, server: unreachableServer)
        let resume = again.buttons["home.continue"]
        XCTAssertTrue(resume.waitForExistence(timeout: 10), "тренировка должна пережить перезапуск без сети")
        XCTAssertTrue(
            resume.label.replacingOccurrences(of: "\u{00A0}", with: " ").contains("Вопрос 1 из 3"), resume.label)
        resume.tap()
        XCTAssertTrue(again.otherElements["training.session"].waitForExistence(timeout: 5))
        again.buttons["training.close"].tap()
        XCTAssertTrue(again.buttons["home.configure"].waitForExistence(timeout: 5))
    }

    func testTrainingClosePreservesHomeScroll() {
        let app = launch(reset: true, largeText: true)
        signIn(app)
        app.swipeUp()
        let entry = app.buttons["home.configure"]
        XCTAssertTrue(entry.isHittable)
        let originalY = entry.frame.midY
        entry.tap()
        XCTAssertTrue(app.buttons["builder.start"].waitForExistence(timeout: 10))
        app.buttons["training.close"].tap()
        XCTAssertTrue(entry.waitForExistence(timeout: 5))
        XCTAssertTrue(entry.isHittable)
        XCTAssertEqual(entry.frame.midY, originalY, accuracy: 2)
    }

    private func startSession(
        _ app: XCUIApplication, check: Bool = false, threeBlanks: Bool = false, beforeKeyboardDismissal: () -> Void = {}
    ) {
        signIn(app)
        app.swipeUp()
        app.buttons["home.configure"].tap()
        XCTAssertTrue(app.buttons["builder.start"].waitForExistence(timeout: 10))
        let count = app.textFields["builder.count"]
        count.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        count.typeText(XCUIKeyboardKey.delete.rawValue + XCUIKeyboardKey.delete.rawValue + (threeBlanks ? "1" : "3"))
        beforeKeyboardDismissal()
        let done = app.buttons["builder.keyboardDone"]
        if done.waitForExistence(timeout: 2), done.isHittable { done.tap() }
        if check {
            let mode = app.segmentedControls["builder.mode"].buttons["Проверка"]
            XCTAssertTrue(mode.waitForExistence(timeout: 5))
            mode.tap()
            let selected = XCTNSPredicateExpectation(predicate: NSPredicate(format: "selected == true"), object: mode)
            XCTAssertEqual(XCTWaiter.wait(for: [selected], timeout: 5), .completed)
        }
        // Без экранной панели (аппаратная клавиатура) этот шаг также снимает фокус с количества.
        app.buttons["builder.topics"].tap()
        XCTAssertTrue(app.buttons["builder.topics.done"].waitForExistence(timeout: 5))
        // Контраст: в открытом наборе все ответы — A, у двух пропусков — A и D.
        app.switches[threeBlanks ? "builder.topic.contrast-signals" : "builder.topic.similarity-signals"].tap()
        app.switches["builder.topic.cause-effect"].tap()
        if threeBlanks { app.segmentedControls["builder.difficulty"].buttons["Трудная"].tap() }
        app.buttons["builder.topics.done"].tap()
        let start = app.buttons["builder.start"]
        // На iOS 18 завершение события «Готово» не гарантирует, что шторка уже перестала перехватывать касание.
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in
                !app.buttons["builder.topics.done"].exists && start.isHittable && start.isEnabled
            }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 5), .completed)
        start.tap()
        XCTAssertTrue(app.staticTexts["session.progress"].waitForExistence(timeout: 10))
    }

    private func choose(_ app: XCUIApplication, correct: Bool) {
        let options = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "option."))
        XCTAssertTrue(options.firstMatch.waitForExistence(timeout: 5))
        let count = options.count
        app.buttons[correct ? "option.A" : "option.C"].tap()
        if count > 5 { app.buttons[correct ? "option.D" : "option.F"].tap() }
        if count > 6 { app.buttons[correct ? "option.G" : "option.I"].tap() }
    }

    private func capture(_ name: String) throws {
        if let path = ProcessInfo.processInfo.environment["GP_REVIEW_OUTPUT"] {
            let theme = ProcessInfo.processInfo.environment["GP_REVIEW_THEME"] ?? "dark"
            let device =
                UIDevice.current.userInterfaceIdiom == .pad
                ? (XCUIDevice.shared.orientation.isLandscape ? "ipad-landscape" : "ipad") : "iphone"
            try XCUIScreen.main.screenshot().pngRepresentation.write(
                to: URL(filePath: path).appending(path: "\(name)-\(device)-\(theme).png"))
        }
    }

    func testTrainingPracticeToSummary() throws {
        let app = launch(reset: true)
        if UIDevice.current.userInterfaceIdiom == .pad { XCUIDevice.shared.orientation = .landscapeLeft }
        startSession(app)
        try capture("question")
        choose(app, correct: true)
        app.buttons["question.check"].tap()
        XCTAssertTrue(app.staticTexts["explanation.verdict"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["explanation.verdict"].label, "Верно.")
        app.buttons["question.next"].tap()
        choose(app, correct: false)
        app.buttons["question.check"].tap()
        XCTAssertTrue(app.staticTexts["explanation.verdict"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["explanation.verdict"].label.hasPrefix("Неверно."))
        if !app.buttons["explanation.whyNotToggle"].isHittable { app.swipeUp() }
        app.buttons["explanation.whyNotToggle"].tap()
        XCTAssertTrue(app.staticTexts["explanation.whyNot"].firstMatch.waitForExistence(timeout: 5))
        if !app.staticTexts["explanation.whyNot"].firstMatch.isHittable { app.swipeUp() }
        try capture("explanation")
        app.segmentedControls["explanation.language"].buttons["EN"].tap()
        XCTAssertTrue(app.staticTexts["explanation.verdict"].label.hasPrefix("Incorrect."))
        app.segmentedControls["explanation.language"].buttons["RU"].tap()
        app.buttons["question.next"].tap()
        app.buttons["question.dontKnow"].tap()
        XCTAssertTrue(app.staticTexts["explanation.verdict"].waitForExistence(timeout: 5))
        app.buttons["question.next"].tap()
        XCTAssertTrue(app.buttons["summary.repeat"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Что повторить"].exists)
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "из 3 верно")).firstMatch.exists)
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "вопросы 2 и 3")).firstMatch.exists)
        try capture("summary")
        app.buttons["summary.done"].tap()
        XCTAssertTrue(app.buttons["home.configure"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["home.continue"].exists)
        XCUIDevice.shared.orientation = .portrait
    }

    func testTrainingCheckSkipFlagReturnAndFinish() throws {
        let app = launch(reset: true)
        if UIDevice.current.userInterfaceIdiom == .pad { XCUIDevice.shared.orientation = .landscapeLeft }
        startSession(app, check: true)
        XCTAssertTrue(app.staticTexts["session.timer"].exists)
        app.buttons["question.flag"].tap()
        app.buttons["question.skip"].tap()
        choose(app, correct: true)
        app.buttons["question.next"].tap()
        app.buttons["question.next"].tap()
        XCTAssertTrue(app.buttons["overview.finish"].waitForExistence(timeout: 5))
        if UIDevice.current.userInterfaceIdiom == .pad {
            XCTAssertTrue(app.buttons["question.flag"].exists)
            // Оставляем ошибку для проверки повтора: после трёх верных ответов повторять нечего.
            choose(app, correct: false)
            XCTAssertTrue(app.buttons["option.C"].isSelected)
        }
        try capture("overview")
        XCTAssertTrue(app.buttons["overview.question.0"].value as? String == "без ответа, отмечен")
        app.buttons["overview.question.0"].tap()
        XCTAssertEqual(app.staticTexts["session.progress"].label, "Вопрос 1 из 3")
        choose(app, correct: true)
        app.buttons["question.overview"].tap()
        XCTAssertTrue(app.buttons["overview.question.0"].value as? String == "отвечен, отмечен")
        app.buttons["overview.finish"].tap()
        XCTAssertTrue(app.buttons["summary.done"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["session.timer"].exists)
        app.buttons["summary.repeat"].tap()
        XCTAssertTrue(app.staticTexts["session.progress"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["session.timer"].exists)
        app.buttons["training.close"].tap()
        XCUIDevice.shared.orientation = .portrait
    }

    func testTrainingCheckThreeBlanksCountOnlyCompleteAnswer() throws {
        let app = launch(reset: true)
        if UIDevice.current.userInterfaceIdiom == .pad { XCUIDevice.shared.orientation = .landscapeLeft }
        startSession(app, check: true, threeBlanks: true)
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "option.")).count, 9)
        app.buttons["option.A"].tap()
        app.buttons["question.overview"].tap()
        XCTAssertTrue(app.staticTexts["overview.status"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["overview.status"].label, "Отвечено 0 из 1 · отмечено 0")
        XCTAssertEqual(app.buttons["overview.question.0"].value as? String, "без ответа")
        try capture("overview-partial")
        if UIDevice.current.userInterfaceIdiom != .pad { app.buttons["overview.back"].tap() }
        for id in ["D", "G"] {
            let option = app.buttons["option.\(id)"]
            if !option.isHittable { app.swipeUp() }
            if id == "G" {
                XCTAssertFalse(option.frame.intersects(app.buttons["question.next"].frame))
            }
            option.tap()
            let selected = XCTNSPredicateExpectation(predicate: NSPredicate(format: "selected == true"), object: option)
            XCTAssertEqual(XCTWaiter.wait(for: [selected], timeout: 5), .completed)
        }
        app.buttons["question.overview"].tap()
        XCTAssertEqual(app.staticTexts["overview.status"].label, "Отвечено 1 из 1 · отмечено 0")
        XCTAssertEqual(app.buttons["overview.question.0"].value as? String, "отвечен")
        app.buttons["overview.finish"].tap()
        XCTAssertTrue(app.buttons["summary.done"].waitForExistence(timeout: 5))
        XCUIDevice.shared.orientation = .portrait
    }

    func testTrainingRelaunchResumesSameQuestionAndAnswerOffline() throws {
        let app = launch(reset: true)
        startSession(app, check: true)
        choose(app, correct: true)
        app.buttons["question.next"].tap()
        choose(app, correct: false)
        app.terminate()
        let offline = launch(reset: false, server: unreachableServer)
        XCTAssertTrue(offline.buttons["home.continue"].waitForExistence(timeout: 10))
        offline.buttons["home.continue"].tap()
        XCTAssertTrue(offline.staticTexts["session.progress"].waitForExistence(timeout: 5))
        XCTAssertEqual(offline.staticTexts["session.progress"].label, "Вопрос 2 из 3")
        XCTAssertTrue(offline.buttons["option.C"].isSelected)
        let notice = offline.descendants(matching: .any)["session.offline"]
        XCTAssertTrue(notice.waitForExistence(timeout: 10))
        XCTAssertTrue(notice.label.contains("ответы сохранятся"))
        try capture("question-offline")
        offline.terminate()
        let online = launch(reset: false)
        XCTAssertTrue(online.buttons["home.continue"].waitForExistence(timeout: 10))
        online.buttons["home.continue"].tap()
        XCTAssertTrue(online.staticTexts["session.progress"].waitForExistence(timeout: 5))
        XCTAssertFalse(online.descendants(matching: .any)["session.offline"].exists)
        online.buttons["question.overview"].tap()
        online.buttons["overview.finish"].tap()
        XCTAssertTrue(online.buttons["summary.repeat"].waitForExistence(timeout: 5))
    }

    func testTrainingReviewAnswersAndBack() throws {
        let keyboardRun = ProcessInfo.processInfo.environment["GP_REVIEW_KEYBOARD"] == "1"
        XCUIDevice.shared.orientation = .portrait
        defer { XCUIDevice.shared.orientation = .portrait }
        let app = launch(reset: true)
        if keyboardRun {
            try reviewKeyboard(app)
            return
        }
        startSession(app, check: true)
        try capture("question")
        choose(app, correct: true)
        app.buttons["question.next"].tap()
        choose(app, correct: false)
        app.buttons["question.next"].tap()
        app.buttons["question.next"].tap()
        app.buttons["overview.finish"].tap()
        XCTAssertTrue(app.buttons["summary.review"].waitForExistence(timeout: 5))
        try capture("summary")
        app.buttons["summary.review"].tap()
        XCTAssertTrue(app.buttons["review.item.0"].waitForExistence(timeout: 5))
        try capture("review")
        app.segmentedControls["review.filter"].buttons["Ошибки · 2"].tap()
        XCTAssertFalse(app.buttons["review.item.0"].exists)
        app.buttons["review.item.1"].tap()
        XCTAssertTrue(app.staticTexts["explanation.verdict"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["explanation.verdict"].label.hasPrefix("Неверно."))
        if !app.buttons["explanation.whyNotToggle"].isHittable { app.swipeUp() }
        app.buttons["explanation.whyNotToggle"].tap()
        XCTAssertTrue(app.staticTexts["explanation.whyNot"].firstMatch.waitForExistence(timeout: 5))
        try capture("review-question")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.buttons["review.item.1"].waitForExistence(timeout: 5))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.buttons["summary.review"].waitForExistence(timeout: 5))
    }

    private func reviewKeyboard(_ app: XCUIApplication) throws {
        XCTAssertEqual(UIDevice.current.userInterfaceIdiom, .pad)
        signIn(app)
        app.swipeUp()
        app.buttons["home.configure"].tap()
        XCTAssertTrue(app.buttons["builder.start"].waitForExistence(timeout: 10))
        // Для клавиш достаточно штатной проверки: этот путь не зависит от редактирования числа вопросов.
        app.buttons["builder.preset.timed"].tap()
        app.buttons["builder.start"].tap()
        XCTAssertTrue(app.buttons["question.overview"].waitForExistence(timeout: 10))
        app.buttons["question.overview"].tap()
        app.buttons["overview.finish"].tap()
        XCTAssertTrue(app.buttons["summary.review"].waitForExistence(timeout: 5))
        XCUIDevice.shared.orientation = .landscapeLeft
        app.buttons["summary.review"].tap()
        XCTAssertTrue(app.buttons["review.item.0"].waitForExistence(timeout: 5))
        app.typeKey(.downArrow, modifierFlags: [])
        waitSelected(app.buttons["review.item.1"])
        app.typeKey(.return, modifierFlags: [])
        app.typeKey(.downArrow, modifierFlags: [])
        waitSelected(app.buttons["review.item.2"])
        app.typeKey(.upArrow, modifierFlags: [])
        waitSelected(app.buttons["review.item.1"])
        // Сессия под разбором не должна получать свои команды или возвращать себе фокус.
        app.typeKey(.rightArrow, modifierFlags: [])
        XCTAssertTrue(app.buttons["review.item.1"].isSelected)
        app.typeKey("a", modifierFlags: [])
        app.typeKey(.downArrow, modifierFlags: [])
        waitSelected(app.buttons["review.item.2"])
        app.typeKey(.upArrow, modifierFlags: [])
        waitSelected(app.buttons["review.item.1"])
        try capture("review-keyboard")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.buttons["summary.review"].waitForExistence(timeout: 5))
    }

    private func waitSelected(_ element: XCUIElement) {
        let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: "selected == true"), object: element)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: 5), .completed)
    }

    func testTrainingReviewReportAndCancel() throws {
        let app = launch(reset: true)
        startSession(app, check: true, threeBlanks: true)
        app.buttons["question.overview"].tap()
        app.buttons["overview.finish"].tap()
        XCTAssertTrue(app.buttons["summary.review"].waitForExistence(timeout: 5))
        app.buttons["summary.review"].tap()
        XCTAssertTrue(app.buttons["review.item.0"].waitForExistence(timeout: 5))
        app.buttons["review.item.0"].tap()
        XCTAssertTrue(app.buttons["question.report"].waitForExistence(timeout: 5))
        app.buttons["question.report"].tap()
        XCTAssertTrue(app.buttons["report.kind.translation"].waitForExistence(timeout: 5))
        try capture("report-review")
        app.buttons["report.kind.translation"].tap()
        app.buttons["report.cancel"].tap()
        XCTAssertTrue(app.buttons["question.report"].waitForExistence(timeout: 5))
        app.buttons["question.report"].tap()
        XCTAssertTrue(app.buttons["report.send"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["report.send"].isEnabled)
        app.buttons["report.cancel"].tap()
        XCTAssertTrue(app.buttons["question.report"].waitForExistence(timeout: 5))
    }

    private func reportText(_ app: XCUIApplication) -> XCUIElement {
        // SwiftUI представляет многострочный TextField как TextView на iOS 18 и TextField на iOS 27.
        // Идентификатор договора доступности один на обеих версиях системы.
        app.descendants(matching: .any).matching(identifier: "report.text").firstMatch
    }

    func testTrainingQuestionReportDraftAndSend() throws {
        userPrefix = "report-ui"
        let app = launch(reset: true)
        startSession(app)
        app.buttons["question.report"].tap()
        XCTAssertTrue(app.buttons["report.send"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["report.send"].isEnabled)
        try capture("report")
        app.buttons["report.kind.explanation"].tap()
        let text = reportText(app)
        XCTAssertTrue(text.waitForExistence(timeout: 5))
        text.tap()
        text.typeText("ui-report-fixture")
        app.terminate()
        let again = launch(reset: false)
        XCTAssertTrue(again.buttons["home.continue"].waitForExistence(timeout: 10))
        again.buttons["home.continue"].tap()
        XCTAssertTrue(again.buttons["question.report"].waitForExistence(timeout: 5))
        again.buttons["question.report"].tap()
        XCTAssertTrue(reportText(again).waitForExistence(timeout: 5))
        XCTAssertEqual(reportText(again).value as? String, "ui-report-fixture")
        XCTAssertTrue(again.buttons["report.kind.explanation"].isSelected)
        again.buttons["report.send"].tap()
        XCTAssertTrue(again.staticTexts["report.sent"].waitForExistence(timeout: 5))
        try capture("report-sent")
        again.buttons["report.back"].tap()
        XCTAssertTrue(again.buttons["question.check"].waitForExistence(timeout: 5))
        again.buttons["question.report"].tap()
        XCTAssertTrue(again.buttons["report.send"].waitForExistence(timeout: 5))
        XCTAssertFalse(again.buttons["report.send"].isEnabled)
        again.buttons["report.cancel"].tap()
        XCTAssertTrue(again.buttons["question.check"].waitForExistence(timeout: 5))
    }

    func testTrainingLayoutInBothOrientations() throws {
        let app = launch(reset: true)
        signIn(app)
        app.swipeUp()
        app.buttons["home.configure"].tap()
        XCTAssertTrue(app.buttons["builder.start"].waitForExistence(timeout: 10))
        let output = ProcessInfo.processInfo.environment["GP_REVIEW_OUTPUT"]
        let theme = ProcessInfo.processInfo.environment["GP_REVIEW_THEME"] ?? "dark"
        let device = UIDevice.current.userInterfaceIdiom == .pad ? "ipad" : "iphone"
        let orientations: [(UIDeviceOrientation, String)] =
            UIDevice.current.userInterfaceIdiom == .pad
            ? [(.portrait, "portrait"), (.landscapeLeft, "landscape")] : [(.portrait, "portrait")]
        for (orientation, name) in orientations {
            XCUIDevice.shared.orientation = orientation
            XCTAssertTrue(app.buttons["builder.start"].isHittable)
            if name == "landscape" { XCTAssertGreaterThan(app.frame.width, app.frame.height) }
            if let output {
                try XCUIScreen.main.screenshot().pngRepresentation.write(
                    to: URL(filePath: output).appending(path: "builder-\(device)-\(name)-\(theme).png"))
            }
            app.buttons["builder.topics"].tap()
            XCTAssertTrue(app.buttons["builder.topics.done"].waitForExistence(timeout: 5))
            if let output {
                try XCUIScreen.main.screenshot().pngRepresentation.write(
                    to: URL(filePath: output).appending(path: "topics-\(device)-\(name)-\(theme).png"))
            }
            app.buttons["builder.topics.done"].tap()
        }
        if let output {
            app.buttons["builder.start"].tap()
            XCTAssertTrue(app.otherElements["training.session"].waitForExistence(timeout: 10))
            app.buttons["training.close"].tap()
            app.swipeDown()
            XCTAssertTrue(app.buttons["home.continue"].waitForExistence(timeout: 5))
            for (orientation, name) in orientations {
                XCUIDevice.shared.orientation = orientation
                try XCUIScreen.main.screenshot().pngRepresentation.write(
                    to: URL(filePath: output).appending(path: "home-\(device)-\(name)-\(theme).png"))
            }
        }
        if output == nil { XCUIDevice.shared.orientation = .portrait }
    }
    private struct AccountSession: Decodable {
        let token: String
        struct User: Decodable {
            let activeExam: String?
            let locale: String
        }
        let user: User
    }

    private func account(_ name: String) async throws -> AccountSession {
        var request = URLRequest(url: try XCTUnwrap(URL(string: serverURL + "/api/auth/dev")))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "name": name, "transport": "bearer", "clientKind": "ios",
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        return try JSONDecoder().decode(AccountSession.self, from: data)
    }

    func testShellExamSwitchSavesAccountAndToeflSectionsAreInactive() async throws {
        let app = launch(reset: true)
        let name = signIn(app)
        let savedAccount0 = try await account(name)
        XCTAssertEqual(savedAccount0.user.activeExam, "gre")
        app.buttons["shell.exam"].firstMatch.tap()
        let toefl = app.buttons["exam.choose.toefl"]
        XCTAssertTrue(toefl.waitForExistence(timeout: 5))
        let presented = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in toefl.isHittable }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [presented], timeout: 5), .completed)
        try capture("exam-picker-open")
        toefl.tap()
        let empty = app.staticTexts["home.empty"]
        XCTAssertTrue(empty.waitForExistence(timeout: 10))
        let savedAccount1 = try await account(name)
        XCTAssertEqual(savedAccount1.user.activeExam, "toefl")
        XCTAssertFalse(app.buttons["home.start"].exists)
        for section in ["reading", "listening", "writing", "speaking"] {
            XCTAssertFalse(app.buttons["home.section.\(section)"].exists)
            XCTAssertTrue(app.descendants(matching: .any)["home.section.\(section)"].exists)
        }
        try capture("toefl-empty")
        app.buttons["shell.exam"].firstMatch.tap()
        app.buttons["exam.choose.gre"].tap()
        XCTAssertTrue(app.buttons["home.configure"].waitForExistence(timeout: 10))
    }

    func testShellProfileLanguageThemeTextSizeAndInactiveRows() async throws {
        var app = launch(reset: true, useReviewTheme: false)
        let name = signIn(app)
        app.buttons["shell.profile"].firstMatch.tap()
        XCTAssertTrue(app.segmentedControls["settings.language"].waitForExistence(timeout: 5))
        for id in ["subscription", "identities", "contact"] {
            XCTAssertFalse(app.buttons["settings.inactive.\(id)"].exists)
            XCTAssertTrue(app.descendants(matching: .any)["settings.inactive.\(id)"].exists)
        }
        let profile = app.scrollViews["shell.profileScreen"]
        XCTAssertTrue(profile.exists)
        XCTAssertFalse(profile.buttons["Экзамен"].exists)
        app.segmentedControls["settings.language"].buttons["English"].tap()
        XCTAssertTrue(app.buttons["Sign out"].waitForExistence(timeout: 10))
        let savedAccount2 = try await account(name)
        XCTAssertEqual(savedAccount2.user.locale, "en")
        app.segmentedControls["settings.theme"].buttons["Light"].tap()
        app.segmentedControls["settings.textSize"].buttons["Larger"].tap()
        try capture("profile-en-light-larger")
        app.terminate()
        app = launch(reset: false, useReviewTheme: false)
        XCTAssertTrue(app.buttons["home.configure"].waitForExistence(timeout: 15))
        app.buttons["shell.profile"].firstMatch.tap()
        XCTAssertTrue(app.segmentedControls["settings.theme"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.segmentedControls["settings.theme"].buttons["Light"].isSelected)
        XCTAssertTrue(app.segmentedControls["settings.textSize"].buttons["Larger"].isSelected)
        XCTAssertTrue(app.segmentedControls["settings.language"].buttons["English"].isSelected)
    }

    func testShellLocaleOfflineRollsBackAndAccountRetainsLanguage() async throws {
        let app = launch(reset: true)
        let name = signIn(app)
        app.terminate()
        let offline = launch(reset: false, server: unreachableServer)
        XCTAssertTrue(offline.buttons["home.configure"].waitForExistence(timeout: 10))
        offline.buttons["shell.profile"].firstMatch.tap()
        offline.segmentedControls["settings.language"].buttons["English"].tap()
        let error = offline.descendants(matching: .any)["settings.languageError"]
        XCTAssertTrue(error.waitForExistence(timeout: 10))
        XCTAssertTrue(offline.segmentedControls["settings.language"].buttons["Русский"].isSelected)
        let savedAccount3 = try await account(name)
        XCTAssertEqual(savedAccount3.user.locale, "ru")
        try capture("profile-locale-offline")
    }

    func testShellRepeatMistakesStartsFromSavedWrongAnswer() async throws {
        let app = launch(reset: true)
        startSession(app)
        XCTAssertTrue(app.buttons["question.dontKnow"].waitForExistence(timeout: 5))
        app.buttons["question.dontKnow"].tap()
        app.buttons["training.close"].tap()
        let mistakes = app.buttons["home.mistakes"]
        XCTAssertTrue(mistakes.waitForExistence(timeout: 15))
        mistakes.tap()
        XCTAssertTrue(app.otherElements["training.session"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.tabBars.firstMatch.exists == false || !app.tabBars.firstMatch.isHittable)
        try capture("mistakes-session")
    }

    func testShellTabHistory() {
        let app = launch(reset: true)
        signIn(app)
        if UIDevice.current.userInterfaceIdiom == .pad {
            app.buttons["shell.profile"].firstMatch.tap()
            XCTAssertTrue(app.segmentedControls["settings.language"].waitForExistence(timeout: 5))
            app.descendants(matching: .any)["shell.tab.words"].firstMatch.tap()
            XCTAssertTrue(app.scrollViews["shell.empty.words"].waitForExistence(timeout: 5))
            app.descendants(matching: .any)["shell.tab.training"].firstMatch.tap()
            XCTAssertTrue(
                app.segmentedControls["settings.language"].waitForExistence(timeout: 5),
                "стек тренировки потерял профиль")
        } else {
            app.buttons["Прогресс"].firstMatch.tap()
            app.buttons["shell.profile"].firstMatch.tap()
            XCTAssertTrue(app.segmentedControls["settings.language"].waitForExistence(timeout: 5))
            app.navigationBars.buttons.firstMatch.tap()
            XCTAssertTrue(app.scrollViews["shell.empty.progress"].waitForExistence(timeout: 5))
            app.buttons["Тренировка"].firstMatch.tap()
            XCTAssertTrue(app.buttons["home.configure"].waitForExistence(timeout: 5))
            app.buttons["Прогресс"].firstMatch.tap()
            XCTAssertTrue(app.scrollViews["shell.empty.progress"].waitForExistence(timeout: 5))
        }
    }

}
