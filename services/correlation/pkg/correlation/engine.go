package correlation

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// Event represents a labeled event from categorization service
type Event struct {
	EventID    string                 `json:"event_id"`
	Timestamp  string                 `json:"@timestamp"`
	EventType  string                 `json:"event_type"`
	Source     string                 `json:"source"`
	MetricName string                 `json:"metric_name,omitempty"`
	Value      float64                `json:"value"`
	IsValid    bool                   `json:"is_valid"`
	Severity   string                 `json:"severity"`
	Attributes map[string]interface{} `json:"attributes,omitempty"`
	Labels     []string               `json:"labels,omitempty"`
}

// CorrelationRecord represents a correlation summary
type CorrelationRecord struct {
	CorrelationID string                 `json:"correlation_id"`
	Timestamp     string                 `json:"@timestamp"`
	GroupKey      string                 `json:"group_key"`
	GroupBy       []string               `json:"group_by"`
	Count         int                    `json:"count"`
	Labels        []string               `json:"labels"`
	FirstSeen     string                 `json:"first_seen"`
	LastSeen      string                 `json:"last_seen"`
	Duration      int                    `json:"duration_seconds"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// WindowBucket represents a time window bucket
type WindowBucket struct {
	Count   int
	Labels  map[string]bool
	FirstTS time.Time
	LastTS  time.Time
	Events  []Event
}

// CorrelationEngine handles event correlation and grouping
type CorrelationEngine struct {
	windowStore map[string]*WindowBucket
	mu          sync.RWMutex
	windowSize  time.Duration
	groupBy     []string
	emitIf      []string
	ctx         context.Context
	cancel      context.CancelFunc
}

// NewCorrelationEngine creates a new correlation engine
func NewCorrelationEngine(windowSeconds int, groupBy, emitIf []string) *CorrelationEngine {
	ctx, cancel := context.WithCancel(context.Background())

	engine := &CorrelationEngine{
		windowStore: make(map[string]*WindowBucket),
		windowSize:  time.Duration(windowSeconds) * time.Second,
		groupBy:     groupBy,
		emitIf:      emitIf,
		ctx:         ctx,
		cancel:      cancel,
	}

	// Start cleanup routine
	go engine.startCleanupRoutine()

	return engine
}

// ProcessEvent processes an incoming event and returns correlation records if any
func (ce *CorrelationEngine) ProcessEvent(event Event) ([]CorrelationRecord, error) {
	ce.mu.Lock()
	defer ce.mu.Unlock()

	// Extract group key
	groupKey := ce.extractGroupKey(event)
	if groupKey == "" {
		return nil, fmt.Errorf("failed to extract group key from event")
	}

	// Parse event timestamp
	eventTS, err := time.Parse(time.RFC3339, event.Timestamp)
	if err != nil {
		logrus.Warnf("Failed to parse event timestamp %s: %v", event.Timestamp, err)
		eventTS = time.Now()
	}

	// Get or create bucket
	bucket, exists := ce.windowStore[groupKey]
	if !exists {
		bucket = &WindowBucket{
			Labels:  make(map[string]bool),
			FirstTS: eventTS,
			LastTS:  eventTS,
			Events:  make([]Event, 0),
		}
		ce.windowStore[groupKey] = bucket
	}

	// Update bucket
	bucket.Count++
	bucket.LastTS = eventTS
	bucket.Events = append(bucket.Events, event)

	// Add labels to the bucket
	for _, label := range event.Labels {
		bucket.Labels[label] = true
	}

	// Check if we should emit correlation records
	var correlationRecords []CorrelationRecord
	for _, condition := range ce.emitIf {
		if ce.evaluateCondition(condition, bucket) {
			record := ce.createCorrelationRecord(groupKey, bucket)
			correlationRecords = append(correlationRecords, record)
			break // Only emit once per event
		}
	}

	return correlationRecords, nil
}

// UpdateConfig updates the engine configuration atomically
func (ce *CorrelationEngine) UpdateConfig(windowSeconds int, groupBy, emitIf []string) {
	ce.mu.Lock()
	defer ce.mu.Unlock()

	ce.windowSize = time.Duration(windowSeconds) * time.Second
	ce.groupBy = groupBy
	ce.emitIf = emitIf

	logrus.Infof("Correlation engine config updated: window=%ds, groupBy=%v, emitIf=%v",
		windowSeconds, groupBy, emitIf)
}

// extractGroupKey extracts the group key from an event based on groupBy fields
func (ce *CorrelationEngine) extractGroupKey(event Event) string {
	var keyParts []string

	for _, field := range ce.groupBy {
		var value string

		switch field {
		case "source":
			value = event.Source
		case "event_type":
			value = event.EventType
		case "severity":
			value = event.Severity
		case "metric_name":
			value = event.MetricName
		default:
			// Try to get from attributes
			if event.Attributes != nil {
				if attrValue, exists := event.Attributes[field]; exists {
					if str, ok := attrValue.(string); ok {
						value = str
					} else {
						value = fmt.Sprintf("%v", attrValue)
					}
				}
			}
		}

		if value == "" {
			value = "unknown"
		}
		keyParts = append(keyParts, value)
	}

	return strings.Join(keyParts, "|")
}

// evaluateCondition evaluates an emit-if condition against a bucket
func (ce *CorrelationEngine) evaluateCondition(condition string, bucket *WindowBucket) bool {
	// Simple condition evaluation for now
	// In a real implementation, you might want to use a proper expression evaluator

	condition = strings.TrimSpace(condition)

	// Parse simple conditions like "count >= 3", "count == 5", etc.
	if strings.Contains(condition, "count >=") {
		var threshold int
		if _, err := fmt.Sscanf(condition, "count >= %d", &threshold); err == nil {
			return bucket.Count >= threshold
		}
	}

	if strings.Contains(condition, "count >") {
		var threshold int
		if _, err := fmt.Sscanf(condition, "count > %d", &threshold); err == nil {
			return bucket.Count > threshold
		}
	}

	if strings.Contains(condition, "count ==") {
		var threshold int
		if _, err := fmt.Sscanf(condition, "count == %d", &threshold); err == nil {
			return bucket.Count == threshold
		}
	}

	if strings.Contains(condition, "count <=") {
		var threshold int
		if _, err := fmt.Sscanf(condition, "count <= %d", &threshold); err == nil {
			return bucket.Count <= threshold
		}
	}

	if strings.Contains(condition, "count <") {
		var threshold int
		if _, err := fmt.Sscanf(condition, "count < %d", &threshold); err == nil {
			return bucket.Count < threshold
		}
	}

	// Default to false for unknown conditions
	return false
}

// createCorrelationRecord creates a correlation record from a bucket
func (ce *CorrelationEngine) createCorrelationRecord(groupKey string, bucket *WindowBucket) CorrelationRecord {
	// Extract labels as slice
	var labels []string
	for label := range bucket.Labels {
		labels = append(labels, label)
	}
	sort.Strings(labels)

	// Calculate duration
	duration := int(bucket.LastTS.Sub(bucket.FirstTS).Seconds())

	// Generate correlation ID
	correlationID := fmt.Sprintf("corr_%d_%s", time.Now().UnixNano(), groupKey)

	return CorrelationRecord{
		CorrelationID: correlationID,
		Timestamp:     time.Now().Format(time.RFC3339),
		GroupKey:      groupKey,
		GroupBy:       ce.groupBy,
		Count:         bucket.Count,
		Labels:        labels,
		FirstSeen:     bucket.FirstTS.Format(time.RFC3339),
		LastSeen:      bucket.LastTS.Format(time.RFC3339),
		Duration:      duration,
		Metadata: map[string]interface{}{
			"window_size_seconds": int(ce.windowSize.Seconds()),
			"events_in_window":    len(bucket.Events),
		},
	}
}

// startCleanupRoutine starts the routine to clean up old buckets
func (ce *CorrelationEngine) startCleanupRoutine() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ce.ctx.Done():
			return
		case <-ticker.C:
			ce.cleanupOldBuckets()
		}
	}
}

// cleanupOldBuckets removes buckets that are older than the window size
func (ce *CorrelationEngine) cleanupOldBuckets() {
	ce.mu.Lock()
	defer ce.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-ce.windowSize)

	var toDelete []string
	for key, bucket := range ce.windowStore {
		if bucket.LastTS.Before(cutoff) {
			toDelete = append(toDelete, key)
		}
	}

	for _, key := range toDelete {
		delete(ce.windowStore, key)
	}

	if len(toDelete) > 0 {
		logrus.Debugf("Cleaned up %d old buckets", len(toDelete))
	}
}

// GetStats returns statistics about the correlation engine
func (ce *CorrelationEngine) GetStats() map[string]interface{} {
	ce.mu.RLock()
	defer ce.mu.RUnlock()

	return map[string]interface{}{
		"active_buckets": len(ce.windowStore),
		"window_size":    int(ce.windowSize.Seconds()),
		"group_by":       ce.groupBy,
		"emit_if":        ce.emitIf,
	}
}

// Close shuts down the correlation engine
func (ce *CorrelationEngine) Close() {
	ce.cancel()
}
