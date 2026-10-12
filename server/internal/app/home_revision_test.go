package app

import (
	"net/http"
	"testing"
	"time"
)

func TestHomeWeekCapsLongPauses(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	start := time.Date(2026, 11, 2, 9, 0, 0, 0, time.UTC)
	e := newEnvWithClock(t, nil, func() time.Time { return now })
	e.seed(t)
	token, _ := e.devSignIn(t, "home-pauses", "")
	id := history(t, e, token, practice("verbal", 3, "text_completion"), start, 0)
	e.exec(t, `UPDATE training_items SET answered_at=CASE position WHEN 0 THEN $2::timestamptz+interval '1 minute' WHEN 1 THEN $2::timestamptz+interval '1 day 1 minute' ELSE $2::timestamptz+interval '1 day 2 minutes' END WHERE training_id=$1`, id, start)
	r := home(t, e, token, "gre", "UTC")
	week := r.body["week"].(map[string]any)
	if num(week["minutes"]) != 7 || num(week["answers"]) != 3 || num(week["days"]) != 2 {
		t.Fatalf("long pause: want 7 minutes, 3 answers, 2 days; %s", r.raw)
	}
	// В «Проверке» человек может отвечать не по порядку позиций; соседство задаёт answeredAt.
	e.exec(t, `UPDATE training_items SET answered_at=CASE position WHEN 0 THEN $2::timestamptz+interval '1 day 2 minutes' WHEN 1 THEN $2::timestamptz+interval '1 minute' ELSE $2::timestamptz+interval '1 day 1 minute' END WHERE training_id=$1`, id, start)
	if r := home(t, e, token, "gre", "UTC"); num(r.body["week"].(map[string]any)["minutes"]) != 7 {
		t.Fatalf("intervals were ordered by position: %s", r.raw)
	}
}

func TestHomeWeekCapsSessionActiveTime(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC)
	start := time.Date(2026, 11, 2, 9, 0, 0, 0, time.UTC)
	e := newEnvWithClock(t, nil, func() time.Time { return now })
	e.seed(t)
	token, _ := e.devSignIn(t, "home-active-limit", "")
	req := practice("quant", 4, "multiple_choice")
	req["mode"] = "check"
	id := history(t, e, token, req, start, 0)
	e.exec(t, `UPDATE training_items SET answered_at=$2::timestamptz+position*interval '1 day'+interval '1 minute' WHERE training_id=$1`, id, start)
	r := home(t, e, token, "gre", "UTC")
	week := r.body["week"].(map[string]any)
	if num(week["minutes"]) != 7 || num(week["answers"]) != 4 {
		t.Fatalf("active time must stop at 420 seconds: %s", r.raw)
	}
	// После двух ответов активно шесть минут: сутки ожидания ещё не расходуют весь лимит 420 секунд.
	e.exec(t, "UPDATE training_items SET answered_at=NULL,correct=NULL WHERE training_id=$1 AND position>=2", id)
	if r := home(t, e, token, "gre", "UTC"); num(r.body["week"].(map[string]any)["minutes"]) != 6 {
		t.Fatalf("wall-clock pause exhausted active limit: %s", r.raw)
	}
}

func TestHomeWeekIntervalsCrossBoundary(t *testing.T) {
	t.Parallel()
	monday := time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)
	now := monday.Add(60 * time.Hour)
	e := newEnvWithClock(t, nil, func() time.Time { return now })
	e.seed(t)
	token, _ := e.devSignIn(t, "home-boundary", "")
	id := history(t, e, token, practice("verbal", 4, "text_completion"), monday.Add(-10*time.Minute), 0)
	e.exec(t, `UPDATE training_items SET answered_at=CASE position WHEN 0 THEN $2::timestamptz-interval '5 minutes' WHEN 1 THEN $2::timestamptz+interval '1 minute' WHEN 2 THEN $2::timestamptz+interval '1 day 1 minute' ELSE $2::timestamptz+interval '1 day 2 minutes' END WHERE training_id=$1`, id, monday)
	r := home(t, e, token, "gre", "UTC")
	week := r.body["week"].(map[string]any)
	if num(week["minutes"]) != 7 || num(week["answers"]) != 3 || num(week["days"]) != 2 {
		t.Fatalf("previous answer is outside week, its interval is clipped at Monday: %s", r.raw)
	}
	// Начало вне недели и ни одного предыдущего ответа: время до первого ответа не угадываем.
	blank := history(t, e, token, practice("quant", 1, "multiple_choice"), monday.Add(-time.Hour), 0)
	e.exec(t, "UPDATE training_items SET answered_at=$2 WHERE training_id=$1", blank, monday.Add(time.Hour))
	if r := home(t, e, token, "gre", "UTC"); num(r.body["week"].(map[string]any)["minutes"]) != 7 {
		t.Fatalf("first answer after a start in another week: %s", r.raw)
	}
}

func TestHomeWeekDoesNotReuseSessionLimit(t *testing.T) {
	t.Parallel()
	monday := time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)
	now := monday.Add(60 * time.Hour)
	e := newEnvWithClock(t, nil, func() time.Time { return now })
	e.seed(t)
	token, _ := e.devSignIn(t, "home-limit-boundary", "")
	req := practice("quant", 3, "multiple_choice")
	req["mode"] = "check"
	id := history(t, e, token, req, monday.Add(-10*time.Minute), 0)
	// До недели уже потрачено 300 секунд из 315; оставшиеся ответы принесут только 15 секунд.
	e.exec(t, `UPDATE training_items SET answered_at=CASE position WHEN 0 THEN $2::timestamptz-interval '5 minutes' WHEN 1 THEN $2::timestamptz+interval '1 minute' ELSE $2::timestamptz+interval '2 minutes' END WHERE training_id=$1`, id, monday)
	if r := home(t, e, token, "gre", "UTC"); num(r.body["week"].(map[string]any)["minutes"]) != 0 {
		t.Fatalf("session limit was reused across weeks: %s", r.raw)
	}
}

func TestHomeLastTrainingRespectsClientTypes(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "home-client-types", "")
	history(t, e, token, practice("verbal", 3, "text_completion", "sentence_equivalence"), time.Now().Add(-time.Hour), 0)
	for _, types := range [][]string{{"text_completion"}, {"sentence_equivalence"}, {"multiple_choice"}} {
		r := homeWithTypes(t, e, token, "gre", "UTC", types...)
		if r.status != http.StatusOK || r.body["lastTraining"] != nil || num(r.body["mistakes"]) != 3 || num(r.body["sections"].([]any)[0].(map[string]any)["total"]) != 3 {
			t.Fatalf("unsupported request or filtered history for client %v: %s", types, r.raw)
		}
	}
	if r := homeWithTypes(t, e, token, "gre", "UTC", "text_completion", "sentence_equivalence"); r.status != http.StatusOK || r.body["lastTraining"] == nil {
		t.Fatalf("supported request hidden: %s", r.raw)
	}
}

func TestHomeRequiresValidClientTypes(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	token, _ := e.devSignIn(t, "home-types-input", "")
	for _, path := range []string{"/api/home?exam=gre&tz=UTC&types=", "/api/home?exam=gre&tz=UTC&types=not_a_type"} {
		wantError(t, e.do(t, call{method: "GET", path: path, bearer: token}), http.StatusBadRequest, "bad_request")
	}
}

func TestHomeMistakesCountsOnlyApprovedQuestions(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "home-approved-mistakes", "")
	id := history(t, e, token, practice("quant", 5, "multiple_choice"), time.Now().Add(-time.Hour), 0)
	its := items(t, e.do(t, call{method: "GET", path: "/api/trainings/" + id, bearer: token}).body)
	e.exec(t, "UPDATE questions SET status='draft' WHERE id=$1", question(t, its[0])["id"])
	e.exec(t, "UPDATE questions SET status='retired' WHERE id=$1", question(t, its[1])["id"])
	r := home(t, e, token, "gre", "UTC")
	if num(r.body["mistakes"]) != 3 {
		t.Fatalf("draft and retired inflate button count: %s", r.raw)
	}
	req := practice("quant", 50, "multiple_choice")
	req["source"] = "mistakes"
	s := e.start(t, token, req)
	if len(items(t, s)) != num(r.body["mistakes"]) {
		t.Fatalf("button and selection differ: %s / %v", r.raw, s)
	}
	e.exec(t, "UPDATE questions SET status='retired' WHERE question_type='multiple_choice'")
	if r := home(t, e, token, "gre", "UTC"); num(r.body["mistakes"]) != 0 {
		t.Fatalf("unpublished-only mistakes: %s", r.raw)
	}
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: req}), http.StatusConflict, "no_questions")
}
