package migrations_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/daryaleushkina/greprepapp/server/internal/migrations"
	"github.com/daryaleushkina/greprepapp/server/internal/testdb"
)

func TestQuestionReportsMigrationPreservesLegacyWrites(t *testing.T) {
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
	if _, err := provider.DownTo(ctx, 4); err != nil {
		t.Fatal(err)
	}
	exec := func(query string) {
		t.Helper()
		if _, err := pool.Exec(ctx, query); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO users(id,name) VALUES('00000000-0000-4000-8000-000000000001','Reporter')`)
	exec(`INSERT INTO topics(id,section,title_ru,title_en) VALUES('old','quant','Тема','Topic')`)
	exec(`INSERT INTO questions(id,question_type,topic_id,difficulty,body,answer,explanation)
 VALUES('00000000-0000-4000-8000-000000000002','multiple_choice','old','easy','{}',ARRAY['A'],'{}')`)
	const legacy = `INSERT INTO question_reports(user_id,question_id,kind,text)
 VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','other','Legacy')`
	exec(legacy)
	applied, err := provider.Up(ctx)
	if err != nil || len(applied) != 1 {
		t.Fatalf("report migration: %d applied, err %v; want 1, nil", len(applied), err)
	}
	// Старое тело INSERT не меняется; NULL не ограничивает повторные жалобы.
	exec(legacy)
	exec(legacy)
	var n int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM question_reports WHERE report_id IS NULL").Scan(&n); err != nil || n != 3 {
		t.Fatalf("legacy reports: %d %v", n, err)
	}
	const identified = `INSERT INTO question_reports(user_id,question_id,kind,report_id)
 VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','other','00000000-0000-4000-8000-000000000003')`
	exec(identified)
	_, err = pool.Exec(ctx, identified)
	var pgerr *pgconn.PgError
	if !errors.As(err, &pgerr) || pgerr.Code != "23505" {
		t.Fatalf("duplicate must violate the unique index: %v", err)
	}
	if _, err := provider.DownTo(ctx, 4); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM question_reports").Scan(&n); err != nil || n != 4 {
		t.Fatalf("rollback discarded reports: %d %v", n, err)
	}
}
