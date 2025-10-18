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

func TestPersistMongoRule(t *testing.T) {
	t.Run("rule creation", func(t *testing.T) {
		rule, err := rules.NewPersistMongoRule(map[string]interface{}{})
		require.NoError(t, err)
		assert.NotNil(t, rule)
		assert.Equal(t, "persist_mongo", rule.Type())
	})

	t.Run("apply without client", func(t *testing.T) {
		rule, err := rules.NewPersistMongoRule(map[string]interface{}{})
		require.NoError(t, err)

		event := &model.Event{
			EventID:    "test-1",
			TenantID:   "tenant-1",
			Timestamp:  time.Now(),
			Kind:       model.EventKindLog,
			Payload:    map[string]interface{}{"data": "test"},
			Attributes: map[string]interface{}{},
		}

		// Should fail because client is not set
		_, err = rule.Apply(context.Background(), event, &model.RuleConfig{})
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not configured")
	})
}
