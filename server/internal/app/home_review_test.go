package app

import (
	"net/http"
	"testing"
	"time"
)

func TestHomeWeekMissingMidnightBounds(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name        string
		answer      time.Time
		wantAnswers int
	}{
		{"previous_sunday", time.Date(2026, 8, 31, 3, 30, 0, 0, time.UTC), 0},
		{"monday_start", time.Date(2026, 8, 31, 4, 0, 0, 0, time.UTC), 1},
		{"last_sunday_hour", time.Date(2026, 9, 7, 2, 30, 0, 0, time.UTC), 1},
		{"next_monday", time.Date(2026, 9, 7, 3, 0, 0, 0, time.UTC), 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			now := time.Date(2026, 9, 7, 2, 45, 0, 0, time.UTC)
			e := newEnvWithClock(t, nil, func() time.Time { return now })
			e.seed(t)
			token, _ := e.devSignIn(t, "home-missing-midnight-bounds", "")
			// Santiago: предыдущее воскресенье исключено, последний час текущего — включён.
			history(t, e, token, practice("quant", 1, "multiple_choice"), tc.answer.Add(-time.Minute), 0)
			r := home(t, e, token, "gre", "America/Santiago")
			if r.status != http.StatusOK {
				t.Fatalf("home: %d %s", r.status, r.raw)
			}
			week := r.body["week"].(map[string]any)
			if num(week["answers"]) != tc.wantAnswers || num(week["days"]) != tc.wantAnswers {
				t.Fatalf("want %d answers and days at %v: %s", tc.wantAnswers, tc.answer, r.raw)
			}
		})
	}
}

func TestHomeWeekMissingMidnightDays(t *testing.T) {
	t.Parallel()
	// В субботу начало недели вычисляется верно даже старым кодом: проверяем отдельно dayStarts.
	now := time.Date(2026, 9, 6, 3, 45, 0, 0, time.UTC)
	e := newEnvWithClock(t, nil, func() time.Time { return now })
	e.seed(t)
	token, _ := e.devSignIn(t, "home-missing-midnight-days", "")
	// 5 сентября 22:30 и 23:30 в Santiago — одна местная дата по обе стороны ложной границы.
	history(t, e, token, practice("quant", 1, "multiple_choice"), time.Date(2026, 9, 6, 2, 29, 0, 0, time.UTC), 0)
	history(t, e, token, practice("quant", 1, "multiple_choice"), time.Date(2026, 9, 6, 3, 29, 0, 0, time.UTC), 0)
	r := home(t, e, token, "gre", "America/Santiago")
	if r.status != http.StatusOK {
		t.Fatalf("home: %d %s", r.status, r.raw)
	}
	week := r.body["week"].(map[string]any)
	if num(week["days"]) != 1 || num(week["answers"]) != 2 || num(week["minutes"]) != 2 {
		t.Fatalf("Saturday counted as two dates: %s", r.raw)
	}
	// Первый существующий момент воскресенья — 01:00; он должен открывать второй день.
	history(t, e, token, practice("quant", 1, "multiple_choice"), time.Date(2026, 9, 6, 3, 59, 0, 0, time.UTC), 0)
	r = home(t, e, token, "gre", "America/Santiago")
	week = r.body["week"].(map[string]any)
	if num(week["days"]) != 2 || num(week["answers"]) != 3 {
		t.Fatalf("first existing Sunday instant not counted: %s", r.raw)
	}
}

func TestHomeWeekCrossingIntervalConsumesLimitBeforeMonday(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name          string
		startMinutes  int
		answerMinutes int
		check         bool
		wantMinutes   int
	}{
		// Два Quant дают лимит 210 с. До понедельника потрачено 240 с: новой неделе ничего не остаётся.
		{"exhausted", -4, -2, true, 0},
		// Из 210 с до понедельника потрачено 120 с: остаются 90 с, то есть одна полная минута.
		{"partially_remaining", -2, -1, true, 1},
		// Длинный интервал ограничен 300 с, включая его часть до начала недели.
		{"long_pause", -12, -11, true, 0},
		{"without_limit", -4, -2, false, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			monday := time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)
			e := newEnvWithClock(t, nil, func() time.Time { return monday.Add(12 * time.Hour) })
			e.seed(t)
			token, _ := e.devSignIn(t, "home-crossing-interval-limit", "")
			req := practice("quant", 2, "multiple_choice")
			if tc.check {
				req["mode"] = "check"
			}
			id := history(t, e, token, req, monday.Add(time.Duration(tc.startMinutes)*time.Minute), 0)
			e.exec(t, `UPDATE training_items SET answered_at=CASE position WHEN 0 THEN $2::timestamptz ELSE $3::timestamptz END WHERE training_id=$1`,
				id, monday.Add(time.Duration(tc.answerMinutes)*time.Minute), monday.Add(2*time.Minute))
			r := home(t, e, token, "gre", "UTC")
			if r.status != http.StatusOK {
				t.Fatalf("home: %d %s", r.status, r.raw)
			}
			week := r.body["week"].(map[string]any)
			if num(week["minutes"]) != tc.wantMinutes || num(week["answers"]) != 1 || num(week["days"]) != 1 {
				t.Fatalf("want %d minutes, 1 answer and day: %s", tc.wantMinutes, r.raw)
			}
		})
	}
}
