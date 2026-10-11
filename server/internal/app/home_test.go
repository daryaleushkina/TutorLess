package app

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

func home(t *testing.T, e *env, token, exam, zone string) resp {
	t.Helper()
	return homeWithTypes(t, e, token, exam, zone, "text_completion", "sentence_equivalence", "quantitative_comparison", "multiple_choice")
}

func homeWithTypes(t *testing.T, e *env, token, exam, zone string, types ...string) resp {
	t.Helper()
	// Массив в договоре — form/explode: каждый тип передаётся отдельным параметром, как в options.
	query := url.Values{"exam": {exam}, "tz": {zone}, "types": types}
	return e.do(t, call{method: "GET", path: "/api/home?" + query.Encode(), bearer: token})
}

func requireEmptyHome(t *testing.T, r resp, sections int) {
	t.Helper()
	if r.status != http.StatusOK {
		t.Fatalf("home: %d %s", r.status, r.raw)
	}
	for _, key := range []string{"lastTraining", "weakSpot"} {
		if v, exists := r.body[key]; !exists || v != nil {
			t.Fatalf("%s must be null: %s", key, r.raw)
		}
	}
	if num(r.body["mistakes"]) != 0 {
		t.Fatalf("mistakes: %s", r.raw)
	}
	rows, ok := r.body["sections"].([]any)
	if !ok || len(rows) != sections {
		t.Fatalf("sections: %s", r.raw)
	}
	for _, raw := range rows {
		row := raw.(map[string]any)
		if num(row["total"]) != 0 || num(row["correct"]) != 0 {
			t.Fatalf("nonempty section: %s", r.raw)
		}
	}
	week, ok := r.body["week"].(map[string]any)
	if !ok || num(week["days"]) != 0 || num(week["answers"]) != 0 || num(week["minutes"]) != 0 {
		t.Fatalf("week: %s", r.raw)
	}
}

func TestHomeEmptyAndValidation(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	token, _ := e.devSignIn(t, "home-empty", "")
	requireEmptyHome(t, home(t, e, token, "gre", "UTC"), 3)
	requireEmptyHome(t, home(t, e, token, "toefl", "Asia/Ho_Chi_Minh"), 4)
	requireEmptyHome(t, home(t, e, token, "gre", "Asia/Saigon"), 3)
	requireEmptyHome(t, home(t, e, token, "gre", "US/Pacific"), 3)
	for _, path := range []string{
		"/api/home", "/api/home?exam=gre", "/api/home?tz=UTC", "/api/home?exam=no&tz=UTC",
		"/api/home?exam=gre&tz=", "/api/home?exam=gre&tz=Mars/Olympus", "/api/home?exam=gre&tz=Local",
		"/api/home?exam=gre&tz=../UTC", "/api/home?exam=gre&tz=+07:00",
	} {
		separator := "&"
		if !strings.Contains(path, "?") {
			separator = "?"
		}
		wantError(t, e.do(t, call{method: "GET", path: path + separator + "types=text_completion", bearer: token}), http.StatusBadRequest, "bad_request")
	}
	wantError(t, home(t, e, "", "gre", "UTC"), http.StatusUnauthorized, "unauthorized")
}

// Фикстура истории задаёт сохранённые ответы напрямую: проверяем календарь независимо от часов устройства.
func history(t *testing.T, e *env, token string, request map[string]any, start time.Time, correct int) string {
	t.Helper()
	s := e.start(t, token, request)
	id := s["id"].(string)
	e.exec(t, "UPDATE trainings SET started_at=$2 WHERE id=$1", id, start)
	e.exec(t, `UPDATE training_items SET answered_at=$2::timestamptz + (position+1)*interval '1 minute', correct=(position<$3), elapsed_ms=1000 WHERE training_id=$1`, id, start, correct)
	return id
}

func TestHomeHistoryAndIsolation(t *testing.T) {
	t.Parallel()
	wall := time.Now().UTC()
	midnight := time.Date(wall.Year(), wall.Month(), wall.Day(), 0, 0, 0, 0, time.UTC)
	monday := midnight.AddDate(0, 0, -(int(midnight.Weekday())+6)%7)
	// Среда оставляет всю фикстуру в прошлом даже при запуске теста сразу после полуночи понедельника.
	now := monday.Add(60 * time.Hour)
	e := newEnvWithClock(t, nil, func() time.Time { return now })
	e.seed(t)
	token, _ := e.devSignIn(t, "home-history", "")
	other, _ := e.devSignIn(t, "home-other", "")
	old := monday.AddDate(0, 0, -40)
	history(t, e, token, practice("verbal", 10, "text_completion"), old, 10)
	first := history(t, e, token, practice("verbal", 10, "text_completion"), monday, 2)
	// Повтор тех же десяти заданий: исправляем первые четыре, независимо от случайного порядка.
	second := history(t, e, token, practice("verbal", 10, "text_completion"), monday.Add(time.Hour), 0)
	var fixedIDs []string
	for _, it := range items(t, e.do(t, call{method: "GET", path: "/api/trainings/" + first, bearer: token}).body)[:4] {
		fixedIDs = append(fixedIDs, question(t, it)["id"].(string))
	}
	e.exec(t, "UPDATE training_items SET correct=(question_id::text=ANY($2::text[])) WHERE training_id=$1", second, fixedIDs)
	request := practice("quant", 50, "multiple_choice")
	request["difficulty"] = "medium"
	last := history(t, e, token, request, monday.Add(2*time.Hour), 1)
	// Разделы и последняя тренировка чужого пользователя не попадают в ответ.
	history(t, e, other, practice("quant", 10, "multiple_choice"), monday.Add(3*time.Hour), 0)
	r := home(t, e, token, "gre", "UTC")
	if r.status != http.StatusOK {
		t.Fatalf("home: %d %s", r.status, r.raw)
	}
	lt := r.body["lastTraining"].(map[string]any)
	req := lt["request"].(map[string]any)
	if req["section"] != "quant" || num(req["count"]) != 50 || req["difficulty"] != "medium" || num(lt["size"]) != 3 {
		t.Fatalf("lastTraining: %s", r.raw)
	}
	rows := r.body["sections"].([]any)
	verbal := rows[0].(map[string]any)
	quant := rows[1].(map[string]any)
	if verbal["section"] != "verbal" || num(verbal["total"]) != 30 || num(verbal["correct"]) != 16 || num(quant["total"]) != 3 || num(quant["correct"]) != 1 {
		t.Fatalf("sections: %s", r.raw)
	}
	if num(r.body["mistakes"]) != 8 {
		t.Fatalf("mistakes: %s", r.raw)
	}
	weak := r.body["weakSpot"].(map[string]any)
	if weak["questionType"] != "text_completion" || weak["section"] != "verbal" || weak["accuracy"] != float64(30) {
		t.Fatalf("weakSpot: %s", r.raw)
	}
	week := r.body["week"].(map[string]any)
	if num(week["days"]) != 1 || num(week["answers"]) != 23 || num(week["minutes"]) != 23 {
		t.Fatalf("week: %s", r.raw)
	}
	requireEmptyHome(t, home(t, e, token, "toefl", "UTC"), 4)
	stranger, _ := e.devSignIn(t, "home-stranger", "")
	requireEmptyHome(t, home(t, e, stranger, "gre", "UTC"), 3)
	e.exec(t, "UPDATE training_items SET answered_at=NULL,correct=NULL WHERE training_id=$1", last)
	// Незавершённая и даже неотвеченная сессия всё равно последняя начатая.
	if got := home(t, e, token, "gre", "UTC"); got.body["lastTraining"].(map[string]any)["request"].(map[string]any)["section"] != "quant" {
		t.Fatalf("last started: %s", got.raw)
	}
}

func TestHomeWeakSpotThresholds(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "home-thresholds", "")
	old := time.Now().AddDate(0, 0, -31)
	history(t, e, token, practice("quant", 10, "multiple_choice"), old, 0)
	history(t, e, token, practice("verbal", 9, "text_completion"), time.Now().Add(-time.Hour), 0)
	if r := home(t, e, token, "gre", "UTC"); r.status != 200 || r.body["weakSpot"] != nil {
		t.Fatalf("<10 or >30 days: %s", r.raw)
	}
	history(t, e, token, practice("quant", 5, "multiple_choice"), time.Now().Add(-time.Hour), 3)
	history(t, e, token, practice("quant", 5, "multiple_choice"), time.Now().Add(-30*time.Minute), 4)
	if r := home(t, e, token, "gre", "UTC"); r.body["weakSpot"] != nil {
		t.Fatalf("70 percent: %s", r.raw)
	}
}

func TestHomeStorageFailure(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	token, _ := e.devSignIn(t, "home-broken", "")
	e.exec(t, "ALTER TABLE training_items RENAME TO training_items_gone")
	wantError(t, home(t, e, token, "gre", "UTC"), http.StatusInternalServerError, "internal")
}

func TestHomeWeekCalendarAndDuration(t *testing.T) {
	t.Parallel()
	// Неделя с переводом часов в New York: 169 часов, начало 26 октября 04:00 UTC, конец 2 ноября 05:00 UTC.
	now := time.Date(2026, 11, 1, 18, 0, 0, 0, time.UTC)
	e := newEnvWithClock(t, nil, func() time.Time { return now })
	e.seed(t)
	token, _ := e.devSignIn(t, "home-calendar", "")
	start := time.Date(2026, 10, 26, 4, 0, 0, 0, time.UTC)
	end := time.Date(2026, 11, 2, 5, 0, 0, 0, time.UTC)
	add := func(offset time.Duration, answerAt time.Time, check bool) string {
		t.Helper()
		req := practice("quant", 1, "multiple_choice")
		if check {
			req["mode"] = "check"
		}
		id := history(t, e, token, req, start.Add(offset), 0)
		e.exec(t, "UPDATE training_items SET answered_at=$2 WHERE training_id=$1", id, answerAt)
		return id
	}
	// Время прошлой недели отрезано. Сам понедельник входит, следующий — нет.
	add(-time.Hour, start, false)
	add(-time.Hour, start.Add(-time.Nanosecond), false)
	add(0, start.Add(30*time.Second), false)
	add(0, start.Add(30*time.Second), false)
	// «Проверка» с одним Quant имеет лимит 105 секунд: округление происходит после сложения.
	add(0, start.Add(time.Hour), true)
	// По две стороны полуночи UTC — одна местная дата, по две стороны местной полуночи — разные.
	add(20*time.Hour, start.Add(20*time.Hour+time.Minute), false)
	add(24*time.Hour, start.Add(24*time.Hour+time.Minute), false)
	add(end.Sub(start)-time.Minute, end, false)
	r := home(t, e, token, "gre", "America/New_York")
	if r.status != 200 {
		t.Fatalf("home: %d %s", r.status, r.raw)
	}
	week := r.body["week"].(map[string]any)
	if num(week["days"]) != 2 || num(week["answers"]) != 6 || num(week["minutes"]) != 4 {
		t.Fatalf("DST week: %s", r.raw)
	}
	alias := home(t, e, token, "gre", "US/Eastern")
	if alias.status != http.StatusOK || alias.raw != r.raw {
		t.Fatalf("IANA alias changed calendar: %d %s", alias.status, alias.raw)
	}
	// В UTC оба часа до первых ответов попадают в неделю, но каждый ограничивается пятью минутами.
	utc := home(t, e, token, "gre", "UTC").body["week"].(map[string]any)
	if num(utc["answers"]) != 7 || num(utc["minutes"]) != 14 {
		t.Fatalf("UTC week: %v", utc)
	}
}

func TestHomeLastTrainingLegacyAndMistakesSource(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, _ := e.devSignIn(t, "home-legacy", "")
	history(t, e, token, practice("verbal", 1, "text_completion"), time.Now().Add(-time.Hour), 0)
	req := practice("verbal", 10, "text_completion")
	req["source"] = "mistakes"
	s := e.start(t, token, req)
	r := home(t, e, token, "gre", "UTC")
	last := r.body["lastTraining"].(map[string]any)
	if num(last["size"]) != 1 || last["request"].(map[string]any)["source"] != "mistakes" {
		t.Fatalf("last mistakes: %s", r.raw)
	}
	e.exec(t, "UPDATE trainings SET request=request-'exam' WHERE id=$1", s["id"])
	if r := home(t, e, token, "gre", "UTC"); r.body["lastTraining"].(map[string]any)["request"].(map[string]any)["exam"] != "gre" {
		t.Fatalf("legacy request: %s", r.raw)
	}
	e.exec(t, "UPDATE trainings SET request='[]' WHERE id=$1", s["id"])
	if r := home(t, e, token, "gre", "UTC"); r.status != 200 || r.body["lastTraining"] != nil {
		t.Fatalf("unreadable request: %s", r.raw)
	}
}

func TestHomeStorageFailures(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	token, _ := e.devSignIn(t, "home-stores", "")
	for _, table := range []string{"trainings", "exam_sections", "questions"} {
		// Имена — фиксированные значения теста, не пользовательский ввод.
		e.exec(t, "ALTER TABLE "+table+" RENAME TO "+table+"_gone")
		wantError(t, home(t, e, token, "gre", "UTC"), http.StatusInternalServerError, "internal")
		e.exec(t, "ALTER TABLE "+table+"_gone RENAME TO "+table)
	}
}

func TestHomeWeakSpotRanksAndWindow(t *testing.T) {
	t.Parallel()
	now := time.Now()
	e := newEnvWithClock(t, nil, func() time.Time { return now })
	e.seed(t)
	token, _ := e.devSignIn(t, "home-ranks", "")
	history(t, e, token, practice("verbal", 10, "text_completion"), now.Add(-time.Hour), 4)
	one := history(t, e, token, practice("quant", 5, "multiple_choice"), now.Add(-time.Hour), 1)
	two := history(t, e, token, practice("quant", 5, "multiple_choice"), now.Add(-30*time.Minute), 1)
	r := home(t, e, token, "gre", "UTC")
	if weak := r.body["weakSpot"].(map[string]any); weak["questionType"] != "multiple_choice" || weak["accuracy"] != float64(20) {
		t.Fatalf("worst type: %s", r.raw)
	}
	// Ровно 30 суток входят; ответ раньше границы и ответ из будущего — нет.
	boundary := now.Add(-30 * 24 * time.Hour)
	e.exec(t, "UPDATE training_items SET answered_at=$2 WHERE training_id IN ($1,$3)", one, boundary, two)
	if r := home(t, e, token, "gre", "UTC"); r.body["weakSpot"].(map[string]any)["questionType"] != "multiple_choice" {
		t.Fatalf("inclusive cutoff: %s", r.raw)
	}
	e.exec(t, "UPDATE training_items SET answered_at=$2 WHERE training_id=$1 AND position=0", one, boundary.Add(-time.Microsecond))
	if r := home(t, e, token, "gre", "UTC"); r.body["weakSpot"].(map[string]any)["questionType"] != "text_completion" {
		t.Fatalf("exclusive old answer: %s", r.raw)
	}
	e.exec(t, "UPDATE training_items SET answered_at=$2 WHERE training_id=$1 AND position=0", one, now.Add(time.Hour))
	if r := home(t, e, token, "gre", "UTC"); r.body["weakSpot"].(map[string]any)["questionType"] != "text_completion" {
		t.Fatalf("future answer: %s", r.raw)
	}
}

func TestHomeIsolatesForeignExamHistory(t *testing.T) {
	t.Parallel()
	e := newEnv(t, nil)
	e.seed(t)
	token, uid := e.devSignIn(t, "home-exams", "")
	gre := history(t, e, token, practice("verbal", 1, "text_completion"), time.Now().Add(-time.Hour), 0)
	// Техническая история будущего TOEFL: новый тип пока не поддержан, формат выборочного задания тот же.
	e.exec(t, `INSERT INTO trainings (id,user_id,exam_id,section,mode,question_types,request,started_at)
  VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',$1,'toefl','reading','practice',ARRAY['text_completion'],
  '{"exam":"toefl","section":"reading","questionTypes":["text_completion"],"count":1,"mode":"practice"}',now())`, uid)
	e.exec(t, `INSERT INTO training_items (training_id,position,question_id,answered_at,correct)
  SELECT 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',0,question_id,now(),true FROM training_items WHERE training_id=$1`, gre)
	r := home(t, e, token, "gre", "UTC")
	if num(r.body["mistakes"]) != 1 || r.body["lastTraining"].(map[string]any)["request"].(map[string]any)["exam"] != "gre" {
		t.Fatalf("foreign exam affected GRE: %s", r.raw)
	}
	r = home(t, e, token, "toefl", "UTC")
	reading := r.body["sections"].([]any)[0].(map[string]any)
	if num(r.body["mistakes"]) != 0 || num(reading["total"]) != 1 || num(reading["correct"]) != 1 || r.body["lastTraining"].(map[string]any)["request"].(map[string]any)["exam"] != "toefl" {
		t.Fatalf("TOEFL history: %s", r.raw)
	}
}
