import GPAPI
import SwiftUI

/// Разделы каталога: цвет метки и контрастный цвет подписи разделены токенами.
enum StudySection: String, Hashable, Sendable, CaseIterable {
    case verbal, quant, words, essay, reading, listening, writing, speaking

    init(_ dto: Components.Schemas.Section) {
        switch dto {
        case .verbal: self = .verbal
        case .quant: self = .quant
        case .words: self = .words
        case .essay: self = .essay
        case .reading: self = .reading
        case .listening: self = .listening
        case .writing: self = .writing
        case .speaking: self = .speaking
        }
    }

    /// Названия разделов GRE остаются английскими и в русском интерфейсе — как на экзамене.
    var label: LocalizedStringResource {
        switch self {
        case .verbal: "Verbal"
        case .quant: "Quant"
        case .words: "Слова"
        case .essay: "Эссе"
        case .reading: "Reading"
        case .listening: "Listening"
        case .writing: "Writing"
        case .speaking: "Speaking"
        }
    }

    var color: Color {
        switch self {
        case .verbal: Color(.verbal)
        case .quant: Color(.quant)
        case .words: Color(.words)
        case .essay: Color(.essay)
        case .reading: Color(.reading)
        case .listening: Color(.listening)
        case .writing: Color(.writing)
        case .speaking: Color(.speaking)
        }
    }

    /// Контрастный оттенок для подписей и цифр; базовый color — только для меток и заливок.
    var ink: Color {
        switch self {
        case .verbal: Color(.verbalInk)
        case .quant: Color(.quantInk)
        case .words: Color(.wordsInk)
        case .essay: Color(.essayInk)
        case .reading: Color(.readingInk)
        case .listening: Color(.listeningInk)
        case .writing: Color(.writingInk)
        case .speaking: Color(.speakingInk)
        }
    }

    var tint: Color {
        switch self {
        case .verbal: Color(.verbalSoft)
        case .quant: Color(.quantSoft)
        case .words: Color(.wordsSoft)
        case .essay: Color(.essaySoft)
        case .reading: Color(.readingSoft)
        case .listening: Color(.listeningSoft)
        case .writing: Color(.writingSoft)
        case .speaking: Color(.speakingSoft)
        }
    }

    /// Значок узла — SF Symbols: на Apple иконки системные (impeccable, iOS).
    var symbol: String {
        switch self {
        case .verbal: "text.bubble"
        case .quant: "function"
        case .words: "rectangle.on.rectangle"
        case .essay: "pencil.line"
        case .reading: "book"
        case .listening: "headphones"
        case .writing: "pencil"
        case .speaking: "mic"
        }
    }

    var emptyTypes: LocalizedStringResource {
        switch self {
        case .verbal: "Text Completion · Sentence Equivalence · Reading Comprehension"
        case .quant: "Quantitative Comparison · Multiple Choice"
        case .essay: "Analyze an Issue · 30 минут"
        case .reading: "Complete the Words · Read in Daily Life · Academic Passage"
        case .listening: "Choose a Response · Conversation · Announcement · Academic Talk"
        case .writing: "Build a Sentence · Write an Email · Academic Discussion"
        case .speaking: "Listen and Repeat · Take an Interview"
        case .words: ""
        }
    }
}
