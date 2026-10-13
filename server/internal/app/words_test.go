package app

import (
	"net/http"
	"net/url"
	"reflect"
	"testing"
)

func TestWords(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	token, _ := e.devSignIn(t, "words", "")
	// Выдуманные слова: коммерческий список никогда не входит в фикстуры.
	e.exec(t, `INSERT INTO words (id, exam_id, lemma, rank, status, part_of_speech, senses, synonyms) VALUES
		('d3f00000-0000-4000-8000-000000000001', 'gre', 'Zorble', 1, 'approved', 'noun', '[{"definition":"An imaginary fixture.","translation":"Выдуманный объект.","example":"A zorble glows.","exampleTranslation":"Зорбл светится."}]', ARRAY['flimble']),
		('d3f00000-0000-4000-8000-000000000002', 'gre', 'zorbling', 1, 'approved', NULL, '[]', '{}'),
		('d3f00000-0000-4000-8000-000000000003', 'gre', 'flimble', 2, 'approved', NULL, '[]', '{}'),
		('d3f00000-0000-4000-8000-000000000004', 'gre', 'draftling', 3, 'draft', NULL, '[]', '{}'),
		('d3f00000-0000-4000-8000-000000000005', 'gre', 'retireling', 4, 'retired', NULL, '[]', '{}'),
		('d3f00000-0000-4000-8000-000000000006', 'toefl', 'foreignling', 1, 'approved', NULL, '[]', '{}')`)
	get := func(path string) resp { return e.do(t, call{method: "GET", path: path, bearer: token}) }
	want := []string{"Zorble", "zorbling", "flimble"}
	for _, limit := range []string{"1", "2", "100"} {
		path := "/api/words?exam=gre&limit=" + limit
		var got []string
		for {
			r := get(path)
			if r.status != http.StatusOK {
				t.Fatalf("list: %d %s", r.status, r.raw)
			}
			for _, raw := range r.body["words"].([]any) {
				word := raw.(map[string]any)
				got = append(got, word["lemma"].(string))
				if len(word) > 3 {
					t.Fatalf("list leaked card: %v", word)
				}
			}
			cursor, ok := r.body["nextCursor"].(string)
			if !ok {
				break
			}
			path = "/api/words?exam=gre&limit=" + limit + "&after=" + url.QueryEscape(cursor)
			if len(got) > 3 {
				t.Fatal("cursor loop")
			}
		}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("pages: %v", got)
		}
	}
	r := get("/api/words?exam=gre&q=ZOR&limit=1")
	if r.status != 200 || r.body["words"].([]any)[0].(map[string]any)["lemma"] != "Zorble" {
		t.Fatalf("prefix: %s", r.raw)
	}
	cursor := r.body["nextCursor"].(string)
	r = get("/api/words?exam=gre&q=zor&after=" + url.QueryEscape(cursor))
	if r.status != 200 || len(r.body["words"].([]any)) != 1 {
		t.Fatalf("prefix page: %s", r.raw)
	}
	for _, query := range []string{"q=f", "exam=toefl"} {
		wantError(t, get("/api/words?exam=gre&"+query+"&after="+url.QueryEscape(cursor)), 400, "bad_request")
	}
	for _, q := range []string{"or", "%", "_", "missing"} {
		r := get("/api/words?exam=gre&q=" + url.QueryEscape(q))
		if r.status != 200 || len(r.body["words"].([]any)) != 0 {
			t.Fatalf("literal prefix %q: %s", q, r.raw)
		}
	}
	r = get("/api/words/d3f00000-0000-4000-8000-000000000001?exam=gre")
	if r.status != 200 || r.body["lemma"] != "Zorble" || len(r.body["senses"].([]any)) != 1 || len(r.body["synonyms"].([]any)) != 1 {
		t.Fatalf("card: %s", r.raw)
	}
	for _, id := range []string{"004", "005", "006", "099"} {
		wantError(t, get("/api/words/d3f00000-0000-4000-8000-000000000"+id+"?exam=gre"), 404, "not_found")
	}
	for _, path := range []string{"/api/words", "/api/words?exam=sat", "/api/words?exam=gre&limit=0", "/api/words?exam=gre&limit=101", "/api/words?exam=gre&limit=no", "/api/words?exam=gre&after=broken", "/api/words/no?exam=gre", "/api/words/d3f00000-0000-4000-8000-000000000001"} {
		wantError(t, get(path), 400, "bad_request")
	}
	wantError(t, e.do(t, call{method: "GET", path: "/api/words?exam=gre"}), 401, "unauthorized")
}

func TestWordsStorageFailures(t *testing.T) {
	t.Parallel()
	for _, senses := range []string{`null`, `{}`, `[{"definition":"a","translation":"б","extra":1}]`, `[{"definition":"","translation":"б"}]`} {
		t.Run(senses, func(t *testing.T) {
			t.Parallel()
			e := newEnv(t, nil)
			token, _ := e.devSignIn(t, "bad-senses", "")
			e.exec(t, `INSERT INTO words (id, exam_id, lemma, rank, status, senses) VALUES ('d3f00000-0000-4000-8000-000000000001','gre','zorble',1,'approved',$1::jsonb)`, senses)
			wantError(t, e.do(t, call{method: "GET", path: "/api/words/d3f00000-0000-4000-8000-000000000001?exam=gre", bearer: token}), 500, "internal")
		})
	}
}

func TestWordsForbiddenThroughHTTP(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	token, id := e.devSignIn(t, "words-without-access", "")
	// Подмена только в базе теста: будущая незнакомая роль не должна получать платный контент.
	e.exec(t, "ALTER TABLE users DROP CONSTRAINT users_role_check")
	e.exec(t, "UPDATE users SET role='editor' WHERE id=$1", id)
	e.exec(t, "ALTER TABLE words RENAME TO unavailable_words")
	for _, path := range []string{"/api/words?exam=gre", "/api/words/d3f00000-0000-4000-8000-000000000001?exam=gre"} {
		wantError(t, e.do(t, call{method: "GET", path: path, bearer: token}), http.StatusForbidden, "forbidden")
	}
}

func TestWordsRejectControlCharacters(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	token, _ := e.devSignIn(t, "words-control-prefix", "")
	for _, q := range []string{"\x00", "\x01", "zor\t", "\u0085"} {
		t.Run(url.QueryEscape(q), func(t *testing.T) {
			wantError(t, e.do(t, call{method: "GET", path: "/api/words?exam=gre&q=" + url.QueryEscape(q), bearer: token}), http.StatusBadRequest, "bad_request")
		})
	}
}
