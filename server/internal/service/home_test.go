package service

import (
	"testing"
	"time"
)

func TestWeekBounds(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct{ zone, now, start, end string }{
		{"UTC", "2026-10-11T23:59:59Z", "2026-10-05T00:00:00Z", "2026-10-12T00:00:00Z"},
		{"Asia/Ho_Chi_Minh", "2026-10-11T17:00:00Z", "2026-10-11T17:00:00Z", "2026-10-18T17:00:00Z"},
		{"America/New_York", "2026-11-01T12:00:00Z", "2026-10-26T04:00:00Z", "2026-11-02T05:00:00Z"},
		{"America/New_York", "2026-03-08T12:00:00Z", "2026-03-02T05:00:00Z", "2026-03-09T04:00:00Z"},
		{"America/Santiago", "2026-09-06T12:00:00Z", "2026-08-31T04:00:00Z", "2026-09-07T03:00:00Z"},
		// В Тегеране переход в понедельник: сам первый день недели начинается с 01:00.
		{"Asia/Tehran", "2021-03-22T12:00:00Z", "2021-03-21T20:30:00Z", "2021-03-28T19:30:00Z"},
	} {
		zone, err := time.LoadLocation(tc.zone)
		if err != nil {
			t.Fatal(err)
		}
		now, err := time.Parse(time.RFC3339, tc.now)
		if err != nil {
			t.Fatal(err)
		}
		start, end, _ := weekBounds(now, zone)
		if start.UTC().Format(time.RFC3339) != tc.start || end.UTC().Format(time.RFC3339) != tc.end {
			t.Errorf("%s: %v..%v", tc.zone, start, end)
		}
	}
}

func TestFirstLocalDateInstant(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct{ zone, date, want string }{
		{"UTC", "2026-09-06", "2026-09-06T00:00:00Z"},
		{"America/Santiago", "2026-09-06", "2026-09-06T04:00:00Z"},
		{"Asia/Tehran", "2021-03-22", "2021-03-21T20:30:00Z"},
		// Сдвиг на 15 минут: первый момент даты не обязательно совпадает с началом часа.
		{"Asia/Kathmandu", "1986-01-01", "1985-12-31T18:30:00Z"},
		// Повторная полночь: нужна первая, ещё до перевода часов назад.
		{"America/Havana", "2026-11-01", "2026-11-01T04:00:00Z"},
		// При смене стороны линии дат 30 декабря исчезло целиком.
		{"Pacific/Apia", "2011-12-30", "2011-12-30T10:00:00Z"},
	} {
		t.Run(tc.zone, func(t *testing.T) {
			t.Parallel()
			zone, err := time.LoadLocation(tc.zone)
			if err != nil {
				t.Fatal(err)
			}
			date, err := time.Parse(time.DateOnly, tc.date)
			if err != nil {
				t.Fatal(err)
			}
			start := firstLocalDateInstant(date, zone)
			if got := start.UTC().Format(time.RFC3339); got != tc.want {
				t.Fatalf("first instant of %s: got %s (%v), want %s", tc.date, got, start, tc.want)
			}
		})
	}
}
