package rules

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// DeduplicateRule deduplicates events based on field hashing
type DeduplicateRule struct {
	fields     []string
	ttlSeconds int
	cache      *dedupCache
}

type dedupCache struct {
	mu      sync.RWMutex
	entries map[string]time.Time
}

// NewDeduplicateRule creates a new deduplicate rule
func NewDeduplicateRule(args map[string]interface{}) (pipeline.Rule, error) {
	fieldsRaw, ok := args["fields"]
	if !ok {
		return nil, fmt.Errorf("fields arg required")
	}

	fieldsSlice, ok := fieldsRaw.([]interface{})
	if !ok {
		return nil, fmt.Errorf("fields must be an array")
	}

	fields := make([]string, 0, len(fieldsSlice))
	for _, f := range fieldsSlice {
		if str, ok := f.(string); ok {
			fields = append(fields, str)
		}
	}

	ttl, _ := args["ttl_seconds"].(float64)
	if ttl == 0 {
		ttl = 300 // 5 minutes default
	}

	cache := &dedupCache{
		entries: make(map[string]time.Time),
	}

	rule := &DeduplicateRule{
		fields:     fields,
		ttlSeconds: int(ttl),
		cache:      cache,
	}

	// Start cleanup goroutine
	go rule.cleanupLoop()

	return rule, nil
}

func (r *DeduplicateRule) Name() string {
	return "deduplicate"
}

func (r *DeduplicateRule) Type() string {
	return "deduplicate"
}

func (r *DeduplicateRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	// Compute hash from specified fields
	hash := r.computeHash(event)

	// Check if seen recently
	r.cache.mu.RLock()
	lastSeen, exists := r.cache.entries[hash]
	r.cache.mu.RUnlock()

	if exists && time.Since(lastSeen) < time.Duration(r.ttlSeconds)*time.Second {
		return nil, fmt.Errorf("duplicate event detected")
	}

	// Mark as seen
	r.cache.mu.Lock()
	r.cache.entries[hash] = time.Now()
	r.cache.mu.Unlock()

	return event, nil
}

func (r *DeduplicateRule) computeHash(event *model.Event) string {
	// Collect values from specified fields
	values := make([]string, 0, len(r.fields))

	for _, field := range r.fields {
		var value string
		switch field {
		case "event_id":
			value = event.EventID
		case "tenant_id":
			value = event.TenantID
		case "source":
			value = fmt.Sprintf("%v", event.Source)
		default:
			if v, exists := event.Payload[field]; exists {
				value = fmt.Sprintf("%v", v)
			}
		}
		values = append(values, value)
	}

	// Sort for stable hashing
	sort.Strings(values)

	// Compute SHA256
	data := strings.Join(values, "|")
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (r *DeduplicateRule) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		r.cleanup()
	}
}

func (r *DeduplicateRule) cleanup() {
	r.cache.mu.Lock()
	defer r.cache.mu.Unlock()

	now := time.Now()
	ttl := time.Duration(r.ttlSeconds) * time.Second

	for hash, lastSeen := range r.cache.entries {
		if now.Sub(lastSeen) > ttl {
			delete(r.cache.entries, hash)
		}
	}
}
