import GPAPI
import SwiftUI

typealias TodayStateDTO = Components.Schemas.StepState

/// Раздел подготовки и его цвета: узел ленты, подпись и мягкая поверхность (DESIGN.md, «Цвета разделов»).
enum StudySection: String, Hashable, Sendable, CaseIterable {
    case verbal, quant, words, essay

    init(_ dto: Components.Schemas.Section) {
        switch dto {
        case .verbal: self = .verbal
        case .quant: self = .quant
        case .words: self = .words
        case .essay: self = .essay
        // Новые разделы пока не приходят на экраны GRE; оформление заменит редизайн.
        case .reading, .listening, .speaking: self = .verbal
        case .writing: self = .essay
        }
    }

    /// Названия разделов GRE остаются английскими и в русском интерфейсе — как на экзамене.
    var label: LocalizedStringResource {
        switch self {
        case .verbal: "Verbal"
        case .quant: "Quant"
        case .words: "Слова"
        case .essay: "Эссе"
        }
    }

    var color: Color {
        switch self {
        case .verbal: Color(.verbal)
        case .quant: Color(.quant)
        case .words: Color(.words)
        case .essay: Color(.essay)
        }
    }

    /// Контрастный оттенок для подписей и цифр; базовый color — только для меток и заливок.
    var ink: Color {
        switch self {
        case .verbal: Color(.verbalInk)
        case .quant: Color(.quantInk)
        case .words: Color(.wordsInk)
        case .essay: Color(.essayInk)
        }
    }

    var tint: Color {
        switch self {
        case .verbal: Color(.verbalSoft)
        case .quant: Color(.quantSoft)
        case .words: Color(.wordsSoft)
        case .essay: Color(.essaySoft)
        }
    }

    /// Значок узла — SF Symbols: на Apple иконки системные (impeccable, iOS).
    var symbol: String {
        switch self {
        case .verbal: "text.bubble"
        case .quant: "function"
        case .words: "rectangle.on.rectangle"
        case .essay: "pencil.line"
        }
    }
}
