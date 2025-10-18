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

func TestParseJSONRule(t *testing.T) {
	tests := []struct {
		name        string
		args        map[string]interface{}
		event       *model.Event
		expectError bool
		checkResult func(*testing.T, *model.Event)
	}{
		{
			name: "parse valid JSON",
			args: map[string]interface{}{
				"source_field": "raw",
			},
			event: &model.Event{
				EventID:   "test-1",
				TenantID:  "tenant-1",
				Timestamp: time.Now(),
				Kind:      model.EventKindLog,
				Attributes: map[string]interface{}{
					"raw": `{"message":"hello","level":"info"}`,
				},
				Payload: map[string]interface{}{},
			},
			expectError: false,
			checkResult: func(t *testing.T, e *model.Event) {
				assert.Equal(t, "hello", e.Payload["message"])
				assert.Equal(t, "info", e.Payload["level"])
			},
		},
		{
			name: "missing source field",
			args: map[string]interface{}{
				"source_field": "raw",
			},
			event: &model.Event{
				EventID:    "test-2",
				TenantID:   "tenant-1",
				Timestamp:  time.Now(),
				Kind:       model.EventKindLog,
				Attributes: map[string]interface{}{},
				Payload:    map[string]interface{}{},
			},
			expectError: true,
		},
		{
			name: "invalid JSON",
			args: map[string]interface{}{
				"source_field": "raw",
			},
			event: &model.Event{
				EventID:   "test-3",
				TenantID:  "tenant-1",
				Timestamp: time.Now(),
				Kind:      model.EventKindLog,
				Attributes: map[string]interface{}{
					"raw": `{"invalid json`,
				},
				Payload: map[string]interface{}{},
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, err := rules.NewParseJSONRule(tt.args)
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
