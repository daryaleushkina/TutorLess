package main

import "testing"

func TestE2ESlot(t *testing.T) {
	for _, tc := range []struct {
		raw  string
		want stackSlot
	}{
		{"", stackSlot{"greprep_web_e2e", "127.0.0.1:8093", "127.0.0.1:8094", "http://localhost:5191"}},
		{"0", stackSlot{"greprep_web_e2e", "127.0.0.1:8093", "127.0.0.1:8094", "http://localhost:5191"}},
		{"1", stackSlot{"greprep_web_e2e_1", "127.0.0.1:8113", "127.0.0.1:8114", "http://localhost:5211"}},
		{"2872", stackSlot{"greprep_web_e2e_2872", "127.0.0.1:65533", "127.0.0.1:65534", "http://localhost:62631"}},
	} {
		t.Run(tc.raw, func(t *testing.T) {
			got, err := e2eSlot(tc.raw)
			if err != nil || got != tc.want {
				t.Fatalf("e2eSlot(%q) = %+v, %v; want %+v", tc.raw, got, err, tc.want)
			}
		})
	}
}

func TestE2ESlotRejectsInvalid(t *testing.T) {
	for _, raw := range []string{"-1", "1.5", "01", "abc", "2873", "9007199254740992"} {
		if _, err := e2eSlot(raw); err == nil {
			t.Errorf("accepted invalid E2E_SLOT %q", raw)
		}
	}
}
