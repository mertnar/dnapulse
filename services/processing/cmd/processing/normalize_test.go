package main

import (
	"testing"

	eventv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/event/v1"
	"github.com/stretchr/testify/assert"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestDetermineSeverity(t *testing.T) {
	tests := []struct {
		name       string
		metricName string
		value      float64
		want       string
	}{
		{
			name:       "CPU critical",
			metricName: "cpu_usage",
			value:      95.0,
			want:       "critical",
		},
		{
			name:       "CPU warning",
			metricName: "cpu_usage",
			value:      80.0,
			want:       "warning",
		},
		{
			name:       "CPU normal",
			metricName: "cpu_usage",
			value:      50.0,
			want:       "info",
		},
		{
			name:       "Memory critical",
			metricName: "memory_usage",
			value:      92.0,
			want:       "critical",
		},
		{
			name:       "Memory warning",
			metricName: "memory_usage",
			value:      85.0,
			want:       "warning",
		},
		{
			name:       "Disk critical",
			metricName: "disk_usage",
			value:      90.0,
			want:       "critical",
		},
		{
			name:       "Disk warning",
			metricName: "disk_usage",
			value:      75.0,
			want:       "warning",
		},
		{
			name:       "Unknown metric",
			metricName: "network_latency",
			value:      100.0,
			want:       "info",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := determineSeverity(tt.metricName, tt.value)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestNormalizeEvent(t *testing.T) {
	// Create a sample event
	originalEvent := &eventv1.Event{
		EventId: "test-123",
		Source:  "test-server",
		Type:    eventv1.EventType_METRIC,
		Ts:      timestamppb.Now(),
		Body: &eventv1.Event_Metric{
			Metric: &eventv1.MetricBody{
				Name:  "cpu_usage",
				Value: 95.5,
				Unit:  "%",
			},
		},
	}

	// Normalize the event
	enriched := normalizeEvent(originalEvent)

	// Assertions
	assert.NotNil(t, enriched)
	assert.Equal(t, "test-123", enriched.EventId)
	assert.NotNil(t, enriched.Attributes)
	assert.Equal(t, "true", enriched.Attributes["is_valid"])
	assert.Equal(t, "critical", enriched.Attributes["severity"])
	assert.NotEmpty(t, enriched.Attributes["processed_at"])

	// Verify metric data is preserved
	metric := enriched.GetMetric()
	assert.NotNil(t, metric)
	assert.Equal(t, "cpu_usage", metric.Name)
	assert.Equal(t, 95.5, metric.Value)
}

func TestNormalizeEventWithoutMetric(t *testing.T) {
	// Create an event without metric body
	originalEvent := &eventv1.Event{
		EventId: "test-456",
		Source:  "test-server",
		Type:    eventv1.EventType_LOG,
		Ts:      timestamppb.Now(),
	}

	// Normalize the event
	enriched := normalizeEvent(originalEvent)

	// Assertions
	assert.NotNil(t, enriched)
	assert.Equal(t, "false", enriched.Attributes["is_valid"])
	assert.Equal(t, "info", enriched.Attributes["severity"])
}
