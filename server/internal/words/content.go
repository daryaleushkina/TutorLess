// Package words — проверка карточки словаря; импорт и будущая админка используют тот же договор.
package words

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/daryaleushkina/greprepapp/server/internal/api"
)

// ParseSenses не допускает NULL, неизвестные поля и повреждённое содержимое из базы.
func ParseSenses(data []byte) ([]api.WordSense, error) {
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	var senses []api.WordSense
	if err := d.Decode(&senses); err != nil {
		return nil, fmt.Errorf("decode word senses: %w", err)
	}
	if senses == nil || len(senses) > 100 {
		return nil, errors.New("word senses must be an array of at most 100 meanings")
	}
	if err := d.Decode(new(any)); !errors.Is(err, io.EOF) {
		return nil, errors.New("word senses contain trailing data")
	}
	for i := range senses {
		if err := senses[i].Validate(); err != nil {
			return nil, fmt.Errorf("word sense %d: %w", i+1, err)
		}
	}
	return senses, nil
}
