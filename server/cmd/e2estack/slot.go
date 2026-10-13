package main

import (
	"fmt"
	"strconv"
)

type stackSlot struct {
	database, apiAddr, oidcAddr, webOrigin string
}

// Шаг и диапазон совпадают с tools/dev/e2e-slot.ts; нулевой слот сохраняет прежние настройки стенда.
func e2eSlot(raw string) (stackSlot, error) {
	if raw == "" {
		raw = "0"
	}
	slot, err := strconv.Atoi(raw)
	if err != nil || slot < 0 || slot > 2872 || strconv.Itoa(slot) != raw {
		return stackSlot{}, fmt.Errorf("invalid E2E_SLOT %q: expected integer from 0 to 2872", raw)
	}
	offset := slot * 20
	database := "greprep_web_e2e"
	if slot != 0 {
		database += "_" + raw
	}
	return stackSlot{
		database:  database,
		apiAddr:   fmt.Sprintf("127.0.0.1:%d", 8093+offset),
		oidcAddr:  fmt.Sprintf("127.0.0.1:%d", 8094+offset),
		webOrigin: fmt.Sprintf("http://localhost:%d", 5191+offset),
	}, nil
}
