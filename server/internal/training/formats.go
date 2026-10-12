package training

import (
	"fmt"
	"math"
	"math/big"
	"regexp"
	"slices"
	"unicode/utf8"
)

// NumericSpec — вид поля и требуемое округление результата (решение Даши 12.10.2026).
type NumericSpec struct {
	Format        string `json:"format"`
	DecimalPlaces *int   `json:"decimalPlaces,omitempty"`
}
type NumericResponse struct {
	Number      string `json:"number,omitempty"`
	Numerator   string `json:"numerator,omitempty"`
	Denominator string `json:"denominator,omitempty"`
}
type Sentence struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}
type Paragraph struct {
	Sentences []Sentence `json:"sentences"`
}
type Passage struct {
	ID         string      `json:"id"`
	Paragraphs []Paragraph `json:"paragraphs"`
}
type Series struct {
	ID     string    `json:"id"`
	Label  string    `json:"label"`
	Values []float64 `json:"values"`
}
type Figure struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	Title       string   `json:"title"`
	XLabel      string   `json:"xLabel"`
	YLabel      string   `json:"yLabel"`
	Unit        string   `json:"unit"`
	Categories  []string `json:"categories"`
	Series      []Series `json:"series"`
	Description string   `json:"description"`
}

// FitsSection учитывает оба раздела для выбора вариантов: RC и Quant используют один формат.
func FitsSection(t Type, s Section) bool {
	return SectionOf(t) == s || ((t == MultipleChoice || t == MultipleChoiceMulti) && s == Verbal)
}

func hasSentence(p *Passage, id string) bool {
	if p == nil {
		return false
	}
	for _, paragraph := range p.Paragraphs {
		for _, sentence := range paragraph.Sentences {
			if sentence.ID == id {
				return true
			}
		}
	}
	return false
}

func ValidatePassage(p Passage) error {
	if !bounded(p.ID, 64) || len(p.Paragraphs) == 0 || len(p.Paragraphs) > 20 {
		return invalid("passage id or paragraphs")
	}
	seen := map[string]bool{}
	for _, paragraph := range p.Paragraphs {
		if len(paragraph.Sentences) == 0 || len(paragraph.Sentences) > 50 {
			return invalid("passage sentences")
		}
		for _, s := range paragraph.Sentences {
			if !bounded(s.ID, 16) || !bounded(s.Text, 4000) || seen[s.ID] {
				return invalid("passage sentence %q", s.ID)
			}
			seen[s.ID] = true
		}
	}
	return nil
}
func bounded(s string, n int) bool { return s != "" && utf8.RuneCountInString(s) <= n }
func ValidateFigure(f Figure) error {
	if !bounded(f.ID, 64) || !slices.Contains([]string{"bar", "line", "table"}, f.Kind) || !bounded(f.Title, 200) || !bounded(f.Description, 8000) {
		return invalid("figure metadata")
	}
	if utf8.RuneCountInString(f.XLabel) > 200 || utf8.RuneCountInString(f.YLabel) > 200 || utf8.RuneCountInString(f.Unit) > 100 {
		return invalid("figure labels")
	}
	if len(f.Categories) == 0 || len(f.Categories) > 100 || len(f.Series) == 0 || len(f.Series) > 20 {
		return invalid("figure dimensions")
	}
	for _, c := range f.Categories {
		if !bounded(c, 200) {
			return invalid("figure category")
		}
	}
	seen := map[string]bool{}
	for _, s := range f.Series {
		if !bounded(s.ID, 16) || !bounded(s.Label, 200) || seen[s.ID] || len(s.Values) != len(f.Categories) {
			return invalid("figure series %q", s.ID)
		}
		seen[s.ID] = true
		for _, v := range s.Values {
			if math.IsNaN(v) || math.IsInf(v, 0) {
				return invalid("nonfinite figure value")
			}
		}
	}
	return nil
}

func validateMaterials(q Question) error {
	b := q.Body
	if b.NumericEntry != nil {
		if q.Type != NumericEntry || !slices.Contains([]string{"number", "fraction"}, b.NumericEntry.Format) {
			return invalid("numeric format")
		}
		if p := b.NumericEntry.DecimalPlaces; p != nil && (*p < 0 || *p > 12 || b.NumericEntry.Format != "number") {
			return invalid("rounding requires number format and 0..12 places")
		}
	}
	if b.Passage != nil {
		if q.Type != MultipleChoice && q.Type != MultipleChoiceMulti && q.Type != SelectInPassage {
			return invalid("passage outside reading comprehension")
		}
		if err := ValidatePassage(*b.Passage); err != nil {
			return err
		}
	}
	if b.Figure != nil {
		if b.Passage != nil || (q.Type != MultipleChoice && q.Type != MultipleChoiceMulti && q.Type != NumericEntry) {
			return invalid("figure outside data interpretation")
		}
		if err := ValidateFigure(*b.Figure); err != nil {
			return err
		}
	}
	return nil
}

var (
	decimalPattern = regexp.MustCompile(`^-?([0-9]+(\.[0-9]*)?|\.[0-9]+)$`)
	integerPattern = regexp.MustCompile(`^-?[0-9]+$`)
)

func numericValue(a NumericResponse, format string) (*big.Rat, error) {
	bad := func() (*big.Rat, error) { return nil, fmt.Errorf("%w: numeric format", ErrBadAnswer) }
	switch format {
	case "number":
		if a.Numerator != "" || a.Denominator != "" || len(a.Number) > 128 || !decimalPattern.MatchString(a.Number) {
			return bad()
		}
		r, ok := new(big.Rat).SetString(a.Number)
		if !ok {
			return bad()
		}
		return r, nil
	case "fraction":
		if a.Number != "" || len(a.Numerator) > 128 || len(a.Denominator) > 128 || !integerPattern.MatchString(a.Numerator) || !integerPattern.MatchString(a.Denominator) {
			return bad()
		}
		n, ok := new(big.Int).SetString(a.Numerator, 10)
		if !ok {
			return bad()
		}
		d, ok := new(big.Int).SetString(a.Denominator, 10)
		if !ok || d.Sign() == 0 {
			return bad()
		}
		return new(big.Rat).SetFrac(n, d), nil
	default:
		return bad()
	}
}

// RoundedValue округляет точный ключ; ответ человека не округляется, иначе лишние знаки засчитывались бы.
func RoundedValue(value *big.Rat, places int) *big.Rat {
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(places)), nil)
	n := new(big.Int).Mul(value.Num(), scale)
	sign := n.Sign()
	n.Abs(n)
	whole, remainder := new(big.Int), new(big.Int)
	whole.QuoRem(n, value.Denom(), remainder)
	if new(big.Int).Lsh(remainder, 1).Cmp(value.Denom()) >= 0 {
		whole.Add(whole, big.NewInt(1))
	}
	if sign < 0 {
		whole.Neg(whole)
	}
	return new(big.Rat).SetFrac(whole, scale)
}

// Response — ответ любой формы; пустая форма означает пропуск, а не число ноль.
type Response struct {
	OptionIDs  []string
	Numeric    *NumericResponse
	SentenceID string
	DontKnow   bool
}

func (a Response) Answered() bool {
	return len(a.OptionIDs) > 0 || a.Numeric != nil || a.SentenceID != ""
}

func CheckResponse(q Question, a Response) (bool, error) {
	bad := func() (bool, error) { return false, fmt.Errorf("%w: conflicting answer forms", ErrBadAnswer) }
	if a.DontKnow && a.Answered() {
		return bad()
	}
	switch q.Type {
	case NumericEntry:
		if len(a.OptionIDs) > 0 || a.SentenceID != "" {
			return bad()
		}
		if a.Numeric == nil {
			return false, nil
		}
		got, err := numericValue(*a.Numeric, q.Body.NumericEntry.Format)
		if err != nil {
			return false, err
		}
		key, err := numericValue(*q.NumericAnswer, q.Body.NumericEntry.Format)
		if err != nil {
			// Повреждённый ключ — ошибка контента сервера, а не неверный ввод человека.
			return false, invalid("numeric key: %v", err)
		}
		if p := q.Body.NumericEntry.DecimalPlaces; p != nil {
			key = RoundedValue(key, *p)
		}
		return got.Cmp(key) == 0, nil
	case SelectInPassage:
		if len(a.OptionIDs) > 0 || a.Numeric != nil {
			return bad()
		}
		if a.SentenceID == "" {
			return false, nil
		}
		if !hasSentence(q.Body.Passage, a.SentenceID) {
			return false, fmt.Errorf("%w: unknown sentence", ErrBadAnswer)
		}
		return len(q.Answer) == 1 && q.Answer[0] == a.SentenceID, nil
	default:
		if a.Numeric != nil || a.SentenceID != "" {
			return bad()
		}
		return CheckAnswer(q, a.OptionIDs, a.DontKnow)
	}
}
