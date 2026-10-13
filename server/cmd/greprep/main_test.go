package main

import (
	"context"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/daryaleushkina/greprepapp/server/internal/config"
	"github.com/daryaleushkina/greprepapp/server/internal/testdb"
)

// Набор для разработки — approved без проверки Даши, поэтому в бою команда отказывается работать ещё до
// подключения к базе (адрес базы здесь нарочно недоступен).
func TestSeedDevRefusesProduction(t *testing.T) {
	t.Parallel()
	cfg := config.Config{Env: config.EnvProduction, DatabaseURL: "postgres://nobody@127.0.0.1:1/none"}
	err := seedDev(context.Background(), slog.New(slog.DiscardHandler), cfg)
	if err == nil || !strings.Contains(err.Error(), "not allowed with APP_ENV=production") {
		t.Fatalf("seed-dev in production: %v", err)
	}
}

func TestImportWordsProduction(t *testing.T) {
	t.Parallel()
	pool := testdb.New(t)
	address, err := url.Parse(os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	address.Path = "/" + pool.Config().ConnConfig.Database
	cfg := config.Config{Env: config.EnvProduction, DatabaseURL: address.String()}
	log := slog.New(slog.DiscardHandler)
	args := []string{"--exam", "gre", "--file", "../../internal/words/testdata/words.csv", "--limit", "3"}
	for range 2 {
		if err := importWords(context.Background(), log, cfg, args); err != nil {
			t.Fatal(err)
		}
	}
	var count int
	if err := pool.QueryRow(context.Background(), "SELECT count(*) FROM words WHERE status='draft'").Scan(&count); err != nil || count != 3 {
		t.Fatalf("default draft: %d %v", count, err)
	}
	if err := importWords(context.Background(), log, cfg, append(args, "--status", "approved")); err != nil {
		t.Fatal(err)
	}
	for _, bad := range [][]string{{"--unknown"}, {}, {"--exam", "gre", "--file", "missing.csv"}, {"--exam", "gre", "--file", "../../internal/words/testdata/words.csv", "--status", "retired"}, {"--exam", "gre", "--file", "../../internal/words/testdata/words.csv", "--limit", "0"}} {
		if err := importWords(context.Background(), log, cfg, bad); err == nil {
			t.Fatalf("invalid command: %v", bad)
		}
	}
}
