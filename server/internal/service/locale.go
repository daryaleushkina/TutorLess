package service

import (
	"context"
	"fmt"

	"github.com/daryaleushkina/greprepapp/server/internal/api"
	"github.com/daryaleushkina/greprepapp/server/internal/db"
)

// SetLocale меняет язык аккаунта: следующий запрос с любого устройства прочитает его из users.
func (s *Service) SetLocale(ctx context.Context, req *api.LocaleChoice) (*api.User, error) {
	p, err := principalFrom(ctx)
	if err != nil {
		return nil, err
	}
	qctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	// Собираем полный ответ до записи: отказ чтения identities не меняет язык при ответе 500.
	user, err := s.apiUser(qctx, p.user)
	if err != nil {
		return nil, err
	}
	if err := s.q.SetUserLocale(qctx, db.SetUserLocaleParams{UserID: p.user.ID, Locale: string(req.Locale)}); err != nil {
		return nil, fmt.Errorf("set user locale: %w", err)
	}
	user.Locale = req.Locale
	return &user, nil
}
