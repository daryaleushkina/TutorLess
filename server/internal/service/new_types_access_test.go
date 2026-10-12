package service

import (
	"context"
	"testing"

	"github.com/daryaleushkina/greprepapp/server/internal/api"
	"github.com/daryaleushkina/greprepapp/server/internal/apperr"
	"github.com/daryaleushkina/greprepapp/server/internal/db"
)

func TestNewQuestionContentRequiresTrainingRights(t *testing.T) {
	s := &Service{}
	ctx := context.WithValue(context.Background(), principalKey{}, principal{user: db.User{Role: "editor"}})
	caps := api.NewOptString("multiple_choice_multi,numeric_entry,select_in_passage,passage,figure")
	for _, call := range []func() error{
		func() error {
			_, err := s.GetTrainingOptions(ctx, api.GetTrainingOptionsParams{Exam: api.ExamGre, XTrainingCapabilities: caps})
			return err
		},
		func() error {
			_, err := s.StartTraining(ctx, &api.TrainingRequest{}, api.StartTrainingParams{XTrainingCapabilities: caps})
			return err
		},
		func() error {
			_, err := s.GetTraining(ctx, api.GetTrainingParams{XTrainingCapabilities: caps})
			return err
		},
		func() error {
			return s.SubmitTrainingAnswers(ctx, &api.AnswerBatch{}, api.SubmitTrainingAnswersParams{XTrainingCapabilities: caps})
		},
		func() error {
			_, err := s.FinishTraining(ctx, &api.TrainingFinish{}, api.FinishTrainingParams{XTrainingCapabilities: caps})
			return err
		},
		func() error { _, err := s.GetHome(ctx, api.GetHomeParams{XTrainingCapabilities: caps}); return err },
	} {
		err := call()
		app, ok := apperr.As(err)
		if !ok || app.Status != 403 || app.Code != apperr.Forbidden {
			t.Errorf("content without rights: %v", err)
		}
	}
}
