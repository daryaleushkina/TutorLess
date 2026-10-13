package migrations_test

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/daryaleushkina/greprepapp/server/internal/testdb"
)

func TestWordsContractConstraints(t *testing.T) {
	t.Parallel()
	pool := testdb.New(t)
	ctx := context.Background()
	longArray := make([]string, 101)
	for i := range longArray {
		longArray[i] = "zorble"
	}
	cases := []struct {
		name, column string
		value        any
	}{
		{"part empty", "part_of_speech", ""},
		{"part long", "part_of_speech", strings.Repeat("n", 129)},
		{"ipa empty", "ipa", ""},
		{"ipa long", "ipa", strings.Repeat("ɪ", 257)},
		{"audio empty", "audio_key", ""},
		{"audio long", "audio_key", strings.Repeat("k", 513)},
	}
	for _, column := range []string{"synonyms", "antonyms"} {
		cases = append(cases,
			struct {
				name, column string
				value        any
			}{column + " too many", column, longArray},
			struct {
				name, column string
				value        any
			}{column + " empty item", column, []string{""}},
			struct {
				name, column string
				value        any
			}{column + " long item", column, []string{strings.Repeat("ж", 129)}},
			struct {
				name, column string
				value        any
			}{column + " null item", column, "{NULL}"},
			struct {
				name, column string
				value        any
			}{column + " nested", column, "{{zorble,flimble},{glimlet,plindle}}"},
		)
	}
	for i, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := pool.Exec(ctx, fmt.Sprintf("INSERT INTO words (exam_id,lemma,rank,%s) VALUES ('gre',$1,1,$2)", c.column), fmt.Sprintf("fixture-%d", i), c.value)
			var pg *pgconn.PgError
			if !errors.As(err, &pg) || pg.Code != "23514" {
				t.Fatalf("out-of-contract %s must fail CHECK: %v", c.name, err)
			}
		})
	}
	// Границы считаются в символах, а не байтах; NULL метаданных и пустые массивы допустимы.
	full := make([]string, 100)
	for i := range full {
		full[i] = strings.Repeat("ж", 128)
	}
	for i, args := range [][]any{
		{nil, nil, nil, []string{}, []string{}},
		{strings.Repeat("n", 128), strings.Repeat("ɪ", 256), strings.Repeat("k", 512), full, full},
	} {
		_, err := pool.Exec(ctx, `INSERT INTO words (exam_id,lemma,rank,part_of_speech,ipa,audio_key,synonyms,antonyms) VALUES ('gre',$1,1,$2,$3,$4,$5,$6)`, append([]any{fmt.Sprintf("valid-fixture-%d", i)}, args...)...)
		if err != nil {
			t.Fatalf("valid contract boundary: %v", err)
		}
	}
}
