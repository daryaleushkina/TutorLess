package training

import (
	"encoding/json"
	"math"
	"strings"
	"testing"
)

// JSON позволяет красному тесту проверить правило до появления новых полей Go.
func TestNewQuestionShapes(t *testing.T) {
	cases := []struct{ name, typ, body, key, numeric string }{
		{"multiple answers", "multiple_choice_multi", `{"prompt":"Select all even integers.","groups":[{"options":[{"id":"A","text":"2"},{"id":"B","text":"3"},{"id":"C","text":"4"}]}],"selectCount":0}`, `["A","C"]`, `null`},
		{"decimal", "numeric_entry", `{"prompt":"What is seven divided by two?","groups":[],"selectCount":0,"numericEntry":{"format":"number"}}`, `[]`, `{"number":"3.5"}`},
		{"fraction", "numeric_entry", `{"prompt":"What fraction is three of six?","groups":[],"selectCount":0,"numericEntry":{"format":"fraction"}}`, `[]`, `{"numerator":"1","denominator":"2"}`},
		{"sentence", "select_in_passage", `{"prompt":"Select the sentence describing a limitation.","groups":[],"selectCount":0,"passage":{"id":"p","paragraphs":[{"sentences":[{"id":"s1","text":"The sample was small."}]}]}}`, `["s1"]`, `null`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			q := Question{Type: Type(c.typ), Explanation: Explanation{Solution: Text{Ru: "Разбор.", En: "Solution."}}}
			if err := json.Unmarshal([]byte(c.body), &q.Body); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal([]byte(c.key), &q.Answer); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal([]byte(`{"numericAnswer":`+c.numeric+`}`), &q); err != nil {
				t.Fatal(err)
			}
			if c.typ == "multiple_choice_multi" {
				q.Explanation.Options = whyNot(q.Answer, q.Body.Groups...)
			}
			if err := Validate(q); err != nil {
				t.Fatalf("valid %s rejected: %v", c.name, err)
			}
		})
	}
}

func TestNewQuestionValidationRejectsBrokenMaterials(t *testing.T) {
	passage := func() *Passage {
		return &Passage{ID: "p", Paragraphs: []Paragraph{{Sentences: []Sentence{{ID: "s1", Text: "First."}, {ID: "s2", Text: "Second."}}}}}
	}
	figure := func() *Figure {
		return &Figure{ID: "f", Kind: "table", Title: "Data", Categories: []string{"Day"}, Series: []Series{{ID: "a", Label: "Orders", Values: []float64{1}}}, Description: "One order."}
	}
	for _, mutate := range []func(*Passage){
		func(p *Passage) { p.ID = "" }, func(p *Passage) { p.Paragraphs = nil },
		func(p *Passage) { p.Paragraphs[0].Sentences = nil }, func(p *Passage) { p.Paragraphs[0].Sentences[1].ID = "s1" },
		func(p *Passage) { p.Paragraphs[0].Sentences[0].Text = "" },
	} {
		p := passage()
		mutate(p)
		if err := ValidatePassage(*p); err == nil {
			t.Error("broken passage accepted")
		}
	}
	for _, mutate := range []func(*Figure){
		func(f *Figure) { f.ID = "" }, func(f *Figure) { f.Kind = "pie" }, func(f *Figure) { f.Description = "" },
		func(f *Figure) { f.Series[0].Values = nil }, func(f *Figure) { f.Series = append(f.Series, f.Series[0]) },
		func(f *Figure) { f.Series[0].Values[0] = math.Inf(1) }, func(f *Figure) { f.Categories[0] = "" },
		func(f *Figure) { f.XLabel = strings.Repeat("x", 201) }, func(f *Figure) { f.Categories = nil },
	} {
		f := figure()
		mutate(f)
		if err := ValidateFigure(*f); err == nil {
			t.Error("broken figure accepted")
		}
	}
	q := Question{Type: NumericEntry, Body: Body{Prompt: "Enter a number.", Groups: []Group{}, NumericEntry: &NumericSpec{Format: "number"}}, NumericAnswer: &NumericResponse{Number: "1.25"}, Explanation: Explanation{Solution: Text{Ru: "Разбор.", En: "Solution."}}}
	for _, mutate := range []func(*Question){
		func(q *Question) { q.Body.NumericEntry = nil }, func(q *Question) { q.Body.NumericEntry.Format = "unknown" },
		func(q *Question) { p := 13; q.Body.NumericEntry.DecimalPlaces = &p }, func(q *Question) { q.NumericAnswer = nil },
		func(q *Question) { q.NumericAnswer.Number = "NaN" }, func(q *Question) { q.Answer = []string{"A"} },
		func(q *Question) { q.Body.Passage = passage() }, func(q *Question) { q.Body.Groups = []Group{opts("A", "B")} },
	} {
		raw, err := json.Marshal(q)
		if err != nil {
			t.Fatal(err)
		}
		var broken Question
		if err := json.Unmarshal(raw, &broken); err != nil {
			t.Fatal(err)
		}
		mutate(&broken)
		if err := Validate(broken); err == nil {
			t.Error("broken numeric shape accepted")
		}
	}
	multi := question(MultipleChoiceMulti, "Select all.", 0, []string{"A", "B", "C", "D", "E", "F", "G", "H", "I", "J"}, opts("A", "B", "C", "D", "E", "F", "G", "H", "I", "J"))
	if err := Validate(multi); err != nil {
		t.Fatal(err)
	}
	if correct, err := CheckResponse(multi, Response{OptionIDs: multi.Answer}); !correct || err != nil {
		t.Fatalf("ten answers: %v %v", correct, err)
	}
	multi.Body.Groups[0].Options = append(multi.Body.Groups[0].Options, Option{ID: "K", Text: "11"})
	if err := Validate(multi); err == nil {
		t.Error("eleven options accepted")
	}
}

func TestNumericRoundingNegativeMidpoint(t *testing.T) {
	p := 2
	q := Question{Type: NumericEntry, Body: Body{NumericEntry: &NumericSpec{Format: "number", DecimalPlaces: &p}}, NumericAnswer: &NumericResponse{Number: "-0.005"}}
	for value, want := range map[string]bool{"-0.01": true, "-0.0100": true, "0": false, "-0.005": false} {
		got, err := CheckResponse(q, Response{Numeric: &NumericResponse{Number: value}})
		if err != nil || got != want {
			t.Errorf("%s: got %v %v want %v", value, got, err, want)
		}
	}
}
