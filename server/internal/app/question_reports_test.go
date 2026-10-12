package app

import (
	"context"
	"maps"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

func (e *env) reportQuestion(t *testing.T, token, questionID string, body map[string]any) resp {
	t.Helper()
	return e.do(t, call{method: "POST", path: "/api/questions/" + questionID + "/reports", bearer: token, body: body})
}

func reportFixture(t *testing.T) (*env, string, string, string) {
	t.Helper()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "reporter", "")
	s := e.start(t, token, practice("verbal", 1, "sentence_equivalence"))
	tid, _ := s["id"].(string)
	qid, _ := question(t, items(t, s)[0])["id"].(string)
	return e, token, qid, tid
}

func (e *env) reportCount(t *testing.T, want int) {
	t.Helper()
	var n int
	if err := e.pool.QueryRow(context.Background(), "SELECT count(*) FROM question_reports").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != want {
		t.Fatalf("report count = %d, want %d", n, want)
	}
}

func TestQuestionReportRetry(t *testing.T) {
	t.Parallel()
	e, token, qid, tid := reportFixture(t)
	body := map[string]any{"reportId": uuid.NewString(), "kind": "translation", "text": "Опечатка.", "trainingId": tid}
	first := e.reportQuestion(t, token, qid, body)
	if first.status != http.StatusNoContent || first.raw != "" {
		t.Fatalf("first report: %d %s", first.status, first.raw)
	}
	var id int64
	var created time.Time
	if err := e.pool.QueryRow(context.Background(), "SELECT id, created_at FROM question_reports").Scan(&id, &created); err != nil {
		t.Fatal(err)
	}
	// Закрытую в админке жалобу повторная доставка не открывает заново.
	e.exec(t, "UPDATE question_reports SET resolved_at = created_at")
	for range 3 {
		retry := e.reportQuestion(t, token, qid, body)
		if retry.status != first.status || retry.raw != first.raw {
			t.Fatalf("retry: %d %s; first: %d %s", retry.status, retry.raw, first.status, first.raw)
		}
	}
	e.reportCount(t, 1)
	var same bool
	if err := e.pool.QueryRow(context.Background(), "SELECT id = $1 AND created_at = $2 AND resolved_at = $2 FROM question_reports", id, created).Scan(&same); err != nil || !same {
		t.Fatalf("retry changed the record: %v %v", same, err)
	}
}

func TestQuestionReportConflictingPayload(t *testing.T) {
	t.Parallel()
	e, token, qid, tid := reportFixture(t)
	body := map[string]any{"reportId": uuid.NewString(), "kind": "other", "text": "Опечатка.", "trainingId": tid}
	if r := e.reportQuestion(t, token, qid, body); r.status != http.StatusNoContent {
		t.Fatalf("first report: %d %s", r.status, r.raw)
	}
	for _, field := range []string{"text", "kind", "trainingId", "questionId"} {
		t.Run(field, func(t *testing.T) {
			changed := maps.Clone(body)
			questionID := qid
			switch field {
			case "text":
				changed[field] = "Другой текст."
			case "kind":
				changed[field] = "answer"
			case "trainingId":
				delete(changed, field)
			case "questionId":
				questionID = uuid.NewString()
			}
			wantError(t, e.reportQuestion(t, token, questionID, changed), http.StatusConflict, "report_id_conflict")
		})
	}
	e.reportCount(t, 1)
	// Конфликт не переписывает исходное содержимое.
	if r := e.reportQuestion(t, token, qid, body); r.status != http.StatusNoContent {
		t.Fatalf("retry after conflict: %d %s", r.status, r.raw)
	}
}

func TestQuestionReportIDsAreScopedToUser(t *testing.T) {
	t.Parallel()
	e, token, qid, _ := reportFixture(t)
	other, _ := e.devSignIn(t, "other-reporter", "")
	id := uuid.NewString()
	for i, bearer := range []string{token, other} {
		body := map[string]any{"reportId": id, "kind": "other", "text": []string{"Первый текст.", "Второй текст."}[i]}
		for range 2 {
			if r := e.reportQuestion(t, bearer, qid, body); r.status != http.StatusNoContent {
				t.Fatalf("user %d: %d %s", i, r.status, r.raw)
			}
		}
	}
	e.reportCount(t, 2)
	// Чужой ключ не подтверждает существование недоступного задания или жалобы.
	e.exec(t, "UPDATE questions SET status = 'retired' WHERE id = $1", qid)
	third, _ := e.devSignIn(t, "bystander", "")
	wantError(t, e.reportQuestion(t, third, qid, map[string]any{"reportId": id, "kind": "other", "text": "Первый текст."}), http.StatusNotFound, "not_found")
	e.reportCount(t, 2)
}

func TestQuestionReportWithoutIDStillInsertsEveryTime(t *testing.T) {
	t.Parallel()
	e, token, qid, tid := reportFixture(t)
	body := map[string]any{"kind": "other", "text": "Опечатка.", "trainingId": tid}
	for range 2 {
		if r := e.reportQuestion(t, token, qid, body); r.status != http.StatusNoContent {
			t.Fatalf("legacy report: %d %s", r.status, r.raw)
		}
	}
	e.reportCount(t, 2)
}

func TestQuestionReportRetryAfterQuestionRetired(t *testing.T) {
	t.Parallel()
	e, token, _, _ := reportFixture(t)
	qid := "d3f00000-0000-4000-8000-000000000003"
	body := map[string]any{"reportId": uuid.NewString(), "kind": "other"}
	if r := e.reportQuestion(t, token, qid, body); r.status != http.StatusNoContent {
		t.Fatalf("first report: %d %s", r.status, r.raw)
	}
	e.exec(t, "UPDATE questions SET status = 'retired' WHERE id = $1", qid)
	if r := e.reportQuestion(t, token, qid, body); r.status != http.StatusNoContent {
		t.Fatalf("retry on retired question: %d %s", r.status, r.raw)
	}
	e.reportCount(t, 1)
	// Отсутствующий text и пустая строка — разные тела жалобы.
	changed := maps.Clone(body)
	changed["text"] = ""
	wantError(t, e.reportQuestion(t, token, qid, changed), http.StatusConflict, "report_id_conflict")
}

func TestQuestionReportConcurrentRetries(t *testing.T) {
	t.Parallel()
	e, token, qid, tid := reportFixture(t)
	body := map[string]any{"reportId": uuid.NewString(), "kind": "other", "text": "Опечатка.", "trainingId": tid}
	results := make([]resp, 12)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range results {
		wg.Go(func() {
			<-start
			results[i] = e.reportQuestion(t, token, qid, body)
		})
	}
	close(start)
	wg.Wait()
	for _, r := range results {
		if r.status != http.StatusNoContent || r.raw != "" {
			t.Fatalf("concurrent retry: %d %s", r.status, r.raw)
		}
	}
	e.reportCount(t, 1)
}

func TestQuestionReportConcurrentConflictingPayloads(t *testing.T) {
	t.Parallel()
	e, token, qid, _ := reportFixture(t)
	id := uuid.NewString()
	texts := []string{"Первый текст.", "Второй текст."}
	results := make([]resp, 12)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range results {
		wg.Go(func() {
			<-start
			results[i] = e.reportQuestion(t, token, qid, map[string]any{"reportId": id, "kind": "other", "text": texts[i%2]})
		})
	}
	close(start)
	wg.Wait()
	e.reportCount(t, 1)
	var text string
	if err := e.pool.QueryRow(context.Background(), "SELECT text FROM question_reports").Scan(&text); err != nil {
		t.Fatal(err)
	}
	for i, r := range results {
		if texts[i%2] == text {
			if r.status != http.StatusNoContent {
				t.Fatalf("winning payload retry: %d %s", r.status, r.raw)
			}
		} else {
			wantError(t, r, http.StatusConflict, "report_id_conflict")
		}
	}
}

func TestQuestionReportInvalidID(t *testing.T) {
	t.Parallel()
	e, token, qid, _ := reportFixture(t)
	for _, id := range []any{"", "not-a-uuid", nil, 42} {
		wantError(t, e.reportQuestion(t, token, qid, map[string]any{"reportId": id, "kind": "other"}), http.StatusBadRequest, "bad_request")
	}
	e.reportCount(t, 0)
	wantError(t, e.reportQuestion(t, "", qid, map[string]any{"reportId": uuid.NewString(), "kind": "other"}), http.StatusUnauthorized, "unauthorized")
}

func TestQuestionReportLookupStorageFailure(t *testing.T) {
	t.Parallel()
	e, token, qid, _ := reportFixture(t)
	e.exec(t, "ALTER TABLE question_reports RENAME TO question_reports_gone")
	r := e.reportQuestion(t, token, qid, map[string]any{"reportId": uuid.NewString(), "kind": "other"})
	wantError(t, r, http.StatusInternalServerError, "internal")
	if r.body["message"] != "internal error" {
		t.Fatalf("storage error leaks details: %s", r.raw)
	}
}
