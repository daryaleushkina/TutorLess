package training

import (
	"errors"
	"testing"
)

func TestNewQuestionValidationRejectsInconsistentShapes(t *testing.T) {
	t.Parallel()
	passage := func() *Passage {
		return &Passage{ID: "p", Paragraphs: []Paragraph{{Sentences: []Sentence{{ID: "s1", Text: "First."}}}}}
	}
	figure := func() *Figure {
		return &Figure{ID: "f", Kind: "bar", Title: "Data", Description: "One value.", Categories: []string{"A"}, Series: []Series{{ID: "v", Label: "Value", Values: []float64{1}}}}
	}
	multi := func() Question {
		return question(MultipleChoiceMulti, "Select two.", 2, []string{"A", "C"}, opts("A", "B", "C"))
	}
	sentence := func() Question {
		return Question{Type: SelectInPassage, Body: Body{Prompt: "Select a sentence.", Passage: passage()}, Answer: []string{"s1"}, Explanation: Explanation{Solution: Text{Ru: "Разбор.", En: "Solution."}}}
	}
	cases := []struct {
		name   string
		make   func() Question
		mutate func(*Question)
	}{
		{"multi missing group", multi, func(q *Question) { q.Body.Groups = nil }},
		{"multi one option", multi, func(q *Question) { q.Body.Groups[0].Options = q.Body.Groups[0].Options[:1] }},
		{"multi negative select count", multi, func(q *Question) { q.Body.SelectCount = -1 }},
		{"multi too many required choices", multi, func(q *Question) { q.Body.SelectCount = 4 }},
		{"multi empty key", multi, func(q *Question) { q.Answer = nil }},
		{"multi key below select count", multi, func(q *Question) { q.Answer = []string{"A"} }},
		{"multi numeric key", multi, func(q *Question) { q.NumericAnswer = &NumericResponse{Number: "1"} }},
		{"reading multi needs three options", multi, func(q *Question) {
			q.Body.Passage = passage()
			q.Body.Groups[0].Options = append(q.Body.Groups[0].Options, Option{ID: "D", Text: "Fourth"})
		}},
		{"reading multi broken passage", multi, func(q *Question) { q.Body.Passage = passage(); q.Body.Passage.ID = "" }},
		{"multi broken figure", multi, func(q *Question) { q.Body.Figure = figure(); q.Body.Figure.Series[0].Values = nil }},
		{"multi both materials", multi, func(q *Question) { q.Body.Passage = passage(); q.Body.Figure = figure() }},
		{"sentence missing passage", sentence, func(q *Question) { q.Body.Passage = nil }},
		{"sentence option group", sentence, func(q *Question) { q.Body.Groups = []Group{opts("A", "B")} }},
		{"sentence select count", sentence, func(q *Question) { q.Body.SelectCount = 1 }},
		{"sentence unknown key", sentence, func(q *Question) { q.Answer = []string{"other"} }},
		{"sentence multiple keys", sentence, func(q *Question) { q.Answer = []string{"s1", "s1"} }},
		{"sentence figure", sentence, func(q *Question) { q.Body.Passage = nil; q.Body.Figure = figure() }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			q := c.make()
			if err := Validate(q); err != nil {
				t.Fatalf("valid fixture rejected: %v", err)
			}
			c.mutate(&q)
			if err := Validate(q); !errors.Is(err, ErrInvalid) {
				t.Fatalf("inconsistent question: %v, want ErrInvalid", err)
			}
		})
	}
}

func TestNumericKeyErrorIsDistinctFromResponseError(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, format string
		valid, bad   NumericResponse
	}{
		{"number", "number", NumericResponse{Number: "3.5"}, NumericResponse{Number: "NaN"}},
		{"fraction", "fraction", NumericResponse{Numerator: "1", Denominator: "2"}, NumericResponse{Numerator: "1", Denominator: "0"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			q := Question{Type: NumericEntry, Body: Body{NumericEntry: &NumericSpec{Format: c.format}}, NumericAnswer: &c.valid}
			correct, err := CheckResponse(q, Response{Numeric: &c.valid})
			if !correct || err != nil {
				t.Fatalf("valid response and key: %v, %v", correct, err)
			}
			correct, err = CheckResponse(q, Response{Numeric: &c.bad})
			if correct || !errors.Is(err, ErrBadAnswer) || errors.Is(err, ErrInvalid) {
				t.Fatalf("invalid user input: %v, %v", correct, err)
			}
			q.NumericAnswer = &c.bad
			correct, err = CheckResponse(q, Response{Numeric: &c.valid})
			if correct || !errors.Is(err, ErrInvalid) || errors.Is(err, ErrBadAnswer) {
				t.Fatalf("invalid server key: %v, %v", correct, err)
			}
		})
	}
}

func TestCheckAnswerHandlesNewTypesAndRejectsConflictingSkip(t *testing.T) {
	t.Parallel()
	for _, typ := range []Type{NumericEntry, SelectInPassage} {
		for _, dontKnow := range []bool{false, true} {
			correct, err := CheckAnswer(Question{Type: typ}, nil, dontKnow)
			if correct || err != nil {
				t.Errorf("empty answer %s, dontKnow=%v: %v, %v", typ, dontKnow, correct, err)
			}
		}
	}
	q := question(MultipleChoiceMulti, "Select all.", 0, []string{"A", "C"}, opts("A", "B", "C"))
	if correct, err := CheckAnswer(q, []string{"A"}, true); correct || !errors.Is(err, ErrBadAnswer) {
		t.Fatalf("skip with selected options: %v, %v", correct, err)
	}
}
