// Package devseed — набор заданий для разработки: локальный сервер, стенд, тесты (решение Даши 06.10.2026:
// набор свой и пробный, лежит в публичном git и в бой не идёт). В бой он не попадает:
// команда seed-dev отказывается работать с APP_ENV=production, а контент для людей приходит через админку
// после проверки Даши (AGENTS.md, «Контент заданий»). Задания свои, не из пособий ETS.
package devseed

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/daryaleushkina/greprepapp/server/internal/db"
	"github.com/daryaleushkina/greprepapp/server/internal/training"
)

//go:embed questions.json
var raw []byte

// Topic — тема заданий.
type Topic struct {
	ID       string        `json:"id"`
	Exam     string        `json:"exam"`
	Section  string        `json:"section"`
	Title    training.Text `json:"title"`
	Position int           `json:"position"`
}

// Question — задание набора.
type Question struct {
	ID            uuid.UUID                 `json:"id"`
	Type          training.Type             `json:"type"`
	Topic         string                    `json:"topic"`
	Difficulty    string                    `json:"difficulty"`
	Body          training.Body             `json:"body"`
	Answer        []string                  `json:"answer"`
	Explanation   training.Explanation      `json:"explanation"`
	NumericAnswer *training.NumericResponse `json:"numericAnswer,omitempty"`
	PassageID     string                    `json:"passageId,omitempty"`
	FigureID      string                    `json:"figureId,omitempty"`
}

// Set — весь набор.
type Set struct {
	Topics    []Topic            `json:"topics"`
	Passages  []training.Passage `json:"passages"`
	Figures   []training.Figure  `json:"figures"`
	Questions []Question         `json:"questions"`
}

// Load читает встроенный набор и проверяет каждое задание теми же правилами, что и контент из админки.
func Load() (Set, error) { return parse(raw) }

func parse(data []byte) (Set, error) {
	var s Set
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&s); err != nil {
		return Set{}, fmt.Errorf("decode dev seed: %w", err)
	}
	sections := map[string]string{}
	exams := map[string]string{}
	for _, t := range s.Topics {
		sections[t.ID] = t.Section
		exams[t.ID] = t.Exam
	}

	passages := map[string]training.Passage{}
	for _, p := range s.Passages {
		if err := training.ValidatePassage(p); err != nil {
			return Set{}, err
		}
		if _, ok := passages[p.ID]; ok {
			return Set{}, fmt.Errorf("duplicate passage %s", p.ID)
		}
		passages[p.ID] = p
	}
	figures := map[string]training.Figure{}
	for _, f := range s.Figures {
		if err := training.ValidateFigure(f); err != nil {
			return Set{}, err
		}
		if _, ok := figures[f.ID]; ok {
			return Set{}, fmt.Errorf("duplicate figure %s", f.ID)
		}
		figures[f.ID] = f
	}
	for _, q := range s.Questions {
		if exams[q.Topic] != training.ExamOf(q.Type) || !training.FitsSection(q.Type, training.Section(sections[q.Topic])) {
			return Set{}, fmt.Errorf("dev seed question %s: topic %q is not in the section of %s", q.ID, q.Topic, q.Type)
		}
		switch q.Difficulty {
		case "easy", "medium", "hard":
		default:
			return Set{}, fmt.Errorf("dev seed question %s: difficulty %q", q.ID, q.Difficulty)
		}
		body := q.Body
		if body.Passage != nil || body.Figure != nil {
			return Set{}, fmt.Errorf("seed materials must use shared ids")
		}
		if q.PassageID != "" {
			p, ok := passages[q.PassageID]
			if !ok {
				return Set{}, fmt.Errorf("unknown passage %s", q.PassageID)
			}
			body.Passage = &p
		}
		if q.FigureID != "" {
			f, ok := figures[q.FigureID]
			if !ok {
				return Set{}, fmt.Errorf("unknown figure %s", q.FigureID)
			}
			body.Figure = &f
		}
		if (body.Passage != nil && sections[q.Topic] != "verbal") || (body.Figure != nil && sections[q.Topic] != "quant") || (sections[q.Topic] == "verbal" && (q.Type == training.MultipleChoice || q.Type == training.MultipleChoiceMulti) && body.Passage == nil) {
			return Set{}, fmt.Errorf("materials do not fit question section")
		}
		err := training.Validate(training.Question{Type: q.Type, Body: body, Answer: q.Answer, NumericAnswer: q.NumericAnswer, Explanation: q.Explanation})
		if err != nil {
			return Set{}, fmt.Errorf("dev seed question %s: %w", q.ID, err)
		}
	}
	return s, nil
}

// Apply записывает набор в базу одной транзакцией; повторный запуск обновляет те же задания.
func Apply(ctx context.Context, pool *pgxpool.Pool, s Set) error {
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		for _, t := range s.Topics {
			err := q.UpsertTopic(ctx, db.UpsertTopicParams{
				ID: t.ID, ExamID: t.Exam, Section: t.Section, TitleRu: t.Title.Ru, TitleEn: t.Title.En, Position: t.Position,
			})
			if err != nil {
				return fmt.Errorf("upsert topic %s: %w", t.ID, err)
			}
		}

		for _, p := range s.Passages {
			body, err := json.Marshal(p)
			if err != nil {
				return fmt.Errorf("encode passage: %w", err)
			}
			if err := q.UpsertPassage(ctx, db.UpsertPassageParams{ID: p.ID, Body: body}); err != nil {
				return fmt.Errorf("upsert passage: %w", err)
			}
		}
		for _, f := range s.Figures {
			body, err := json.Marshal(f)
			if err != nil {
				return fmt.Errorf("encode figure: %w", err)
			}
			if err := q.UpsertFigure(ctx, db.UpsertFigureParams{ID: f.ID, Body: body}); err != nil {
				return fmt.Errorf("upsert figure: %w", err)
			}
		}
		for _, item := range s.Questions {
			body, err := json.Marshal(item.Body)
			if err != nil {
				return fmt.Errorf("encode body %s: %w", item.ID, err)
			}
			expl, err := json.Marshal(item.Explanation)
			if err != nil {
				return fmt.Errorf("encode explanation %s: %w", item.ID, err)
			}
			var numeric []byte
			if item.NumericAnswer != nil {
				numeric, err = json.Marshal(item.NumericAnswer)
				if err != nil {
					return fmt.Errorf("encode numeric key: %w", err)
				}
			}
			var passageID, figureID *string
			if item.PassageID != "" {
				passageID = &item.PassageID
			}
			if item.FigureID != "" {
				figureID = &item.FigureID
			}
			err = q.UpsertQuestion(ctx, db.UpsertQuestionParams{
				ID: item.ID, QuestionType: string(item.Type), TopicID: item.Topic, Difficulty: item.Difficulty,
				Status: "approved", Body: body, Answer: item.Answer, Explanation: expl,
				NumericAnswer: numeric, PassageID: passageID, FigureID: figureID,
			})
			if err != nil {
				return fmt.Errorf("upsert question %s: %w", item.ID, err)
			}
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("apply dev seed: %w", err)
	}
	return nil
}
