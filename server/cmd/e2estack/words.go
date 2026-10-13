package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/daryaleushkina/greprepapp/server/internal/words"
)

// Только выдуманный словарь стенда. Реальный список не встраивается ни в тесты, ни в сервер.
func seedWords(ctx context.Context, pool *pgxpool.Pool) error {
	sctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	input, err := os.Open("internal/words/testdata/words.csv")
	if err != nil {
		return fmt.Errorf("open e2e words: %w", err)
	}
	entries, readErr := words.ReadCSV(input, 10)
	if err := errors.Join(readErr, input.Close()); err != nil {
		return fmt.Errorf("read e2e words: %w", err)
	}
	if _, err := words.Import(sctx, pool, "gre", entries, "approved"); err != nil {
		return err
	}
	_, err = pool.Exec(sctx, `UPDATE words SET part_of_speech='noun', ipa='/ˈzɔːrbəl/',
 senses='[{"definition":"An imaginary object used in a software test.","translation":"Выдуманный предмет для теста.","example":"The zorble glows in the test scene.","exampleTranslation":"Зорбл светится в тестовой сцене."},{"definition":"A name for a make-believe fixture.","translation":"Название выдуманного объекта."}]',
 synonyms=ARRAY['flimble','glimlet'], antonyms=ARRAY['thrumple'] WHERE lemma='zorble';
 INSERT INTO words (exam_id,lemma,rank,status) VALUES ('gre','draftling',7,'draft'),('gre','retireling',8,'retired'),('toefl','foreignling',1,'approved')`)
	if err != nil {
		return fmt.Errorf("prepare e2e word cards: %w", err)
	}
	return nil
}
