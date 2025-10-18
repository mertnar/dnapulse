package pipeline_test

import (
	"context"
	"testing"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegistry_Register(t *testing.T) {
	registry := pipeline.NewRegistry()

	// Test successful registration
	err := registry.Register("test_rule", func(args map[string]interface{}) (pipeline.Rule, error) {
		return &mockRule{}, nil
	})
	require.NoError(t, err)
	assert.True(t, registry.Has("test_rule"))

	// Test duplicate registration
	err = registry.Register("test_rule", func(args map[string]interface{}) (pipeline.Rule, error) {
		return &mockRule{}, nil
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already registered")
}

func TestRegistry_Create(t *testing.T) {
	registry := pipeline.NewRegistry()

	// Register a mock rule
	registry.Register("mock", func(args map[string]interface{}) (pipeline.Rule, error) {
		return &mockRule{name: "test"}, nil
	})

	// Test successful creation
	rule, err := registry.Create("mock", nil)
	require.NoError(t, err)
	assert.NotNil(t, rule)
	assert.Equal(t, "test", rule.Name())

	// Test unknown rule type
	_, err = registry.Create("unknown", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unknown rule type")
}

func TestRegistry_Types(t *testing.T) {
	registry := pipeline.NewRegistry()

	// Register multiple rules
	registry.Register("rule1", mockConstructor)
	registry.Register("rule2", mockConstructor)
	registry.Register("rule3", mockConstructor)

	types := registry.Types()
	assert.Len(t, types, 3)
	assert.Contains(t, types, "rule1")
	assert.Contains(t, types, "rule2")
	assert.Contains(t, types, "rule3")
}

// Mock rule for testing
type mockRule struct {
	name string
}

func (m *mockRule) Name() string {
	return m.name
}

func (m *mockRule) Type() string {
	return "mock"
}

func (m *mockRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	return event, nil
}

func mockConstructor(args map[string]interface{}) (pipeline.Rule, error) {
	return &mockRule{name: "mock"}, nil
}
