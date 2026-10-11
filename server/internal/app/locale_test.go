package app

import (
	"net/http"
	"testing"
)

func TestSetLocalePersistsAndIsolatesAccount(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	token, uid := e.devSignIn(t, "locale-owner", "")
	other, _ := e.devSignIn(t, "locale-other", "")
	for _, locale := range []string{"en", "ru", "en"} {
		r := e.do(t, call{method: "PUT", path: "/api/me/locale", bearer: token, body: map[string]any{"locale": locale}})
		if r.status != http.StatusOK || r.body["id"] != uid || r.body["locale"] != locale || r.body["activeExam"] != nil {
			t.Fatalf("locale: %d %s", r.status, r.raw)
		}
		again, _ := e.devSignIn(t, "locale-owner", "")
		if me := e.do(t, call{method: "GET", path: "/api/me", bearer: again}); me.body["locale"] != locale {
			t.Fatalf("account locale: %s", me.raw)
		}
	}
	if me := e.do(t, call{method: "GET", path: "/api/me", bearer: other}); me.body["locale"] != "ru" {
		t.Fatalf("other account changed: %s", me.raw)
	}
	for _, raw := range []string{`{}`, `{"locale":"de"}`, `{"locale":"EN"}`, `{"locale":null}`, `{"locale":1}`, `{"locale":"ru","userId":"` + uid + `"}`, `[]`, `{"locale":"ru"} {}`} {
		wantError(t, e.do(t, call{method: "PUT", path: "/api/me/locale", bearer: token, rawBody: raw}), http.StatusBadRequest, "bad_request")
	}
	wantError(t, e.do(t, call{method: "PUT", path: "/api/me/locale", body: map[string]any{"locale": "ru"}}), http.StatusUnauthorized, "unauthorized")
	if me := e.do(t, call{method: "GET", path: "/api/me", bearer: token}); me.body["locale"] != "en" {
		t.Fatalf("invalid input changed locale: %s", me.raw)
	}
}

func TestLocaleStorageFailureDoesNotChangeAccount(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	token, _ := e.devSignIn(t, "locale-broken", "")
	e.exec(t, "ALTER TABLE identities RENAME TO identities_gone")
	wantError(t, e.do(t, call{method: "PUT", path: "/api/me/locale", bearer: token, body: map[string]any{"locale": "en"}}), http.StatusInternalServerError, "internal")
	e.exec(t, "ALTER TABLE identities_gone RENAME TO identities")
	if r := e.do(t, call{method: "GET", path: "/api/me", bearer: token}); r.body["locale"] != "ru" {
		t.Fatalf("failed change persisted: %s", r.raw)
	}
}

func TestLocaleUpdateStorageFailure(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	token, _ := e.devSignIn(t, "locale-update-broken", "")
	e.exec(t, `CREATE FUNCTION reject_locale() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''test update failure''; END'`)
	e.exec(t, "CREATE TRIGGER reject_locale BEFORE UPDATE OF locale ON users FOR EACH ROW EXECUTE FUNCTION reject_locale()")
	wantError(t, e.do(t, call{method: "PUT", path: "/api/me/locale", bearer: token, body: map[string]any{"locale": "en"}}), http.StatusInternalServerError, "internal")
	if r := e.do(t, call{method: "GET", path: "/api/me", bearer: token}); r.body["locale"] != "ru" {
		t.Fatalf("failed update: %s", r.raw)
	}
}
