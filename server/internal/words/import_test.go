package words

import (
	"context"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/daryaleushkina/greprepapp/server/internal/testdb"
)

func TestImport(t *testing.T) {
	t.Parallel()
	pool := testdb.New(t)
	f, err := os.Open("testdata/words.csv")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	entries, err := ReadCSV(f, 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 3 || entries[0].Lemma != "zorble" {
		t.Fatalf("top: %v", entries)
	}
	ctx := context.Background()
	for i, status := range []string{"draft", "approved", "draft", "approved"} {
		changed, err := Import(ctx, pool, "gre", entries, status)
		if err != nil {
			t.Fatal(err)
		}
		want := int64(0)
		if i < 2 {
			want = 3
		}
		if changed != want {
			t.Fatalf("step %d (%s): changed %d, want %d", i, status, changed, want)
		}
	}
	_, err = pool.Exec(ctx, `UPDATE words SET part_of_speech='noun', ipa='/z/', audio_key='fixture/z', senses='[{"definition":"A fixture.","translation":"Тестовый объект."}]', synonyms=ARRAY['flimble'], antonyms=ARRAY['plindle'], status='retired' WHERE lemma='zorble'`)
	if err != nil {
		t.Fatal(err)
	}
	read := func(query string) string {
		t.Helper()
		var value string
		if err := pool.QueryRow(ctx, query).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	const state = `SELECT jsonb_agg(to_jsonb(words) ORDER BY rank)::text FROM words`
	before := read(state)
	changed, err := Import(ctx, pool, "gre", entries, "approved")
	if err != nil || changed != 0 {
		t.Fatalf("repeat: %d %v", changed, err)
	}
	after := read(state)
	if before != after {
		t.Fatalf("repeat changed card/status/timestamps")
	}
	// Проверяем сохранность заполненной карточки даже при реальном обновлении рейтинга.
	const content = `SELECT (to_jsonb(words) - 'rank' - 'updated_at')::text FROM words WHERE lemma='zorble'`
	populated := read(content)
	reranked := slices.Clone(entries)
	reranked[0].Rank = 4
	changed, err = Import(ctx, pool, "gre", reranked, "approved")
	if err != nil || changed != 1 {
		t.Fatalf("rerank: %d %v", changed, err)
	}
	if read(content) != populated {
		t.Fatal("rerank replaced populated card or retired status")
	}
	if _, err := Import(ctx, pool, "gre", entries, "approved"); err != nil {
		t.Fatal(err)
	}
	before = read(state)
	bad := append([]Entry{}, entries...)
	bad = append(bad, Entry{Lemma: "", Rank: 4})
	if _, err := Import(ctx, pool, "gre", bad, "approved"); err == nil {
		t.Fatal("bad row accepted")
	}
	after = read(state)
	if before != after {
		t.Fatal("failed import wrote rows")
	}
	// Ошибка базы после первой записи тоже откатывает всю транзакцию.
	_, err = pool.Exec(ctx, `CREATE FUNCTION reject_word() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.lemma='glimlet' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_word BEFORE INSERT ON words FOR EACH ROW EXECUTE FUNCTION reject_word()`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Import(ctx, pool, "gre", []Entry{{Lemma: "thrumple", Rank: 4}, {Lemma: "glimlet", Rank: 5}}, "draft"); err == nil {
		t.Fatal("database failure accepted")
	}
	after = read(state)
	if before != after {
		t.Fatal("transaction did not roll back")
	}
	for _, args := range []struct{ exam, status string }{{"missing", "draft"}, {"gre", "retired"}} {
		if _, err := Import(ctx, pool, args.exam, entries, args.status); err == nil {
			t.Fatal("invalid args accepted")
		}
	}
}

func TestReadCSV(t *testing.T) {
	t.Parallel()
	for name, data := range map[string]string{
		"missing header": "word\nzorble\n", "empty": "rank,word\n", "empty word": "rank,word\n1,\n",
		"duplicate": "rank,word\n1,zorble\n2,Zorble\n", "bad rank": "rank,word\nno,zorble\n",
		"negative": "rank,word\n-1,zorble\n", "overflow": "rank,word\n2147483648,zorble\n",
		"bad csv": "rank,word\n1,\"zorble\n", "bad tail": "rank,word\n1,zorble\n2,\n",
		"columns": "rank,word\n1,zorble,extra\n", "duplicate header": "rank,word,word\n1,zorble,flimble\n",
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := ReadCSV(strings.NewReader(data), 1); err == nil {
				t.Fatal("bad file accepted")
			}
		})
	}
	if _, err := ReadCSV(strings.NewReader("rank,word\n1,zorble\n"), 0); err == nil {
		t.Fatal("zero limit accepted")
	}
}

func TestSenses(t *testing.T) {
	t.Parallel()
	for _, data := range []string{`[]`, `[{"definition":"A fixture.","translation":"Тест.","example":"A zorble.","exampleTranslation":"Зорбл."}]`} {
		if _, err := ParseSenses([]byte(data)); err != nil {
			t.Fatal(err)
		}
	}
	for _, data := range []string{`null`, `{}`, `[] []`, `[{"definition":"a"}]`, `[{"definition":"a","translation":"б","extra":1}]`, `[{"definition":"a","translation":"б","example":null}]`} {
		if _, err := ParseSenses([]byte(data)); err == nil {
			t.Fatalf("accepted %s", data)
		}
	}
}
