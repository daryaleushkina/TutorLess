package app

import (
	"net/http"
	"testing"
	"time"
)

func TestInvalidCapabilitiesRejectEveryTrainingEndpoint(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "invalid-capabilities", "")
	req := practice("quant", 1, "numeric_entry")
	r := e.do(t, capableCall(call{method: "POST", path: "/api/trainings", bearer: token, body: req}))
	if r.status != http.StatusCreated {
		t.Fatal(r.raw)
	}
	id := r.body["id"].(string)
	calls := []call{
		{method: "GET", path: "/api/home?exam=gre&tz=UTC"},
		{method: "GET", path: "/api/trainings/options?exam=gre"},
		{method: "POST", path: "/api/trainings", body: req},
		{method: "GET", path: "/api/trainings/" + id},
		{method: "POST", path: "/api/trainings/" + id + "/answers", body: map[string]any{"answers": []any{answer(0, nil, time.Now())}}},
		{method: "POST", path: "/api/trainings/" + id + "/finish", body: map[string]any{"finishedAt": time.Now().UTC().Format(time.RFC3339Nano), "timedOut": false}},
	}
	for _, header := range []string{"numeric_entry,unknown", "passage,figure", "numeric_entry,"} {
		for _, c := range calls {
			t.Run(header+"/"+c.method+"/"+c.path, func(t *testing.T) {
				c.bearer = token
				c.header = map[string]string{"X-Training-Capabilities": header}
				wantError(t, e.do(t, c), http.StatusBadRequest, "bad_request")
			})
		}
	}
	r = rSession(t, e, token, id)
	if r.body["finishedAt"] != nil || items(t, r.body)[0]["answer"] != nil {
		t.Fatalf("invalid capabilities changed session: %s", r.raw)
	}
}

func TestPartialCapabilitiesRequireBothTypeAndMaterial(t *testing.T) {
	for _, c := range []struct{ name, qid, section, typ, material, otherMaterial string }{
		{"reading multi", "d3f00000-0000-4000-8000-000000000030", "verbal", "multiple_choice_multi", "passage", "figure"},
		{"numeric figure", "d3f00000-0000-4000-8000-000000000035", "quant", "numeric_entry", "figure", "passage"},
		{"legacy reading choice", "d3f00000-0000-4000-8000-000000000042", "verbal", "multiple_choice", "passage", "figure"},
		{"legacy figure choice", "d3f00000-0000-4000-8000-000000000043", "quant", "multiple_choice", "figure", "passage"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			e := newEnv(t, nil)
			e.seed(t)
			token, _ := e.devSignIn(t, "partial-capabilities", "")
			e.exec(t, "UPDATE questions SET status='draft' WHERE id<>$1", c.qid)
			req := practice(c.section, 1, c.typ)
			withHeader := func(value string, request call) call {
				request.bearer = token
				if value != "" {
					request.header = map[string]string{"X-Training-Capabilities": value}
				}
				return request
			}
			full := c.typ + "," + c.material
			r := e.do(t, withHeader(full, call{method: "POST", path: "/api/trainings", body: req}))
			if r.status != http.StatusCreated || len(items(t, r.body)) != 1 || question(t, items(t, r.body)[0])[c.material] == nil {
				t.Fatalf("supported material missing: %s", r.raw)
			}
			id := r.body["id"].(string)
			incomplete := []string{c.typ, c.typ + "," + c.otherMaterial}
			if c.typ == "multiple_choice" {
				incomplete = append(incomplete, "")
			}
			for _, header := range incomplete {
				opts := e.do(t, withHeader(header, call{method: "GET", path: "/api/trainings/options?exam=gre"}))
				if opts.status != http.StatusOK {
					t.Fatal(opts.raw)
				}
				for _, raw := range opts.body["types"].([]any) {
					if topics := raw.(map[string]any)["topics"].([]any); len(topics) != 0 {
						t.Fatalf("unsupported material counted in catalog: %s", opts.raw)
					}
				}
				for _, raw := range opts.body["presets"].([]any) {
					if raw.(map[string]any)["kind"] == "last" {
						t.Fatalf("unsupported last training offered: %s", opts.raw)
					}
				}
				home := e.do(t, withHeader(header, call{method: "GET", path: "/api/home?exam=gre&tz=UTC"}))
				if home.status != http.StatusOK || home.body["lastTraining"] != nil {
					t.Fatalf("unsupported last training on home: %s", home.raw)
				}
				wantError(t, e.do(t, withHeader(header, call{method: "POST", path: "/api/trainings", body: req})), http.StatusConflict, "no_questions")
				for _, request := range []call{
					{method: "GET", path: "/api/trainings/" + id},
					{method: "POST", path: "/api/trainings/" + id + "/answers", body: map[string]any{"answers": []any{answer(0, nil, time.Now())}}},
					{method: "POST", path: "/api/trainings/" + id + "/finish", body: map[string]any{"finishedAt": time.Now().UTC().Format(time.RFC3339Nano), "timedOut": false}},
				} {
					wantError(t, e.do(t, withHeader(header, request)), http.StatusConflict, "unsupported_training")
				}
			}
			// Отказ в ответе и итоге не меняет сессию и не вырезает неподдержанные позиции.
			r = e.do(t, withHeader(full, call{method: "GET", path: "/api/trainings/" + id}))
			if r.status != http.StatusOK || len(items(t, r.body)) != 1 || r.body["finishedAt"] != nil || items(t, r.body)[0]["answer"] != nil {
				t.Fatalf("unsupported requests changed session: %s", r.raw)
			}
		})
	}
}

func TestCapabilitiesNormalizeAndIntersectQueryTypes(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "capability-intersection", "")
	header := map[string]string{"X-Training-Capabilities": " numeric_entry, multiple_choice_multi, numeric_entry, figure, figure "}
	r := e.do(t, call{method: "GET", path: "/api/trainings/options?exam=gre&types=numeric_entry&types=multiple_choice", bearer: token, header: header})
	if r.status != http.StatusOK {
		t.Fatal(r.raw)
	}
	types := r.body["types"].([]any)
	if len(types) != 1 || types[0].(map[string]any)["questionType"] != "numeric_entry" {
		t.Fatalf("query broadened or duplicated capabilities: %s", r.raw)
	}
	count := 0
	for _, topic := range types[0].(map[string]any)["topics"].([]any) {
		available := topic.(map[string]any)["available"].(map[string]any)
		count += num(available["easy"]) + num(available["medium"]) + num(available["hard"])
	}
	if count != 6 {
		t.Fatalf("query lost figure capability: %s", r.raw)
	}
	wantError(t, e.do(t, call{method: "POST", path: "/api/trainings", bearer: token, header: header, body: practice("quant", 1, "multiple_choice")}), http.StatusBadRequest, "bad_request")
}
