import Foundation
import Testing

@testable import GrePrep

@MainActor
@Suite("Неделя: формы числа и компактное время")
struct HomeWeekCopyTests {
    @Test("VoiceOver: английский аккаунт при русском языке устройства")
    func accountLanguageOverridesDevice() {
        #expect(Bundle.main.preferredLocalizations.first == "ru")
        #expect(
            HomeWeekCopy.accessibilityLabel(.init(days: 4, answers: 86, minutes: 130), locale: Locale(identifier: "en"))
                == "This week, 4 days · 2 hr 10 min, 86 questions")
    }

    @Test(arguments: [1, 2, 4, 5, 11, 21])
    func days(_ number: Int) {
        let expected = [1: "1 день", 2: "2 дня", 4: "4 дня", 5: "5 дней", 11: "11 дней", 21: "21 день"]
        #expect(HomeWeekCopy.text(HomeWeekCopy.days(number), locale: Locale(identifier: "ru")) == expected[number])
        #expect(
            HomeWeekCopy.text(HomeWeekCopy.days(number), locale: Locale(identifier: "en"))
                == "\(number) \(number == 1 ? "day" : "days")")
    }

    @Test(arguments: [1, 2, 4, 5, 11, 86])
    func questions(_ number: Int) {
        let expected = [
            1: "1 задание", 2: "2 задания", 4: "4 задания", 5: "5 заданий", 11: "11 заданий", 86: "86 заданий",
        ]
        #expect(HomeWeekCopy.text(HomeWeekCopy.answers(number), locale: Locale(identifier: "ru")) == expected[number])
        #expect(
            HomeWeekCopy.text(HomeWeekCopy.answers(number), locale: Locale(identifier: "en"))
                == "\(number) \(number == 1 ? "question" : "questions")")
    }

    @Test(arguments: [0, 1, 59, 60, 130])
    func duration(_ minutes: Int) {
        let ru = [0: "0 мин", 1: "1 мин", 59: "59 мин", 60: "1 ч 0 мин", 130: "2 ч 10 мин"]
        let en = [0: "0 min", 1: "1 min", 59: "59 min", 60: "1 hr 0 min", 130: "2 hr 10 min"]
        #expect(HomeWeekCopy.text(HomeWeekCopy.duration(minutes), locale: Locale(identifier: "ru")) == ru[minutes])
        #expect(HomeWeekCopy.text(HomeWeekCopy.duration(minutes), locale: Locale(identifier: "en")) == en[minutes])
    }
}
