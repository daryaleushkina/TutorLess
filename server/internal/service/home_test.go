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
	} {
		zone, err := time.LoadLocation(tc.zone)
		if err != nil {
			t.Fatal(err)
		}
		now, err := time.Parse(time.RFC3339, tc.now)
		if err != nil {
			t.Fatal(err)
		}
		start, end := weekBounds(now, zone)
		if start.UTC().Format(time.RFC3339) != tc.start || end.UTC().Format(time.RFC3339) != tc.end {
			t.Errorf("%s: %v..%v", tc.zone, start, end)
		}
	}
}
