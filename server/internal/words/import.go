package words

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/daryaleushkina/greprepapp/server/internal/db"
)

// Entry содержит только поля отбора: остальные колонки CSV в продукт не идут.
type Entry struct {
	Lemma string
	Rank  int
}

func validateEntry(e Entry) error {
	if !utf8.ValidString(e.Lemma) || strings.TrimSpace(e.Lemma) != e.Lemma || e.Lemma == "" || utf8.RuneCountInString(e.Lemma) > 128 || strings.ContainsFunc(e.Lemma, unicode.IsControl) {
		return errors.New("word must be nonempty UTF-8 text of at most 128 characters without surrounding whitespace or control characters")
	}
	if e.Rank < 1 || e.Rank > 2147483647 {
		return errors.New("rank must be an integer from 1 to 2147483647")
	}
	return nil
}

// ReadCSV проверяет весь файл, включая строки вне выбранной тысячи; ошибка не оставляет частичный импорт.
func ReadCSV(reader io.Reader, limit int) ([]Entry, error) {
	if limit < 1 {
		return nil, errors.New("limit must be positive")
	}
	r := csv.NewReader(reader)
	header, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("read CSV header: %w", err)
	}
	word, rank := -1, -1
	seenHeaders := map[string]bool{}
	for i, key := range header {
		key = strings.TrimPrefix(key, "\ufeff")
		if seenHeaders[key] {
			return nil, fmt.Errorf("duplicate CSV column %q", key)
		}
		seenHeaders[key] = true
		switch key {
		case "word":
			word = i
		case "rank":
			rank = i
		}
	}
	if word < 0 || rank < 0 {
		return nil, errors.New("CSV must have rank and word columns")
	}
	entries := []Entry{}
	seen := map[string]bool{}
	for line := 2; ; line++ {
		row, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("CSV row %d: %w", line, err)
		}
		n, err := strconv.Atoi(row[rank])
		if err != nil {
			return nil, fmt.Errorf("CSV row %d: invalid rank: %w", line, err)
		}
		e := Entry{Lemma: row[word], Rank: n}
		if err := validateEntry(e); err != nil {
			return nil, fmt.Errorf("CSV row %d: %w", line, err)
		}
		key := strings.ToLower(e.Lemma)
		if seen[key] {
			return nil, fmt.Errorf("CSV row %d: duplicate word", line)
		}
		seen[key] = true
		entries = append(entries, e)
	}
	if len(entries) == 0 {
		return nil, errors.New("CSV contains no words")
	}
	slices.SortFunc(entries, func(a, b Entry) int {
		if a.Rank != b.Rank {
			return a.Rank - b.Rank
		}
		return strings.Compare(a.Lemma, b.Lemma)
	})
	if len(entries) > limit {
		entries = entries[:limit]
	}
	return entries, nil
}

// Import сохраняет поля карточки и не понижает approved/retired. Нулевой changed означает точный повтор.
func Import(ctx context.Context, pool *pgxpool.Pool, exam string, entries []Entry, status string) (int64, error) {
	if status != "draft" && status != "approved" {
		return 0, errors.New("status must be draft or approved")
	}
	if len(entries) == 0 {
		return 0, errors.New("no words to import")
	}
	seen := map[string]bool{}
	for i, e := range entries {
		if err := validateEntry(e); err != nil {
			return 0, fmt.Errorf("word row %d: %w", i+1, err)
		}
		key := strings.ToLower(e.Lemma)
		if seen[key] {
			return 0, fmt.Errorf("word row %d: duplicate word", i+1)
		}
		seen[key] = true
	}
	var changed int64
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		exists, err := q.WordExamExists(ctx, exam)
		if err != nil {
			return fmt.Errorf("find import exam: %w", err)
		}
		if !exists {
			return fmt.Errorf("unknown exam %q", exam)
		}
		for i, e := range entries {
			n, err := q.ImportWord(ctx, db.ImportWordParams{ExamID: exam, Lemma: e.Lemma, Rank: e.Rank, Status: status})
			if err != nil {
				return fmt.Errorf("import row %d: %w", i+1, err)
			}
			changed += n
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("import words: %w", err)
	}
	return changed, nil
}
