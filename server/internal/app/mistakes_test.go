package app

import (
	"net/http"
	"testing"
	"time"
)

func TestMistakesTrainingUsesLatestOwnApprovedAnswers(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "mistakes-owner", "")
	other, _ := e.devSignIn(t, "mistakes-other", "")
	request := practice("verbal", 50, "text_completion")
	request["source"] = "mistakes"
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: request}), http.StatusConflict, "no_questions")
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", body: request}), http.StatusUnauthorized, "unauthorized")
	// Чужие ошибки не превращают пустую собственную историю в доступный набор.
	history(t, e, other, practice("verbal", 10, "text_completion"), time.Now().Add(-time.Hour), 0)
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: request}), http.StatusConflict, "no_questions")
	s := e.start(t, token, practice("verbal", 10, "text_completion"))
	id := s["id"].(string)
	its := items(t, s)
	for pos, it := range its {
		a := answer(pos, nil, time.Now())
		a["dontKnow"] = true
		if pos == 0 {
			a = answer(pos, strs(question(t, it)["answer"]), time.Now())
		}
		if r := e.submit(t, token, id, a); r.status != http.StatusNoContent {
			t.Fatalf("answer: %d %s", r.status, r.raw)
		}
	}
	// Чужой последний верный ответ не исправляет свою ошибку.
	history(t, e, other, practice("verbal", 10, "text_completion"), time.Now().Add(time.Hour), 10)
	draft := question(t, its[1])["id"]
	retired := question(t, its[2])["id"]
	e.exec(t, "UPDATE questions SET status='draft' WHERE id=$1", draft)
	e.exec(t, "UPDATE questions SET status='retired' WHERE id=$1", retired)
	retry := e.start(t, token, request)
	if len(items(t, retry)) != 7 {
		t.Fatalf("mistakes selection: %v", retry)
	}
	for _, it := range items(t, retry) {
		q := question(t, it)
		if q["id"] == draft || q["id"] == retired || q["id"] == question(t, its[0])["id"] {
			t.Fatalf("ineligible question: %v", q)
		}
	}
	// Исправление убирает задание из очереди; оставленные без ответа позиции ничего не меняют.
	q := question(t, items(t, retry)[0])
	if r := e.submit(t, token, retry["id"].(string), answer(0, strs(q["answer"]), time.Now())); r.status != http.StatusNoContent {
		t.Fatalf("correction: %s", r.raw)
	}
	if next := e.start(t, token, request); len(items(t, next)) != 6 {
		t.Fatalf("corrected mistake returned: %v", next)
	}
	request["section"] = "quant"
	request["questionTypes"] = []string{"multiple_choice"}
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: request}), http.StatusConflict, "no_questions")
	request["exam"] = "toefl"
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: request}), http.StatusBadRequest, "bad_request")
	request["exam"] = "gre"
	request["source"] = "wrong"
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: request}), http.StatusBadRequest, "bad_request")
	request["source"] = nil
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: request}), http.StatusBadRequest, "bad_request")
	request["source"] = "catalog"
	if catalog := e.start(t, token, request); len(items(t, catalog)) != 5 {
		t.Fatalf("explicit catalog: %v", catalog)
	}
}

func TestMistakesTrainingFiltersAndChronology(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "mistakes-filters", "")
	old := history(t, e, token, practice("verbal", 10, "text_completion"), time.Now().Add(-time.Hour), 0)
	fresh := history(t, e, token, practice("verbal", 10, "text_completion"), time.Now().Add(-30*time.Minute), 10)
	req := practice("verbal", 10, "text_completion")
	req["source"] = "mistakes"
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: req}), http.StatusConflict, "no_questions")
	// Позже начатая сессия с более ранним ответом не возвращает исправленное задание в ошибки.
	e.exec(t, "UPDATE trainings SET started_at=now() WHERE id=$1", old)
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: req}), http.StatusConflict, "no_questions")
	e.exec(t, "UPDATE training_items SET correct=false WHERE training_id=$1", fresh)
	req["difficulty"] = "easy"
	s := e.start(t, token, req)
	if len(items(t, s)) != 1 || question(t, items(t, s)[0])["difficulty"] != "easy" {
		t.Fatalf("difficulty: %v", s)
	}
	q := question(t, items(t, s)[0])
	topic := q["topicId"]
	req["topicIds"] = []any{topic}
	req["count"] = 1
	req["mode"] = "check"
	if got := e.start(t, token, req); len(items(t, got)) != 1 || got["timeLimitSeconds"] == nil {
		t.Fatalf("topic/count/mode: %v", got)
	}
	req["difficulty"] = "hard"
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: req}), http.StatusConflict, "no_questions")
	req["topicIds"] = []string{"no-topic"}
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: req}), http.StatusBadRequest, "bad_request")
}
