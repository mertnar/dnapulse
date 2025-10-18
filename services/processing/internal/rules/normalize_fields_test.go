package rules_test

import (
	"context"
	"testing"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/rules"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeFieldsRule(t *testing.T) {
	tests := []struct {
		name        string
		args        map[string]interface{}
		event       *model.Event
		expectError bool
		checkResult func(*testing.T, *model.Event)
	}{
		{
			name: "rename and normalize fields",
			args: map[string]interface{}{
				"mappings": map[string]interface{}{
					"old_name": "new_name",
					"ts":       "timestamp",
					"lvl":      "level",
				},
			},
			event: &model.Event{
				EventID:   "test-1",
				TenantID:  "tenant-1",
				Timestamp: time.Now(),
				Kind:      model.EventKindLog,
				Payload: map[string]interface{}{
					"old_name": "value1",
					"ts":       "2024-01-01",
					"lvl":      "info",
					"keep":     "unchanged",
				},
			},
			expectError: false,
			checkResult: func(t *testing.T, e *model.Event) {
				assert.Equal(t, "value1", e.Payload["new_name"])
				assert.NotContains(t, e.Payload, "old_name")
				assert.Equal(t, "2024-01-01", e.Payload["timestamp"])
				assert.Equal(t, "info", e.Payload["level"])
				assert.Equal(t, "unchanged", e.Payload["keep"])
			},
		},
		{
			name: "type coercion",
			args: map[string]interface{}{
				"mappings": map[string]interface{}{
					"count":  "count",
					"active": "active",
				},
			},
			event: &model.Event{
				EventID:   "test-2",
				TenantID:  "tenant-1",
				Timestamp: time.Now(),
				Kind:      model.EventKindLog,
				Payload: map[string]interface{}{
					"count":  "42",
					"active": "true",
				},
			},
			expectError: false,
			checkResult: func(t *testing.T, e *model.Event) {
				assert.Equal(t, float64(42), e.Payload["count"])
				assert.Equal(t, true, e.Payload["active"])
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, err := rules.NewNormalizeFieldsRule(tt.args)
			require.NoError(t, err)

			result, err := rule.Apply(context.Background(), tt.event, &model.RuleConfig{})

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				if tt.checkResult != nil {
					tt.checkResult(t, result)
				}
			}
		})
	}
}
