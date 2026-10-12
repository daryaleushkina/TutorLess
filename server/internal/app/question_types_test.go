package app

import (
	"encoding/json"
	"net/http"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestLegacyDefaultQuestionTypes(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "legacy-default", "")
	for _, path := range []string{"/api/trainings/options?exam=gre", "/api/home?exam=gre&tz=UTC"} {
		r := e.do(t, call{method: "GET", path: path, bearer: token})
		if r.status != http.StatusOK {
			t.Errorf("default types %s: %d %s", path, r.status, r.raw)
		}
	}
}

const allTrainingCapabilities = "text_completion,sentence_equivalence,quantitative_comparison,multiple_choice,multiple_choice_multi,numeric_entry,select_in_passage,passage,figure"

func capableCall(c call) call {
	c.header = map[string]string{"X-Training-Capabilities": allTrainingCapabilities}
	return c
}

func TestNewQuestionAnswersHTTP(t *testing.T) {
	raw, err := os.ReadFile("../../../api/conformance/question-types.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Answers []struct {
			Name               string
			Question           map[string]any
			Answer             map[string]any
			Correct, BadAnswer bool
		}
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, c := range fixture.Answers {
		t.Run(c.Name, func(t *testing.T) {
			t.Parallel()
			e := newEnv(t, nil)
			e.seed(t)
			token, _ := e.devSignIn(t, "new-answer-"+c.Name, "")
			e.exec(t, "UPDATE questions SET status='draft' WHERE id<>$1", c.Question["id"])
			req := practice(c.Question["section"].(string), 1, c.Question["questionType"].(string))
			r := e.do(t, capableCall(call{method: "POST", path: "/api/trainings", bearer: token, body: req}))
			if r.status != 201 {
				t.Fatalf("new type not delivered: %d %s", r.status, r.raw)
			}
			id := r.body["id"].(string)
			r = e.do(t, capableCall(call{method: "POST", path: "/api/trainings/" + id + "/answers", bearer: token, body: map[string]any{"answers": []any{c.Answer}}}))
			if c.BadAnswer {
				wantError(t, r, 400, "bad_request")
				return
			}
			if r.status != 204 {
				t.Fatalf("answer: %d %s", r.status, r.raw)
			}
			r = e.do(t, capableCall(call{method: "GET", path: "/api/trainings/" + id, bearer: token}))
			it := items(t, r.body)[0]
			if it["correct"] != c.Correct {
				t.Fatalf("stored correct=%v want=%v: %s", it["correct"], c.Correct, r.raw)
			}
			got := it["answer"].(map[string]any)
			if !reflect.DeepEqual(got["numericAnswer"], c.Answer["numericAnswer"]) || got["sentenceId"] != c.Answer["sentenceId"] {
				t.Fatalf("answer form lost: %v", got)
			}
			r = e.do(t, capableCall(call{method: "POST", path: "/api/trainings/" + id + "/finish", bearer: token, body: map[string]any{"finishedAt": time.Now().UTC().Format(time.RFC3339Nano), "timedOut": false}}))
			if r.status != 200 || (num(r.body["correct"]) == 1) != c.Correct {
				t.Fatalf("summary: %d %s", r.status, r.raw)
			}
			answered := len(strs(c.Answer["optionIds"])) > 0 || c.Answer["numericAnswer"] != nil || c.Answer["sentenceId"] != nil
			if (num(r.body["unanswered"]) == 0) != answered {
				t.Fatalf("numeric/sentence incorrectly counted as unanswered: %s", r.raw)
			}
		})
	}
}

func TestNewQuestionCompatibilityAndAccess(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "new-compatibility", "")
	other, _ := e.devSignIn(t, "new-compatibility-other", "")
	for _, request := range []map[string]any{
		practice("quant", 50, "multiple_choice_multi"), practice("quant", 50, "numeric_entry"), practice("verbal", 50, "select_in_passage"), practice("verbal", 50, "multiple_choice"),
	} {
		r := e.do(t, capableCall(call{method: "POST", path: "/api/trainings", bearer: token, body: request}))
		if r.status != 201 {
			t.Fatalf("new session: %d %s", r.status, r.raw)
		}
		id := r.body["id"].(string)
		// Старые клиенты не получают новые формы через историю, итог или повтор запроса из истории.
		wantError(t, e.do(t, call{method: "GET", path: "/api/trainings/" + id, bearer: token}), 409, "unsupported_training")
		finish := map[string]any{"finishedAt": time.Now().UTC().Format(time.RFC3339Nano), "timedOut": false}
		wantError(t, e.do(t, call{method: "POST", path: "/api/trainings/" + id + "/finish", bearer: token, body: finish}), 409, "unsupported_training")
		for _, path := range []string{"/api/trainings/options?exam=gre", "/api/home?exam=gre&tz=UTC"} {
			r := e.do(t, call{method: "GET", path: path, bearer: token})
			if r.status != 200 || strings.Contains(r.raw, "numeric_entry") || strings.Contains(r.raw, "multiple_choice_multi") || strings.Contains(r.raw, "select_in_passage") {
				t.Fatalf("legacy enumeration leaked: %s", r.raw)
			}
			if path == "/api/home?exam=gre&tz=UTC" && r.body["lastTraining"] != nil {
				t.Fatalf("new shape leaked as last request: %s", r.raw)
			}
			if path == "/api/trainings/options?exam=gre" {
				for _, p := range r.body["presets"].([]any) {
					if p.(map[string]any)["kind"] == "last" {
						t.Fatalf("new shape leaked in preset: %s", r.raw)
					}
				}
			}
		}
		for _, c := range []call{{method: "GET", path: "/api/trainings/" + id}, {method: "POST", path: "/api/trainings/" + id + "/answers", body: map[string]any{"answers": []any{answer(0, nil, time.Now())}}}, {method: "POST", path: "/api/trainings/" + id + "/finish", body: finish}} {
			c.bearer = other
			wantError(t, e.do(t, capableCall(c)), 404, "not_found")
			c.bearer = ""
			wantError(t, e.do(t, capableCall(c)), 401, "unauthorized")
		}
		// Новому клиенту доступны свои ошибки; старый клиент не может запустить неизвестный тип тем же запросом.
		answers := []any{}
		for _, it := range items(t, rSession(t, e, token, id).body) {
			answers = append(answers, answer(int(num(it["position"])), nil, time.Now()))
		}
		r = e.do(t, capableCall(call{method: "POST", path: "/api/trainings/" + id + "/answers", bearer: token, body: map[string]any{"answers": answers}}))
		if r.status != 204 {
			t.Fatalf("save mistakes: %s", r.raw)
		}
		request["source"] = "mistakes"
		r = e.do(t, capableCall(call{method: "POST", path: "/api/trainings", bearer: token, body: request}))
		if r.status != 201 {
			t.Fatalf("new mistakes unavailable: %s", r.raw)
		}
		r = e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: request})
		if request["questionTypes"].([]string)[0] == "multiple_choice" {
			wantError(t, r, 409, "no_questions")
		} else {
			wantError(t, r, 400, "bad_request")
		}
	}
	// Старый Quant с multiple_choice получает только прежние задания, хотя этот же тип есть у рисунков.
	r := e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, body: practice("quant", 50, "multiple_choice")})
	if r.status != 201 || strings.Contains(r.raw, "\"figure\"") || strings.Contains(r.raw, "\"passage\"") {
		t.Fatalf("legacy forms leaked: %s", r.raw)
	}
	for _, value := range []string{"", "numeric_entry,unknown", "numeric_entry,", "passage"} {
		wantError(t, e.do(t, call{method: "GET", path: "/api/trainings/options?exam=gre", bearer: token, header: map[string]string{"X-Training-Capabilities": value}}), 400, "bad_request")
	}
}

func rSession(t *testing.T, e *env, token, id string) resp {
	t.Helper()
	r := e.do(t, capableCall(call{method: "GET", path: "/api/trainings/" + id, bearer: token}))
	if r.status != 200 {
		t.Fatal(r.raw)
	}
	return r
}

func TestNewQuestionHomeWeakSpotCompatibility(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "new-weak-spot", "")
	for range 2 {
		r := e.do(t, capableCall(call{method: "POST", path: "/api/trainings", bearer: token, body: practice("quant", 50, "numeric_entry")}))
		if r.status != 201 {
			t.Fatal(r.raw)
		}
		e.exec(t, "UPDATE training_items SET answered_at=now(),correct=false WHERE training_id=$1", r.body["id"])
	}
	modern := e.do(t, capableCall(call{method: "GET", path: "/api/home?exam=gre&tz=UTC", bearer: token}))
	if modern.status != 200 || modern.body["weakSpot"] == nil || modern.body["weakSpot"].(map[string]any)["questionType"] != "numeric_entry" || num(modern.body["mistakes"]) != 6 {
		t.Fatalf("modern home: %s", modern.raw)
	}
	legacy := e.do(t, call{method: "GET", path: "/api/home?exam=gre&tz=UTC", bearer: token})
	if legacy.status != 200 || legacy.body["weakSpot"] != nil || legacy.body["lastTraining"] != nil || num(legacy.body["mistakes"]) != 0 {
		t.Fatalf("new enum on legacy home: %s", legacy.raw)
	}
}
