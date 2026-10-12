package devseed

import (
	"fmt"
	"math/big"
	"slices"
	"testing"

	"github.com/daryaleushkina/greprepapp/server/internal/training"
)

// Второй проход: ожидания получены решением условий, до чтения Answer/NumericAnswer.
func TestNewSeedIndependentSolutions(t *testing.T) {
	answers := map[int][]string{}
	for n := 1; n <= 10; n++ {
		if n%2 == 0 && n > 2 {
			answers[27] = append(answers[27], string(rune('A'+n-1)))
		}
	}
	answers[28] = []string{"A", "B", "C"} // 3/3, 6/3 и 9/3 — целые.
	answers[29] = []string{"A"}           // Разности East − West: 6, 4, 2.
	answers[30] = []string{"A", "C"}      // Рост выдач и отсутствие разделения читателей — явные утверждения текста.
	answers[31] = []string{"A", "B"}      // Часы работы продлены, школьный период начался.
	answers[32] = []string{"A", "B"}      // Время сократилось, расход топлива тот же; ночных испытаний нет.
	answers[39] = []string{"s2"}          // Второе изменение — начало школьного периода.
	answers[40] = []string{"s4"}          // Вывод о невозможности выделить одну причину.
	answers[41] = []string{"s4"}          // Условие испытания — только дневной свет.
	answers[42] = []string{"B"}           // Совпавшие изменения не позволяют выделить влияние часов.
	answers[43] = []string{"D"}           // (18 − 6) / 6 = 2, то есть рост на 200%.
	values := map[int]*big.Rat{
		33: big.NewRat(14, 4), 34: training.RoundedValue(big.NewRat(7, 8), 2),
		35: big.NewRat(6+10+14+18, 1), 36: big.NewRat(3, 3+3), 37: big.NewRat(15, 45),
		38: new(big.Rat).Sub(big.NewRat(1, 4), big.NewRat(5, 8)),
	}
	set, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	found := 0
	for _, q := range set.Questions {
		var id int
		if _, err := fmt.Sscanf(q.ID.String()[24:], "%d", &id); err != nil {
			t.Fatal(err)
		}
		if id < 27 {
			continue
		}
		found++
		if expected, ok := answers[id]; ok {
			if !slices.Equal(q.Answer, expected) {
				t.Errorf("%d: independent=%v key=%v", id, expected, q.Answer)
			}
			continue
		}
		expected, ok := values[id]
		if !ok {
			t.Fatalf("question %d has no independent solution", id)
		}
		raw := q.NumericAnswer
		if raw == nil {
			t.Fatalf("question %d has no numeric key", id)
		}
		var key *big.Rat
		if raw.Number != "" {
			key, ok = new(big.Rat).SetString(raw.Number)
		} else {
			key, ok = new(big.Rat).SetString(raw.Numerator + "/" + raw.Denominator)
		}
		if !ok {
			t.Fatalf("invalid key %d", id)
		}
		if places := q.Body.NumericEntry.DecimalPlaces; places != nil {
			key = training.RoundedValue(key, *places)
		}
		if expected.Cmp(key) != 0 {
			t.Errorf("%d: independent=%s key=%s", id, expected, key)
		}
	}
	if found != len(answers)+len(values) {
		t.Fatalf("only %d independently solved questions", found)
	}
}
