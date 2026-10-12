package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/daryaleushkina/greprepapp/server/internal/api"
	"github.com/daryaleushkina/greprepapp/server/internal/apperr"
	"github.com/daryaleushkina/greprepapp/server/internal/db"
	"github.com/daryaleushkina/greprepapp/server/internal/httpx"
	"github.com/daryaleushkina/greprepapp/server/internal/training"
)

// canTrain — можно ли человеку открывать тренировки. Платный контент не покидает сервер без проверки прав
// (AGENTS.md); пока идёт бета, тренировки открыты всем вошедшим (решение Даши 06.10.2026). Проверка
// подписки встанет сюда, а не в каждый обработчик. Незнакомая роль — отказ: новая роль не получает доступ
// молча.
func canTrain(u db.User) bool {
	return u.Role == string(api.RoleUser) || u.Role == string(api.RoleAdmin)
}

func (s *Service) trainee(ctx context.Context) (principal, error) {
	p, err := principalFrom(ctx)
	if err != nil {
		return principal{}, err
	}
	if !canTrain(p.user) {
		return principal{}, apperr.Denied("trainings are not available")
	}
	return p, nil
}

// Виды готовых наборов. В договоре это открытая строка: клиент пропускает незнакомые виды.
const (
	presetLast  = "last"
	presetTimed = "timed"
)

// GetTrainingOptions — темы с числом заданий и готовые наборы для конструктора. Только типы, которые клиент
// умеет показывать: тип, добавленный на сервере позже, не ломает уже установленные версии.
func (s *Service) GetTrainingOptions(ctx context.Context, params api.GetTrainingOptionsParams) (*api.TrainingOptions, error) {
	p, err := s.trainee(ctx)
	if err != nil {
		return nil, err
	}
	caps, err := clientCapabilities(params.XTrainingCapabilities)
	if err != nil {
		return nil, err
	}
	qctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	caps = caps.narrowed(params.Types)
	rows, err := s.q.CountApprovedQuestions(qctx, db.CountApprovedQuestionsParams{ExamID: string(params.Exam), SupportedTypes: caps.strings(), WithPassage: caps.Passage, WithFigure: caps.Figure})
	if err != nil {
		return nil, fmt.Errorf("count questions: %w", err)
	}
	types := trainingTypes(rows, params.Exam, caps.Types)
	availableTypes := make([]api.QuestionType, 0, len(types))
	for _, t := range types {
		availableTypes = append(availableTypes, t.QuestionType)
	}

	presets := []api.TrainingPreset{}
	last, hasLast, err := s.lastRequest(qctx, p.user.ID, params.Exam, caps)
	if errors.Is(err, errUnreadableRequest) {
		// Старый формат запроса после правки договора не должен закрывать конструктор насовсем: набор «Как в
		// прошлый раз» пропадает, сбой — в журнал.
		s.log.LogAttrs(ctx, slog.LevelError, "last training request",
			slog.String("request_id", httpx.FromContext(ctx).ID), slog.String("error", err.Error()))
	} else if err != nil {
		return nil, err
	}
	timedSection := api.SectionVerbal
	if hasLast && supportsAll(availableTypes, last.QuestionTypes) {
		presets = append(presets, api.TrainingPreset{Kind: presetLast, Request: last})
		timedSection = last.Section
	}
	if timed, ok := timedPreset(types, params.Exam, timedSection); ok {
		presets = append(presets, timed)
	}
	return &api.TrainingOptions{Types: types, Presets: presets, MaxQuestions: training.MaxQuestions}, nil
}

func supportsAll(supported, types []api.QuestionType) bool {
	for _, t := range types {
		if !slices.Contains(supported, t) {
			return false
		}
	}
	return true
}

// trainingTypes — все поддержанные клиентом типы, даже пустые: конструктор показывает их с пометкой «скоро».
func trainingTypes(rows []db.CountApprovedQuestionsRow, exam api.Exam, supported []api.QuestionType) []api.TrainingType {
	types := make([]api.TrainingType, 0, len(training.Types))
	type typeSection struct {
		typ     training.Type
		section api.Section
	}
	index := map[typeSection]int{}
	for _, t := range training.Types {
		if training.ExamOf(t) != string(exam) || !slices.Contains(supported, api.QuestionType(t)) {
			continue
		}
		sections := []training.Section{training.SectionOf(t)}
		if t == training.MultipleChoice || t == training.MultipleChoiceMulti {
			for _, r := range rows {
				if r.QuestionType == string(t) && r.Section == string(training.Verbal) {
					sections = append(sections, training.Verbal)
					break
				}
			}
		}
		for _, sec := range sections {
			index[typeSection{t, api.Section(sec)}] = len(types)
			types = append(types, api.TrainingType{Section: api.Section(sec), QuestionType: api.QuestionType(t), PaceSeconds: training.PaceSeconds(sec), Topics: []api.TrainingTopic{}})
		}
	}
	for _, r := range rows {
		i, ok := index[typeSection{training.Type(r.QuestionType), api.Section(r.Section)}]
		if !ok || types[i].Section != api.Section(r.Section) {
			continue
		}
		topics := types[i].Topics
		if n := len(topics); n == 0 || topics[n-1].ID != r.TopicID {
			topics = append(topics, api.TrainingTopic{ID: r.TopicID, Title: api.LocalizedText{Ru: r.TitleRu, En: r.TitleEn}})
		}
		counts := &topics[len(topics)-1].Available
		switch r.Difficulty {
		case "easy":
			counts.Easy = r.Available
		case "medium":
			counts.Medium = r.Available
		case "hard":
			counts.Hard = r.Available
		}
		types[i].Topics = topics
	}
	return types
}

// timedPreset — «Проверка на время»: все типы раздела, где есть задания, как первая секция экзамена.
func timedPreset(types []api.TrainingType, exam api.Exam, section api.Section) (api.TrainingPreset, bool) {
	var qt []api.QuestionType
	for _, t := range types {
		if t.Section == section && len(t.Topics) > 0 {
			qt = append(qt, t.QuestionType)
		}
	}
	if qt == nil {
		return api.TrainingPreset{}, false
	}
	return api.TrainingPreset{Kind: presetTimed, Request: api.TrainingRequest{
		Exam: exam, Section: section, QuestionTypes: qt, TopicIds: []string{}, Count: training.TimedCount, Mode: api.TrainingModeCheck,
	}}, true
}

// lastRequest — запрос прошлой тренировки для «Как в прошлый раз»; ok=false — тренировок ещё не было.
func (s *Service) lastRequest(ctx context.Context, userID uuid.UUID, exam api.Exam, caps trainingCapabilities) (r api.TrainingRequest, ok bool, err error) {
	raw, err := s.q.GetLastTrainingRequest(ctx, db.GetLastTrainingRequestParams{UserID: userID, ExamID: string(exam), SupportedTypes: caps.strings(), WithPassage: caps.Passage, WithFigure: caps.Figure})
	if errors.Is(err, pgx.ErrNoRows) {
		return r, false, nil
	}
	if err != nil {
		return r, false, fmt.Errorf("last training request: %w", err)
	}
	if !raw.Compatible {
		return r, false, nil
	}
	if err := r.UnmarshalJSON(raw.Request); err != nil {
		return r, false, fmt.Errorf("%w: %w", errUnreadableRequest, err)
	}
	if r.Exam != exam {
		return r, false, fmt.Errorf("%w: exam mismatch", errUnreadableRequest)
	}
	return r, true, nil
}

// errUnreadableRequest — сохранённый запрос прошлой тренировки не разбирается по нынешнему договору.
var errUnreadableRequest = errors.New("decode last training request")

// StartTraining подбирает задания и отдаёт сессию целиком, чтобы она дожила без сети.
func (s *Service) StartTraining(ctx context.Context, req *api.TrainingRequest, params api.StartTrainingParams) (*api.TrainingSession, error) {
	p, err := s.trainee(ctx)
	if err != nil {
		return nil, err
	}
	caps, err := clientCapabilities(params.XTrainingCapabilities)
	if err != nil {
		return nil, err
	}
	if !supportsAll(caps.Types, req.QuestionTypes) {
		return nil, apperr.Invalid("unsupported question type", nil)
	}
	types := make([]string, 0, len(req.QuestionTypes))
	for _, t := range req.QuestionTypes {
		if training.ExamOf(training.Type(t)) != string(req.Exam) || !training.FitsSection(training.Type(t), training.Section(req.Section)) {
			return nil, apperr.Invalid(fmt.Sprintf("question type %s is not in section %s", t, req.Section), nil)
		}
		types = append(types, string(t))
	}
	// Темы — множество. Нормализуем копию запроса, чтобы повтор клиента не превращался в 400 и не
	// попадал в пресет, а переданный вызывающим кодом запрос оставался неизменным.
	normalized := *req
	normalized.TopicIds = make([]string, 0, len(req.TopicIds))
	seen := make(map[string]struct{}, len(req.TopicIds))
	for _, id := range req.TopicIds {
		if _, exists := seen[id]; !exists {
			seen[id] = struct{}{}
			normalized.TopicIds = append(normalized.TopicIds, id)
		}
	}
	if req.TopicIds == nil {
		normalized.TopicIds = nil
	}
	req = &normalized
	request, err := req.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("encode training request: %w", err)
	}
	var difficulty *string
	if d, ok := req.Difficulty.Get(); ok {
		v := string(d)
		difficulty = &v
	}
	topicIDs := req.TopicIds
	if topicIDs == nil {
		topicIDs = []string{}
	}

	tctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	var session *api.TrainingSession
	err = pgx.BeginFunc(tctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		valid, err := q.TrainingSelectionValid(tctx, db.TrainingSelectionValidParams{
			ExamID: string(req.Exam), Section: string(req.Section), TopicIds: topicIDs,
		})
		if err != nil {
			return fmt.Errorf("check training selection: %w", err)
		}
		if !valid {
			return apperr.Invalid("section or topics do not belong to exam", nil)
		}
		ids, err := q.PickQuestions(tctx, db.PickQuestionsParams{
			ExamID:  string(req.Exam),
			Section: string(req.Section), QuestionTypes: types, TopicIds: topicIDs, Difficulty: difficulty,
			WithPassage: caps.Passage, WithFigure: caps.Figure,
			UserID: p.user.ID, MaxCount: req.Count, MistakesOnly: req.Source.Or(api.TrainingSourceCatalog) == api.TrainingSourceMistakes,
		})
		if err != nil {
			return fmt.Errorf("pick questions: %w", err)
		}
		if len(ids) == 0 {
			return apperr.New(http.StatusConflict, apperr.NoQuestions, "no approved questions match", nil)
		}
		var limit *int
		if req.Mode == api.TrainingModeCheck {
			v := training.TimeLimitSeconds(training.Section(req.Section), len(ids))
			limit = &v
		}
		tr, err := q.CreateTraining(tctx, db.CreateTrainingParams{
			ExamID: string(req.Exam),
			UserID: p.user.ID, Mode: string(req.Mode), Section: string(req.Section), QuestionTypes: types,
			Request: request, TimeLimitSeconds: limit, StartedAt: s.now(),
		})
		if err != nil {
			return fmt.Errorf("create training: %w", err)
		}
		if err := q.CreateTrainingItems(tctx, db.CreateTrainingItemsParams{TrainingID: tr.ID, QuestionIds: ids}); err != nil {
			return fmt.Errorf("create training items: %w", err)
		}
		rows, err := q.ListTrainingItems(tctx, tr.ID)
		if err != nil {
			return fmt.Errorf("list training items: %w", err)
		}
		session, err = sessionOf(tr, rows)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("start training: %w", err)
	}
	return session, nil
}

// GetTraining — своя тренировка с ответами, которые уже дошли.
func (s *Service) GetTraining(ctx context.Context, params api.GetTrainingParams) (*api.TrainingSession, error) {
	p, err := s.trainee(ctx)
	if err != nil {
		return nil, err
	}
	caps, err := clientCapabilities(params.XTrainingCapabilities)
	if err != nil {
		return nil, err
	}
	qctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	tr, err := s.q.GetTraining(qctx, db.GetTrainingParams{ID: params.TrainingId, UserID: p.user.ID})
	if err != nil {
		return nil, trainingLookupError(err)
	}
	rows, err := s.q.ListTrainingItems(qctx, tr.ID)
	if err != nil {
		return nil, fmt.Errorf("list training items: %w", err)
	}
	if err := caps.checkSession(tr, rows); err != nil {
		return nil, err
	}
	return sessionOf(tr, rows)
}

// trainingLookupError — чужая тренировка неотличима от несуществующей.
func trainingLookupError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.New(http.StatusNotFound, apperr.NotFound, "training not found", nil)
	}
	return fmt.Errorf("get training: %w", err)
}

// SubmitTrainingAnswers записывает ответы из очереди устройства; верность считает сервер.
func (s *Service) SubmitTrainingAnswers(ctx context.Context, req *api.AnswerBatch, params api.SubmitTrainingAnswersParams) error {
	p, err := s.trainee(ctx)
	if err != nil {
		return err
	}
	caps, err := clientCapabilities(params.XTrainingCapabilities)
	if err != nil {
		return err
	}
	tctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	err = pgx.BeginFunc(tctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		tr, err := q.LockTraining(tctx, db.LockTrainingParams{ID: params.TrainingId, UserID: p.user.ID})
		if err != nil {
			return trainingLookupError(err)
		}
		if tr.FinishedAt != nil {
			return apperr.New(http.StatusConflict, apperr.TrainingFinished, "training is finished", nil)
		}
		rows, err := q.ListTrainingItems(tctx, tr.ID)
		if err != nil {
			return fmt.Errorf("list training items: %w", err)
		}
		if err := caps.checkSession(tr, rows); err != nil {
			return err
		}
		for _, a := range req.Answers {
			if a.Position >= len(rows) {
				return apperr.Invalid(fmt.Sprintf("position %d is outside the training", a.Position), nil)
			}
			question, err := questionOf(rows[a.Position])
			if err != nil {
				return err
			}
			correct, err := training.CheckResponse(question, responseOf(a))
			if err != nil {
				if errors.Is(err, training.ErrBadAnswer) {
					return apperr.Invalid(fmt.Sprintf("answer at position %d", a.Position), err)
				}
				return fmt.Errorf("check answer at position %d: %w", a.Position, err)
			}
			ids := a.OptionIds
			if ids == nil {
				ids = []string{}
			}
			// Время ответа — по часам устройства (отвечали без сети), но не раньше начала и не позже, чем ответ
			// дошёл: иначе ответ из «будущего» навсегда закрыл бы вопрос для следующих ответов «Проверки».
			var numeric []byte
			if n, ok := a.NumericAnswer.Get(); ok {
				numeric, err = n.MarshalJSON()
				if err != nil {
					return fmt.Errorf("encode numeric answer: %w", err)
				}
			}
			answeredAt := clampTime(a.AnsweredAt, tr.StartedAt, s.now())
			_, err = q.SaveTrainingAnswer(tctx, db.SaveTrainingAnswerParams{
				NumericAnswer: numeric, SentenceID: optPtr(a.SentenceId),
				OptionIds: ids, DontKnow: a.DontKnow, Flagged: a.Flagged, AnsweredAt: &answeredAt,
				ElapsedMs: &a.ElapsedMs, Correct: &correct, TrainingID: tr.ID, Position: a.Position,
				KeepFirst: tr.Mode == string(api.TrainingModePractice),
			})
			if err != nil {
				return fmt.Errorf("save answer: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("submit answers: %w", err)
	}
	return nil
}

// FinishTraining закрывает тренировку и считает итог; повторный вызов отдаёт тот же итог.
func (s *Service) FinishTraining(ctx context.Context, req *api.TrainingFinish, params api.FinishTrainingParams) (*api.TrainingSummary, error) {
	p, err := s.trainee(ctx)
	if err != nil {
		return nil, err
	}
	caps, err := clientCapabilities(params.XTrainingCapabilities)
	if err != nil {
		return nil, err
	}
	tctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	var summary *api.TrainingSummary
	err = pgx.BeginFunc(tctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		tr, err := q.LockTraining(tctx, db.LockTrainingParams{ID: params.TrainingId, UserID: p.user.ID})
		if err != nil {
			return trainingLookupError(err)
		}
		if tr.FinishedAt == nil {
			// Конец — по часам устройства (тренировку могли закончить без сети), но не раньше начала и не
			// позже, чем запрос дошёл: часы устройства могут врать.
			end := clampTime(req.FinishedAt, tr.StartedAt, s.now())
			timedOut := training.TimedOut(training.Mode(tr.Mode), req.TimedOut)
			if err := q.FinishTraining(tctx, db.FinishTrainingParams{ID: tr.ID, FinishedAt: &end, TimedOut: timedOut}); err != nil {
				return fmt.Errorf("finish training: %w", err)
			}
			tr.FinishedAt, tr.TimedOut = &end, timedOut
		}
		rows, err := q.ListTrainingItems(tctx, tr.ID)
		if err != nil {
			return fmt.Errorf("list training items: %w", err)
		}
		if err := caps.checkSession(tr, rows); err != nil {
			return err
		}
		summary = summaryOf(tr, rows)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("finish training: %w", err)
	}
	return summary, nil
}

func clampTime(t, lo, hi time.Time) time.Time {
	if t.Before(lo) {
		return lo
	}
	if t.After(hi) {
		return hi
	}
	return t
}

func summaryOf(tr db.Training, rows []db.ListTrainingItemsRow) *api.TrainingSummary {
	results := make([]training.Result, 0, len(rows))
	for _, r := range rows {
		results = append(results, training.Result{
			Position: r.Position,
			TopicID:  r.TopicID,
			Title:    training.Text{Ru: r.TitleRu, En: r.TitleEn},
			Answered: len(r.OptionIds) > 0 || len(r.NumericAnswer) > 0 || r.SentenceID != nil,
			DontKnow: r.DontKnow,
			Correct:  r.Correct != nil && *r.Correct,
		})
	}
	sum := training.Summarize(results, tr.TimedOut)
	review := make([]api.TopicToReview, 0, len(sum.Review))
	for _, t := range sum.Review {
		review = append(review, api.TopicToReview{
			TopicId: t.TopicID, Title: api.LocalizedText{Ru: t.Title.Ru, En: t.Title.En}, Mistakes: t.Mistakes, Positions: t.Positions,
		})
	}
	return &api.TrainingSummary{
		Correct: sum.Correct, Total: sum.Total, Unanswered: sum.Unanswered,
		DurationSeconds: training.DurationSeconds(tr.StartedAt, *tr.FinishedAt, tr.TimeLimitSeconds), Review: review,
	}
}

// ReportQuestion — «Сообщить об ошибке» в задании.
func (s *Service) ReportQuestion(ctx context.Context, req *api.QuestionReport, params api.ReportQuestionParams) error {
	p, err := s.trainee(ctx)
	if err != nil {
		return err
	}
	qctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	var trainingID *uuid.UUID
	if id, ok := req.TrainingId.Get(); ok {
		if _, err := s.q.GetTraining(qctx, db.GetTrainingParams{ID: id, UserID: p.user.ID}); err != nil {
			return trainingLookupError(err)
		}
		// Привязка к тренировке — только если задание из неё: иначе в админке была бы ложная подсказка.
		in, err := s.q.TrainingHasQuestion(qctx, db.TrainingHasQuestionParams{TrainingID: id, QuestionID: params.QuestionId})
		if err != nil {
			return fmt.Errorf("check training question: %w", err)
		}
		if !in {
			return apperr.New(http.StatusNotFound, apperr.NotFound, "question is not in the training", nil)
		}
		trainingID = &id
	}
	ok, err := s.q.QuestionReportable(qctx, db.QuestionReportableParams{QuestionID: params.QuestionId, UserID: p.user.ID})
	if err != nil {
		return fmt.Errorf("check question: %w", err)
	}
	if !ok {
		return apperr.New(http.StatusNotFound, apperr.NotFound, "question not found", nil)
	}
	err = s.q.InsertQuestionReport(qctx, db.InsertQuestionReportParams{
		UserID: &p.user.ID, QuestionID: params.QuestionId, TrainingID: trainingID, Kind: string(req.Kind), Text: optPtr(req.Text),
	})
	if err != nil {
		return fmt.Errorf("insert question report: %w", err)
	}
	return nil
}

// questionOf — задание из строки базы в виде правил training.
func questionOf(r db.ListTrainingItemsRow) (training.Question, error) {
	q := training.Question{Type: training.Type(r.QuestionType), Answer: r.Answer}
	if err := json.Unmarshal(r.Body, &q.Body); err != nil {
		return training.Question{}, fmt.Errorf("decode question %s body: %w", r.QuestionID, err)
	}

	if len(r.QuestionNumericAnswer) > 0 {
		n, err := decodeStoredNumeric(r.QuestionNumericAnswer)
		if err != nil {
			return training.Question{}, err
		}
		q.NumericAnswer = &n
	}

	if len(r.Passage) > 0 {
		if err := json.Unmarshal(r.Passage, &q.Body.Passage); err != nil {
			return training.Question{}, fmt.Errorf("decode passage: %w", err)
		}
	}
	if len(r.Figure) > 0 {
		if err := json.Unmarshal(r.Figure, &q.Body.Figure); err != nil {
			return training.Question{}, fmt.Errorf("decode figure: %w", err)
		}
	}
	if err := json.Unmarshal(r.Explanation, &q.Explanation); err != nil {
		return training.Question{}, fmt.Errorf("decode question %s explanation: %w", r.QuestionID, err)
	}
	return q, nil
}

func sessionOf(tr db.Training, rows []db.ListTrainingItemsRow) (*api.TrainingSession, error) {
	items := make([]api.TrainingItem, 0, len(rows))
	for _, r := range rows {
		q, err := questionOf(r)
		if err != nil {
			return nil, err
		}
		item := api.TrainingItem{Position: r.Position, Question: apiQuestion(r, q)}
		if r.AnsweredAt != nil {
			a := api.GivenAnswer{
				Position: r.Position, OptionIds: r.OptionIds, DontKnow: r.DontKnow, Flagged: r.Flagged,
				AnsweredAt: *r.AnsweredAt,
			}
			if r.ElapsedMs != nil {
				a.ElapsedMs = *r.ElapsedMs
			}
			if r.SentenceID != nil {
				a.SentenceId = api.NewOptString(*r.SentenceID)
			}

			if len(r.NumericAnswer) > 0 {
				n, err := decodeStoredNumeric(r.NumericAnswer)
				if err != nil {
					return nil, err
				}
				a.NumericAnswer = api.NewOptNumericAnswer(apiNumeric(n))
			}

			item.Answer = api.NewOptGivenAnswer(a)
		}
		if r.Correct != nil {
			item.Correct = api.NewOptBool(*r.Correct)
		}
		items = append(items, item)
	}
	types := make([]api.QuestionType, 0, len(tr.QuestionTypes))
	for _, t := range tr.QuestionTypes {
		types = append(types, api.QuestionType(t))
	}
	out := &api.TrainingSession{
		Exam: api.NewOptExam(api.Exam(tr.ExamID)),
		ID:   tr.ID, Mode: api.TrainingMode(tr.Mode), Section: api.Section(tr.Section), QuestionTypes: types,
		StartedAt: tr.StartedAt, Items: items,
	}
	if tr.TimeLimitSeconds != nil {
		out.TimeLimitSeconds = api.NewOptInt(*tr.TimeLimitSeconds)
	}
	if tr.FinishedAt != nil {
		out.FinishedAt = api.NewOptDateTime(*tr.FinishedAt)
	}
	return out, nil
}

func apiQuestion(r db.ListTrainingItemsRow, q training.Question) api.Question {
	groups := make([]api.OptionGroup, 0, len(q.Body.Groups))
	for _, g := range q.Body.Groups {
		opts := make([]api.QuestionOption, 0, len(g.Options))
		for _, o := range g.Options {
			opts = append(opts, api.QuestionOption{ID: o.ID, Text: o.Text})
		}
		groups = append(groups, api.OptionGroup{Options: opts})
	}
	why := make([]api.OptionExplanation, 0, len(q.Explanation.Options))
	for _, o := range q.Explanation.Options {
		why = append(why, api.OptionExplanation{OptionId: o.OptionID, Text: api.LocalizedText{Ru: o.Text.Ru, En: o.Text.En}})
	}
	out := api.Question{
		ID: r.QuestionID, QuestionType: api.QuestionType(q.Type), Section: api.Section(r.Section), TopicId: r.TopicID,
		TopicTitle: api.LocalizedText{Ru: r.TitleRu, En: r.TitleEn}, Difficulty: api.Difficulty(r.Difficulty),
		Prompt: q.Body.Prompt, Groups: groups, SelectCount: q.Body.SelectCount, Answer: q.Answer,
		Explanation: api.Explanation{Solution: api.LocalizedText{Ru: q.Explanation.Solution.Ru, En: q.Explanation.Solution.En}, Options: why},
	}
	if q.NumericAnswer != nil {
		out.NumericAnswer = api.NewOptNumericAnswer(apiNumeric(*q.NumericAnswer))
	}
	if q.Body.NumericEntry != nil {
		n := api.NumericEntry{Format: api.NumericEntryFormat(q.Body.NumericEntry.Format)}
		if p := q.Body.NumericEntry.DecimalPlaces; p != nil {
			n.DecimalPlaces = api.NewOptInt(*p)
		}
		out.NumericEntry = api.NewOptNumericEntry(n)
	}
	if q.Body.Passage != nil {
		p := api.Passage{ID: q.Body.Passage.ID, Paragraphs: []api.PassageParagraph{}}
		for _, paragraph := range q.Body.Passage.Paragraphs {
			par := api.PassageParagraph{Sentences: []api.PassageSentence{}}
			for _, sentence := range paragraph.Sentences {
				par.Sentences = append(par.Sentences, api.PassageSentence{ID: sentence.ID, Text: sentence.Text})
			}
			p.Paragraphs = append(p.Paragraphs, par)
		}
		out.Passage = api.NewOptPassage(p)
	}
	if q.Body.Figure != nil {
		f := q.Body.Figure
		fig := api.DataFigure{ID: f.ID, Kind: api.DataFigureKind(f.Kind), Title: f.Title, XLabel: f.XLabel, YLabel: f.YLabel, Unit: f.Unit, Categories: f.Categories, Description: f.Description, Series: []api.DataSeries{}}
		for _, series := range f.Series {
			fig.Series = append(fig.Series, api.DataSeries{ID: series.ID, Label: series.Label, Values: series.Values})
		}
		out.Figure = api.NewOptDataFigure(fig)
	}

	if q.Body.Condition != "" {
		out.Condition = api.NewOptString(q.Body.Condition)
	}
	if q.Body.QuantityA != "" {
		out.QuantityA = api.NewOptString(q.Body.QuantityA)
	}
	if q.Body.QuantityB != "" {
		out.QuantityB = api.NewOptString(q.Body.QuantityB)
	}
	return out
}
