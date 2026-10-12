package service

import (
	"fmt"
	"slices"
	"strings"

	"github.com/daryaleushkina/greprepapp/server/internal/api"
	"github.com/daryaleushkina/greprepapp/server/internal/apperr"
	"github.com/daryaleushkina/greprepapp/server/internal/db"
	"github.com/daryaleushkina/greprepapp/server/internal/training"
)

type trainingCapabilities struct {
	Types           []api.QuestionType
	Passage, Figure bool
}

func clientCapabilities(header api.OptString) (trainingCapabilities, error) {
	c := trainingCapabilities{}
	raw, present := header.Get()
	if !present {
		for _, t := range training.LegacyTypes {
			c.Types = append(c.Types, api.QuestionType(t))
		}
		return c, nil
	}
	for token := range strings.SplitSeq(raw, ",") {
		token = strings.TrimSpace(token)
		switch token {
		case "passage":
			c.Passage = true
		case "figure":
			c.Figure = true
		default:
			if !slices.Contains(training.Types, training.Type(token)) {
				return c, apperr.Invalid("unknown training capability", nil)
			}
			if !slices.Contains(c.Types, api.QuestionType(token)) {
				c.Types = append(c.Types, api.QuestionType(token))
			}
		}
	}
	if len(c.Types) == 0 {
		return c, apperr.Invalid("training capabilities need at least one question type", nil)
	}
	return c, nil
}

func (c trainingCapabilities) strings() []string {
	out := make([]string, 0, len(c.Types))
	for _, t := range c.Types {
		out = append(out, string(t))
	}
	return out
}

func (c trainingCapabilities) narrowed(types []api.QuestionType) trainingCapabilities {
	if types == nil {
		return c
	}
	out := c
	out.Types = []api.QuestionType{}
	for _, t := range c.Types {
		if slices.Contains(types, t) {
			out.Types = append(out.Types, t)
		}
	}
	return out
}

func (c trainingCapabilities) checkSession(tr db.Training, rows []db.ListTrainingItemsRow) error {
	for _, t := range tr.QuestionTypes {
		if !slices.Contains(c.Types, api.QuestionType(t)) {
			return unsupportedTraining()
		}
	}
	for _, r := range rows {
		if !slices.Contains(c.Types, api.QuestionType(r.QuestionType)) || (!c.Passage && len(r.Passage) > 0) || (!c.Figure && len(r.Figure) > 0) {
			return unsupportedTraining()
		}
	}
	return nil
}

func unsupportedTraining() error {
	return apperr.New(409, "unsupported_training", "client cannot display this training", nil)
}

func apiNumeric(a training.NumericResponse) api.NumericAnswer {
	out := api.NumericAnswer{}
	if a.Number != "" {
		out.Number = api.NewOptString(a.Number)
	}
	if a.Numerator != "" {
		out.Numerator = api.NewOptString(a.Numerator)
	}
	if a.Denominator != "" {
		out.Denominator = api.NewOptString(a.Denominator)
	}
	return out
}

func numericResponse(a api.NumericAnswer) training.NumericResponse {
	return training.NumericResponse{Number: a.Number.Or(""), Numerator: a.Numerator.Or(""), Denominator: a.Denominator.Or("")}
}

func responseOf(a api.GivenAnswer) training.Response {
	out := training.Response{OptionIDs: a.OptionIds, DontKnow: a.DontKnow, SentenceID: a.SentenceId.Or("")}
	if v, ok := a.NumericAnswer.Get(); ok {
		r := numericResponse(v)
		out.Numeric = &r
	}
	return out
}

func decodeStoredNumeric(raw []byte) (training.NumericResponse, error) {
	var value api.NumericAnswer
	if err := value.UnmarshalJSON(raw); err != nil {
		return training.NumericResponse{}, fmt.Errorf("decode numeric answer: %w", err)
	}
	return numericResponse(value), nil
}
