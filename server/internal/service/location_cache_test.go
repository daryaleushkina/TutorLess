package service

import (
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestLocationCacheReusesZonesAndRejectsUnknown(t *testing.T) {
	t.Parallel()
	calls := 0
	rejected := errors.New("unknown zone")
	c := locationCache{load: func(name string) (*time.Location, error) {
		calls++
		if name == "invalid" {
			return nil, rejected
		}
		return time.FixedZone(name, 0), nil
	}}
	first, err := c.get("UTC")
	if err != nil {
		t.Fatal(err)
	}
	second, err := c.get("UTC")
	if err != nil {
		t.Fatal(err)
	}
	if first != second || calls != 1 {
		t.Fatalf("cached zone reloaded: calls=%d", calls)
	}
	for range 2 {
		if _, err := c.get("invalid"); !errors.Is(err, rejected) {
			t.Fatalf("lost loader error: %v", err)
		}
	}
	if calls != 3 || len(c.entries) != 1 || locationListSize(t, &c) != 1 {
		t.Fatalf("unknown names leaked into cache: calls=%d size=%d", calls, len(c.entries))
	}
}

func TestLocationCacheEvictsLeastRecentlyUsed(t *testing.T) {
	t.Parallel()
	calls := map[string]int{}
	c := locationCache{load: func(name string) (*time.Location, error) { calls[name]++; return time.FixedZone(name, 0), nil }}
	for i := range locationCacheCapacity {
		if _, err := c.get(fmt.Sprint(i)); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := c.get("0"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.get("next"); err != nil {
		t.Fatal(err)
	}
	if _, exists := c.entries["1"]; exists {
		t.Fatal("least recently used zone retained")
	}
	if _, exists := c.entries["0"]; !exists {
		t.Fatal("recent hit was evicted")
	}
	for i := range locationCacheCapacity * 4 {
		if _, err := c.get(fmt.Sprint(i)); err != nil {
			t.Fatal(err)
		}
	}
	if calls["1"] != 2 || len(c.entries) != locationCacheCapacity || locationListSize(t, &c) != locationCacheCapacity {
		t.Fatalf("cache is unbounded or did not reload eviction: calls=%v, size=%d", calls, len(c.entries))
	}
}

func TestLocationCacheConcurrentMisses(t *testing.T) {
	t.Parallel()
	calls := 0
	c := locationCache{load: func(name string) (*time.Location, error) { calls++; return time.FixedZone(name, 0), nil }}
	var wg sync.WaitGroup
	for range 128 {
		wg.Go(func() {
			if _, err := c.get("UTC"); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if calls != 1 || len(c.entries) != 1 {
		t.Fatalf("concurrent misses reloaded zone: calls=%d size=%d", calls, len(c.entries))
	}
}

func TestLocationCacheLoadsIANAWithZeroValue(t *testing.T) {
	t.Parallel()
	var c locationCache
	for _, name := range []string{"UTC", "Asia/Saigon", "America/New_York"} {
		zone, err := c.get(name)
		if err != nil || zone.String() != name {
			t.Fatalf("zone %s: %v %v", name, zone, err)
		}
	}
	if _, err := c.get("Mars/Olympus"); err == nil {
		t.Fatal("unknown IANA name accepted")
	}
}

func locationListSize(t *testing.T, c *locationCache) int {
	t.Helper()
	count := 0
	var previous *locationEntry
	for entry := c.first; entry != nil; entry = entry.next {
		count++
		if count > locationCacheCapacity || entry.previous != previous {
			t.Fatal("invalid or unbounded LRU list")
		}
		previous = entry
	}
	if previous != c.last {
		t.Fatal("LRU tail does not match list")
	}
	return count
}
