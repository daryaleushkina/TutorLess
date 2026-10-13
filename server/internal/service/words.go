package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/daryaleushkina/greprepapp/server/internal/api"
	"github.com/daryaleushkina/greprepapp/server/internal/apperr"
	"github.com/daryaleushkina/greprepapp/server/internal/db"
	"github.com/daryaleushkina/greprepapp/server/internal/words"
)

type wordCursor struct {
	Exam string    `json:"exam"`
	Q    string    `json:"q"`
	Rank int       `json:"rank"`
	ID   uuid.UUID `json:"id"`
}

func decodeWordCursor(raw, exam, prefix string) (wordCursor, error) {
	data, err := base64.RawURLEncoding.Strict().DecodeString(raw)
	if err != nil {
		return wordCursor{}, fmt.Errorf("decode word cursor: %w", err)
	}
	var c wordCursor
	d := json.NewDecoder(strings.NewReader(string(data)))
	d.DisallowUnknownFields()
	if err := d.Decode(&c); err != nil {
		return c, fmt.Errorf("parse word cursor: %w", err)
	}
	// Повторная сериализация также отсеивает хвост, дубли полей и неканоническую форму.
	canonical, err := json.Marshal(c)
	if err != nil {
		return c, fmt.Errorf("check word cursor: %w", err)
	}
	if string(canonical) != string(data) || c.Exam != exam || c.Q != prefix || c.Rank < 1 || c.Rank > 2147483647 || c.ID == uuid.Nil {
		return c, errors.New("word cursor does not match this search")
	}
	return c, nil
}

// GetWords — только одобренные, с устойчивым порядком при совпадении рейтинга.
func (s *Service) GetWords(ctx context.Context, p api.GetWordsParams) (*api.WordList, error) {
	if _, err := s.trainee(ctx); err != nil {
		return nil, err
	}
	limit := p.Limit.Or(50)
	prefix := strings.ToLower(strings.TrimSpace(p.Q.Or("")))
	c := wordCursor{Exam: string(p.Exam), Q: prefix}
	if after, ok := p.After.Get(); ok {
		var err error
		c, err = decodeWordCursor(after, string(p.Exam), prefix)
		if err != nil {
			return nil, apperr.Invalid("invalid word cursor", err)
		}
	}
	qctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	if err := s.wordExam(qctx, p.Exam); err != nil {
		return nil, err
	}
	rows, err := s.q.ListWords(qctx, db.ListWordsParams{ExamID: string(p.Exam), Prefix: prefix, AfterRank: c.Rank, AfterID: c.ID, PageSize: limit + 1})
	if err != nil {
		return nil, fmt.Errorf("list words: %w", err)
	}
	res := &api.WordList{Words: []api.WordListItem{}}
	if len(rows) > limit {
		last := rows[limit-1]
		data, err := json.Marshal(wordCursor{Exam: string(p.Exam), Q: prefix, Rank: last.Rank, ID: last.ID})
		if err != nil {
			return nil, fmt.Errorf("encode word cursor: %w", err)
		}
		res.NextCursor.SetTo(base64.RawURLEncoding.EncodeToString(data))
		rows = rows[:limit]
	}
	for _, row := range rows {
		res.Words = append(res.Words, api.WordListItem{ID: row.ID, Lemma: row.Lemma, PartOfSpeech: wordOptional(row.PartOfSpeech)})
	}
	if err := res.Validate(); err != nil {
		return nil, fmt.Errorf("invalid word list in storage: %w", err)
	}
	return res, nil
}

func (s *Service) wordExam(ctx context.Context, exam api.Exam) error {
	exists, err := s.q.WordExamExists(ctx, string(exam))
	if err != nil {
		return fmt.Errorf("find word exam: %w", err)
	}
	if !exists {
		return apperr.Invalid("unknown exam", nil)
	}
	return nil
}

// GetWord проверяет права до чтения содержимого; id никогда не обходит экзамен и статус.
func (s *Service) GetWord(ctx context.Context, p api.GetWordParams) (*api.Word, error) {
	if _, err := s.trainee(ctx); err != nil {
		return nil, err
	}
	qctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	if err := s.wordExam(qctx, p.Exam); err != nil {
		return nil, err
	}
	row, err := s.q.GetWord(qctx, db.GetWordParams{ID: p.WordId, ExamID: string(p.Exam)})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(404, apperr.NotFound, "word not found", err)
	}
	if err != nil {
		return nil, fmt.Errorf("get word: %w", err)
	}
	senses, err := words.ParseSenses(row.Senses)
	if err != nil {
		return nil, err
	}
	res := &api.Word{ID: row.ID, Lemma: row.Lemma, PartOfSpeech: wordOptional(row.PartOfSpeech), Ipa: wordOptional(row.Ipa), AudioKey: wordOptional(row.AudioKey), Senses: senses, Synonyms: row.Synonyms, Antonyms: row.Antonyms}
	if err := res.Validate(); err != nil {
		return nil, fmt.Errorf("invalid word in storage: %w", err)
	}
	return res, nil
}

func wordOptional(value *string) api.OptString {
	if value == nil || *value == "" {
		return api.OptString{}
	}
	return api.NewOptString(*value)
}
