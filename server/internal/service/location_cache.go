package service

import (
	"fmt"
	"sync"
	"time"
)

const locationCacheCapacity = 256

type locationEntry struct {
	name           string
	zone           *time.Location
	previous, next *locationEntry
}

// Кэш принадлежит серверу, а не процессу: число зон ограничено, незнакомые имена не сохраняются.
// Нулевое значение готово к работе, в том числе у Service из тестов без конструктора.
type locationCache struct {
	mu          sync.Mutex
	entries     map[string]*locationEntry
	first, last *locationEntry
	load        func(string) (*time.Location, error)
}

func (c *locationCache) get(name string) (*time.Location, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if entry, ok := c.entries[name]; ok {
		if entry != c.first {
			c.remove(entry)
			c.prepend(entry)
		}
		return entry.zone, nil
	}
	load := c.load
	if load == nil {
		load = time.LoadLocation
	}
	// Загрузка под блокировкой объединяет одновременные промахи по одной зоне в одно чтение файла.
	zone, err := load(name)
	if err != nil {
		return nil, fmt.Errorf("load time zone: %w", err)
	}
	if c.entries == nil {
		c.entries = make(map[string]*locationEntry)
	}
	if len(c.entries) == locationCacheCapacity {
		delete(c.entries, c.last.name)
		c.remove(c.last)
	}
	entry := &locationEntry{name: name, zone: zone}
	c.entries[name] = entry
	c.prepend(entry)
	return zone, nil
}

func (c *locationCache) remove(entry *locationEntry) {
	if entry.previous != nil {
		entry.previous.next = entry.next
	} else {
		c.first = entry.next
	}
	if entry.next != nil {
		entry.next.previous = entry.previous
	} else {
		c.last = entry.previous
	}
	entry.previous = nil
	entry.next = nil
}

func (c *locationCache) prepend(entry *locationEntry) {
	entry.next = c.first
	if c.first != nil {
		c.first.previous = entry
	} else {
		c.last = entry
	}
	c.first = entry
}
