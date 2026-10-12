package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
	_ "time/tzdata" // База IANA доступна и в образе без системного пакета tzdata.

	"github.com/jackc/pgx/v5"

	"github.com/daryaleushkina/greprepapp/server/internal/api"
	"github.com/daryaleushkina/greprepapp/server/internal/apperr"
	"github.com/daryaleushkina/greprepapp/server/internal/db"
	"github.com/daryaleushkina/greprepapp/server/internal/httpx"
)

const weakSpotWindow = 30 * 24 * time.Hour

// пауза дольше — человек отошёл
const maxHomeAnswerGap = 5 * time.Minute

// weekBounds считает календарные даты, а не 168 часов: неделя с переводом часов имеет другую длину.
func weekBounds(now time.Time, zone *time.Location) (time.Time, time.Time) {
	local := now.In(zone)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, zone)
	start = start.AddDate(0, 0, -(int(local.Weekday())+6)%7)
	return start, start.AddDate(0, 0, 7)
}

func (s *Service) GetHome(ctx context.Context, params api.GetHomeParams) (*api.Home, error) {
	p, err := s.trainee(ctx)
	if err != nil {
		return nil, err
	}
	// Local — настройка процесса, а не зона клиента; пустое имя LoadLocation трактует как UTC.
	if params.Tz == "" || params.Tz == "Local" {
		return nil, apperr.Invalid("unknown time zone", nil)
	}
	zone, err := s.zones.get(params.Tz)
	if err != nil {
		return nil, apperr.Invalid("unknown time zone", err)
	}
	now := s.now()
	start, end := weekBounds(now, zone)
	// SQL получает границы суток из той же базы IANA. Его пакет зон может не знать старые имена
	// (например, Asia/Saigon) или содержать другие правила перевода часов.
	dayStarts := make([]time.Time, 7)
	for i := range dayStarts {
		dayStarts[i] = start.AddDate(0, 0, i)
	}
	qctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	var result api.Home
	// Все части статистики видят один снимок базы, даже если одновременно пришла очередь ответов.
	err = pgx.BeginTxFunc(qctx, s.pool, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		result.LastTraining = api.NilLastTraining{Null: true}
		result.WeakSpot = api.NilWeakSpot{Null: true}
		last, err := q.GetHomeLastTraining(qctx, db.GetHomeLastTrainingParams{UserID: p.user.ID, ExamID: string(params.Exam)})
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("home last training: %w", err)
		}
		if err == nil {
			var request api.TrainingRequest
			if err := request.UnmarshalJSON(last.Request); err != nil {
				s.log.LogAttrs(ctx, slog.LevelError, "home last training request", slog.String("request_id", httpx.FromContext(ctx).ID), slog.String("error", err.Error()))
			} else if supportsAll(params.Types, request.QuestionTypes) {
				result.LastTraining.SetTo(api.LastTraining{Request: request, Size: last.Size})
			}
		}
		sections, err := q.GetHomeSections(qctx, db.GetHomeSectionsParams{UserID: p.user.ID, ExamID: string(params.Exam)})
		if err != nil {
			return fmt.Errorf("home sections: %w", err)
		}
		result.Sections = make([]api.SectionStats, 0, len(sections))
		for _, section := range sections {
			result.Sections = append(result.Sections, api.SectionStats{Section: api.Section(section.Section), Total: section.Total, Correct: section.Correct})
		}
		result.Mistakes, err = q.CountHomeMistakes(qctx, db.CountHomeMistakesParams{UserID: p.user.ID, ExamID: string(params.Exam)})
		if err != nil {
			return fmt.Errorf("home mistakes: %w", err)
		}
		weak, err := q.GetHomeWeakSpot(qctx, db.GetHomeWeakSpotParams{UserID: p.user.ID, ExamID: string(params.Exam), Since: now.Add(-weakSpotWindow), Until: now})
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("home weak spot: %w", err)
		}
		if err == nil {
			result.WeakSpot.SetTo(api.WeakSpot{QuestionType: api.QuestionType(weak.QuestionType), Section: api.Section(weak.Section), Accuracy: weak.Accuracy})
		}
		week, err := q.GetHomeWeek(qctx, db.GetHomeWeekParams{UserID: p.user.ID, ExamID: string(params.Exam), DayStarts: dayStarts, WeekStart: start, WeekEnd: end, MaxGapSeconds: int(maxHomeAnswerGap / time.Second)})
		if err != nil {
			return fmt.Errorf("home week: %w", err)
		}
		result.Week = api.WeekStats{Days: week.Days, Answers: week.Answers, Minutes: week.Minutes}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("get home: %w", err)
	}
	return &result, nil
}
