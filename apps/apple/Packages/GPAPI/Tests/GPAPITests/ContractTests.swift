import Foundation
import GPAPI
import Testing

@Suite("Договор API для установленного интерфейса")
struct ContractTests {
    @Test func questionTypesMatchImplementedScreens() {
        #expect(
            Components.Schemas.QuestionType.allCases.map(\.rawValue) == [
                "text_completion", "sentence_equivalence", "quantitative_comparison", "multiple_choice",
            ])
    }

    @Test func numericFieldsRoundTrip() throws {
        let decoder = JSONDecoder()
        let number = try decoder.decode(Components.Schemas.NumericAnswer.self, from: Data(#"{"number":"3.50"}"#.utf8))
        #expect(number.number == "3.50")
        #expect(number.numerator == nil)
        let fraction = try decoder.decode(
            Components.Schemas.NumericAnswer.self, from: Data(#"{"numerator":"3","denominator":"6"}"#.utf8))
        #expect(fraction.numerator == "3")
        #expect(fraction.denominator == "6")
        let encoded = try JSONEncoder().encode(fraction)
        #expect(try decoder.decode(Components.Schemas.NumericAnswer.self, from: encoded).denominator == "6")
        let spec = try decoder.decode(
            Components.Schemas.NumericEntry.self, from: Data(#"{"format":"number","decimalPlaces":2}"#.utf8))
        #expect(spec.decimalPlaces == 2)
    }

    @Test func passagePreservesSentenceIDs() throws {
        let raw =
            #"{"id":"reading","paragraphs":[{"sentences":[{"id":"s1","text":"A short passage."}]}],"futureField":true}"#
        let passage = try JSONDecoder().decode(Components.Schemas.Passage.self, from: Data(raw.utf8))
        #expect(passage.paragraphs[0].sentences[0].id == "s1")
    }

    @Test func structuredFigurePreservesData() throws {
        let raw =
            #"{"id":"fig","kind":"bar","title":"Orders","xLabel":"Day","yLabel":"Orders","unit":"orders","categories":["1","2"],"series":[{"id":"a","label":"Orders","values":[6,10]}],"description":"6 and 10 orders."}"#
        let figure = try JSONDecoder().decode(Components.Schemas.DataFigure.self, from: Data(raw.utf8))
        #expect(figure.kind == .bar)
        #expect(figure.series[0].values == [6, 10])
    }
}
