package migrations_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/daryaleushkina/greprepapp/server/internal/migrations"
	"github.com/daryaleushkina/greprepapp/server/internal/testdb"
)

func TestQuestionTypesMigrationPreservesOldWrites(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	pool := testdb.New(t)
	sqlDB := stdlib.OpenDBFromPool(pool)
	t.Cleanup(func() {
		if err := sqlDB.Close(); err != nil {
			t.Error(err)
		}
	})
	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrations.FS())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := provider.DownTo(ctx, 3); err != nil {
		t.Fatal(err)
	}
	exec := func(query string) {
		t.Helper()
		if _, err := pool.Exec(ctx, query); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO topics(id,section,title_ru,title_en) VALUES('old','quant','Тема','Topic')`)
	exec(`INSERT INTO questions(id,question_type,topic_id,difficulty,body,answer,explanation)
 VALUES('00000000-0000-4000-8000-000000000001','multiple_choice','old','easy','{}',ARRAY['A'],'{}')`)
	if _, err := provider.Up(ctx); err != nil {
		t.Fatal(err)
	}
	// Старый код не пишет новые nullable-столбцы и продолжает делать INSERT/UPDATE.
	exec(`INSERT INTO questions(id,question_type,topic_id,difficulty,body,answer,explanation)
 VALUES('00000000-0000-4000-8000-000000000002','multiple_choice','old','easy','{}',ARRAY['B'],'{}')`)
	exec(`UPDATE questions SET body='{"prompt":"Updated"}' WHERE id='00000000-0000-4000-8000-000000000001'`)
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM questions WHERE numeric_answer IS NULL AND passage_id IS NULL AND figure_id IS NULL`).Scan(&n); err != nil || n != 2 {
		t.Fatalf("legacy writes: %d %v", n, err)
	}
	if _, err := provider.DownTo(ctx, 3); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM questions`).Scan(&n); err != nil || n != 2 {
		t.Fatalf("rollback discarded old data: %d %v", n, err)
	}
}
