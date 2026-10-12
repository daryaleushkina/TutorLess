package app

import (
	"context"
	"net/http"
	"testing"
	"time"
)

func TestNumericKeyFailureIsNotBadUserInput(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "invalid-numeric-key", "")
	e.exec(t, "UPDATE questions SET status='draft' WHERE id<>$1", "d3f00000-0000-4000-8000-000000000033")
	r := e.do(t, capableCall(call{method: "POST", path: "/api/trainings", bearer: token, body: practice("quant", 1, "numeric_entry")}))
	if r.status != http.StatusCreated {
		t.Fatal(r.raw)
	}
	id := r.body["id"].(string)
	e.exec(t, `UPDATE questions SET numeric_answer='{"number":"NaN"}' WHERE id=$1`, question(t, items(t, r.body)[0])["id"])
	a := answer(0, nil, time.Now())
	a["numericAnswer"] = map[string]any{"number": "3.5"}
	r = e.do(t, capableCall(call{method: "POST", path: "/api/trainings/" + id + "/answers", bearer: token, body: map[string]any{"answers": []any{a}}}))
	wantError(t, r, http.StatusInternalServerError, "internal")
	if r.body["message"] != "internal error" {
		t.Fatalf("numeric key failure leaked: %s", r.raw)
	}
	if got := items(t, rSession(t, e, token, id).body)[0]; got["answer"] != nil || got["correct"] != nil {
		t.Fatalf("failed answer was saved: %v", got)
	}
}

func TestNewQuestionStoredJSONFailures(t *testing.T) {
	for _, c := range []struct {
		name, qid, section, typ, corrupt string
		storedAnswer                     bool
	}{
		{"numeric key", "d3f00000-0000-4000-8000-000000000033", "quant", "numeric_entry", `UPDATE questions SET numeric_answer='[]' WHERE id=$1`, false},
		{"passage", "d3f00000-0000-4000-8000-000000000039", "verbal", "select_in_passage", `UPDATE question_passages SET body='[]' WHERE id=(SELECT passage_id FROM questions WHERE id=$1)`, false},
		{"figure", "d3f00000-0000-4000-8000-000000000043", "quant", "multiple_choice", `UPDATE question_figures SET body='[]' WHERE id=(SELECT figure_id FROM questions WHERE id=$1)`, false},
		{"saved numeric answer", "d3f00000-0000-4000-8000-000000000033", "quant", "numeric_entry", `UPDATE training_items SET numeric_answer='[]', answered_at=now() WHERE question_id=$1`, true},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			e := newEnv(t, nil)
			e.seed(t)
			token, _ := e.devSignIn(t, "corrupt-owner", "")
			other, _ := e.devSignIn(t, "corrupt-other", "")
			e.exec(t, "UPDATE questions SET status='draft' WHERE id<>$1", c.qid)
			req := practice(c.section, 1, c.typ)
			r := e.do(t, capableCall(call{method: "POST", path: "/api/trainings", bearer: token, body: req}))
			if r.status != http.StatusCreated {
				t.Fatal(r.raw)
			}
			id := r.body["id"].(string)
			e.exec(t, c.corrupt, c.qid)
			get := call{method: "GET", path: "/api/trainings/" + id, bearer: token}
			wantInternalError(t, e.do(t, capableCall(get)))
			if !c.storedAnswer {
				wantInternalError(t, e.do(t, capableCall(call{method: "POST", path: "/api/trainings", bearer: token, body: req})))
				wantInternalError(t, e.do(t, capableCall(call{method: "POST", path: get.path + "/answers", bearer: token, body: map[string]any{"answers": []any{answer(0, nil, time.Now())}}})))
			}
			// Вход и владелец проверяются раньше чтения повреждённого материала.
			get.bearer = other
			wantError(t, e.do(t, capableCall(get)), http.StatusNotFound, "not_found")
			get.bearer = ""
			wantError(t, e.do(t, capableCall(get)), http.StatusUnauthorized, "unauthorized")
		})
	}
}

func wantInternalError(t *testing.T, r resp) {
	t.Helper()
	wantError(t, r, http.StatusInternalServerError, "internal")
	if r.body["message"] != "internal error" {
		t.Fatalf("storage failure leaked: %s", r.raw)
	}
}

func TestNewAnswerDatabaseFailureRollsBackBatch(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "numeric-write-failure", "")
	// Два точных ключа без округления: проверяется восстановление записи, а не правило округления.
	e.exec(t, "UPDATE questions SET status='draft' WHERE id NOT IN ($1,$2)", "d3f00000-0000-4000-8000-000000000033", "d3f00000-0000-4000-8000-000000000036")
	r := e.do(t, capableCall(call{method: "POST", path: "/api/trainings", bearer: token, body: practice("quant", 2, "numeric_entry")}))
	if r.status != http.StatusCreated || len(items(t, r.body)) != 2 {
		t.Fatalf("two numeric questions: %s", r.raw)
	}
	id := r.body["id"].(string)
	answers := []any{}
	for _, it := range items(t, r.body) {
		a := answer(num(it["position"]), nil, time.Now())
		a["numericAnswer"] = question(t, it)["numericAnswer"]
		answers = append(answers, a)
	}
	// Второй UPDATE падает после успешного первого: частичный пакет недопустим.
	e.exec(t, "ALTER TABLE training_items ADD CONSTRAINT reject_second_numeric CHECK (position <> 1 OR numeric_answer IS NULL)")
	submit := capableCall(call{method: "POST", path: "/api/trainings/" + id + "/answers", bearer: token, body: map[string]any{"answers": answers}})
	wantInternalError(t, e.do(t, submit))
	for _, it := range items(t, rSession(t, e, token, id).body) {
		if it["answer"] != nil || it["correct"] != nil {
			t.Fatalf("partially saved batch: %v", it)
		}
	}
	e.exec(t, "ALTER TABLE training_items DROP CONSTRAINT reject_second_numeric")
	if r := e.do(t, submit); r.status != http.StatusNoContent {
		t.Fatalf("retry after storage recovery: %s", r.raw)
	}
	finish := capableCall(call{method: "POST", path: "/api/trainings/" + id + "/finish", bearer: token, body: map[string]any{"finishedAt": time.Now().UTC().Format(time.RFC3339Nano), "timedOut": false}})
	e.exec(t, "ALTER TABLE trainings ADD CONSTRAINT reject_finish CHECK (finished_at IS NULL)")
	wantInternalError(t, e.do(t, finish))
	if r := rSession(t, e, token, id); r.body["finishedAt"] != nil {
		t.Fatalf("failed finish changed session: %s", r.raw)
	}
	e.exec(t, "ALTER TABLE trainings DROP CONSTRAINT reject_finish")
	if r := e.do(t, finish); r.status != http.StatusOK || num(r.body["correct"]) != 2 {
		t.Fatalf("finish after storage recovery: %s", r.raw)
	}
}

func TestNewTrainingDatabaseFailureRollsBackCreation(t *testing.T) {
	for _, c := range []struct{ name, constraint, restore string }{
		{"training", "ALTER TABLE trainings ADD CONSTRAINT reject_numeric CHECK (NOT ('numeric_entry'=ANY(question_types)))", "ALTER TABLE trainings DROP CONSTRAINT reject_numeric"},
		{"items", "ALTER TABLE training_items ADD CONSTRAINT reject_second_item CHECK (position <> 1)", "ALTER TABLE training_items DROP CONSTRAINT reject_second_item"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			e := newEnv(t, nil)
			e.seed(t)
			token, _ := e.devSignIn(t, "numeric-create-failure", "")
			e.exec(t, c.constraint)
			start := capableCall(call{method: "POST", path: "/api/trainings", bearer: token, body: practice("quant", 2, "numeric_entry")})
			wantInternalError(t, e.do(t, start))
			var sessions, positions int
			if err := e.pool.QueryRow(context.Background(), "SELECT (SELECT count(*) FROM trainings), (SELECT count(*) FROM training_items)").Scan(&sessions, &positions); err != nil {
				t.Fatal(err)
			}
			if sessions != 0 || positions != 0 {
				t.Fatalf("partial training: %d sessions, %d positions", sessions, positions)
			}
			e.exec(t, c.restore)
			if r := e.do(t, start); r.status != http.StatusCreated || len(items(t, r.body)) != 2 {
				t.Fatalf("start after storage recovery: %s", r.raw)
			}
		})
	}
}
