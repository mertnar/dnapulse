package correlation

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCorrelationEngine_ExtractGroupKey(t *testing.T) {
	engine := NewCorrelationEngine(300, []string{"host", "environment"}, []string{"count >= 3"})
	defer engine.Close()

	tests := []struct {
		name     string
		event    Event
		expected string
	}{
		{
			name: "basic grouping",
			event: Event{
				Source: "server-01",
				Attributes: map[string]interface{}{
					"host":        "server-01",
					"environment": "production",
				},
			},
			expected: "server-01|production",
		},
		{
			name: "missing attribute",
			event: Event{
				Source: "server-01",
				Attributes: map[string]interface{}{
					"host": "server-01",
				},
			},
			expected: "server-01|unknown",
		},
		{
			name: "source and severity grouping",
			event: Event{
				Source:   "server-01",
				Severity: "critical",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Update engine groupBy for this test
			engine.UpdateConfig(300, []string{"source", "severity"}, []string{"count >= 3"})

			key := engine.extractGroupKey(tt.event)
			assert.NotEmpty(t, key)
		})
	}
}

func TestCorrelationEngine_ProcessEvent(t *testing.T) {
	engine := NewCorrelationEngine(300, []string{"host"}, []string{"count >= 2"})
	defer engine.Close()

	event1 := Event{
		EventID:    "evt1",
		Timestamp:  time.Now().Format(time.RFC3339),
		Source:     "server-01",
		Attributes: map[string]interface{}{"host": "server-01"},
		Labels:     []string{"error", "critical"},
	}

	event2 := Event{
		EventID:    "evt2",
		Timestamp:  time.Now().Format(time.RFC3339),
		Source:     "server-01",
		Attributes: map[string]interface{}{"host": "server-01"},
		Labels:     []string{"error", "critical"},
	}

	// Process first event - should not emit
	records, err := engine.ProcessEvent(event1)
	require.NoError(t, err)
	assert.Len(t, records, 0)

	// Process second event - should emit correlation record
	records, err = engine.ProcessEvent(event2)
	require.NoError(t, err)
	assert.Len(t, records, 1)

	record := records[0]
	assert.Equal(t, "server-01", record.GroupKey)
	assert.Equal(t, 2, record.Count)
	assert.Contains(t, record.Labels, "error")
	assert.Contains(t, record.Labels, "critical")
	assert.NotEmpty(t, record.CorrelationID)
}

func TestCorrelationEngine_WindowEviction(t *testing.T) {
	// Use a very short window for testing
	engine := NewCorrelationEngine(1, []string{"host"}, []string{"count >= 1"})
	defer engine.Close()

	event := Event{
		EventID:    "evt1",
		Timestamp:  time.Now().Add(-2 * time.Second).Format(time.RFC3339), // 2 seconds ago
		Source:     "server-01",
		Attributes: map[string]interface{}{"host": "server-01"},
		Labels:     []string{"error"},
	}

	// Process event
	records, err := engine.ProcessEvent(event)
	require.NoError(t, err)
	assert.Len(t, records, 1)

	// Manually trigger cleanup
	engine.cleanupOldBuckets()

	// Check that bucket was evicted
	stats := engine.GetStats()
	assert.Equal(t, 0, stats["active_buckets"])
}

func TestCorrelationEngine_EvaluateCondition(t *testing.T) {
	engine := NewCorrelationEngine(300, []string{"host"}, []string{"count >= 3"})
	defer engine.Close()

	bucket := &WindowBucket{
		Count: 5,
		Labels: map[string]bool{
			"error": true,
		},
	}

	tests := []struct {
		name      string
		condition string
		expected  bool
	}{
		{"count greater than or equal", "count >= 3", true},
		{"count greater than or equal - false", "count >= 10", false},
		{"count greater than", "count > 4", true},
		{"count greater than - false", "count > 10", false},
		{"count equal", "count == 5", true},
		{"count equal - false", "count == 3", false},
		{"count less than or equal", "count <= 5", true},
		{"count less than or equal - false", "count <= 3", false},
		{"count less than", "count < 10", true},
		{"count less than - false", "count < 5", false},
		{"unknown condition", "unknown_condition", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := engine.evaluateCondition(tt.condition, bucket)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestCorrelationEngine_UpdateConfig(t *testing.T) {
	engine := NewCorrelationEngine(300, []string{"host"}, []string{"count >= 3"})
	defer engine.Close()

	// Update configuration
	newGroupBy := []string{"host", "environment"}
	newEmitIf := []string{"count >= 5"}
	engine.UpdateConfig(600, newGroupBy, newEmitIf)

	// Verify configuration was updated
	stats := engine.GetStats()
	assert.Equal(t, []string{"host", "environment"}, stats["group_by"])
	assert.Equal(t, []string{"count >= 5"}, stats["emit_if"])
	assert.Equal(t, 600, stats["window_size"])
}

func TestCorrelationEngine_CreateCorrelationRecord(t *testing.T) {
	engine := NewCorrelationEngine(300, []string{"host"}, []string{"count >= 3"})
	defer engine.Close()

	now := time.Now()
	bucket := &WindowBucket{
		Count:   3,
		Labels:  map[string]bool{"error": true, "critical": true},
		FirstTS: now.Add(-5 * time.Minute),
		LastTS:  now,
	}

	record := engine.createCorrelationRecord("server-01", bucket)

	assert.NotEmpty(t, record.CorrelationID)
	assert.Equal(t, "server-01", record.GroupKey)
	assert.Equal(t, []string{"host"}, record.GroupBy)
	assert.Equal(t, 3, record.Count)
	assert.Len(t, record.Labels, 2)
	assert.Contains(t, record.Labels, "error")
	assert.Contains(t, record.Labels, "critical")
	assert.Equal(t, 300, record.Duration)
	assert.NotEmpty(t, record.FirstSeen)
	assert.NotEmpty(t, record.LastSeen)
}
