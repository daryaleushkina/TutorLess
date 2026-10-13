package service

import (
	"context"
	"testing"

	"github.com/daryaleushkina/greprepapp/server/internal/api"
	"github.com/daryaleushkina/greprepapp/server/internal/apperr"
	"github.com/daryaleushkina/greprepapp/server/internal/db"
)

func TestWordsAccessBeforeStorage(t *testing.T) {
	t.Parallel()
	// nil-пул: любой поход в базу до проверки прав немедленно провалит тест.
	s := &Service{}
	for _, test := range []struct {
		role   string
		status int
	}{{"", 401}, {"editor", 403}} {
		ctx := context.Background()
		if test.role != "" {
			ctx = context.WithValue(ctx, principalKey{}, principal{user: db.User{Role: test.role}})
		}
		for _, card := range []bool{false, true} {
			var err error
			if card {
				_, err = s.GetWord(ctx, api.GetWordParams{Exam: api.ExamGre})
			} else {
				_, err = s.GetWords(ctx, api.GetWordsParams{Exam: api.ExamGre})
			}
			e, ok := apperr.As(err)
			if !ok || e.Status != test.status {
				t.Fatalf("access: %v", err)
			}
		}
	}
}
