package pipeline_test

import (
	"context"
	"testing"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestExecutor_LoadPipeline(t *testing.T) {
	registry := pipeline.NewRegistry()
	registry.Register("mock", func(args map[string]interface{}) (pipeline.Rule, error) {
		return &testRule{}, nil
	})

	executor := pipeline.NewExecutor(pipeline.ExecutorConfig{
		Registry: registry,
		Logger:   zap.NewNop(),
	})

	config := &model.PipelineConfig{
		Version: 1,
		Rules: []model.RuleConfig{
			{
				Name:    "test_rule",
				Type:    "mock",
				Args:    map[string]interface{}{},
				OnError: model.ErrorPolicyFail,
			},
		},
	}

	err := executor.LoadPipeline(context.Background(), config)
	require.NoError(t, err)

	loadedConfig := executor.GetConfig()
	assert.NotNil(t, loadedConfig)
	assert.Equal(t, 1, loadedConfig.Version)
	assert.Len(t, loadedConfig.Rules, 1)
}

func TestExecutor_Execute(t *testing.T) {
	tests := []struct {
		name        string
		rules       []model.RuleConfig
		event       *model.Event
		expectError bool
		checkResult func(*testing.T, *model.Event)
	}{
		{
			name: "successful execution",
			rules: []model.RuleConfig{
				{
					Name:    "add_attr",
					Type:    "add_attribute",
					Args:    map[string]interface{}{"key": "processed", "value": "true"},
					OnError: model.ErrorPolicyFail,
				},
			},
			event: &model.Event{
				EventID:    "test-123",
				TenantID:   "tenant-1",
				Timestamp:  time.Now(),
				Kind:       model.EventKindLog,
				Payload:    map[string]interface{}{},
				Attributes: map[string]interface{}{},
			},
			expectError: false,
			checkResult: func(t *testing.T, e *model.Event) {
				assert.Equal(t, "true", e.Attributes["processed"])
			},
		},
		{
			name: "error policy skip",
			rules: []model.RuleConfig{
				{
					Name:    "failing_rule",
					Type:    "error_rule",
					Args:    map[string]interface{}{},
					OnError: model.ErrorPolicySkip,
				},
			},
			event: &model.Event{
				EventID:    "test-123",
				TenantID:   "tenant-1",
				Timestamp:  time.Now(),
				Kind:       model.EventKindLog,
				Payload:    map[string]interface{}{},
				Attributes: map[string]interface{}{},
			},
			expectError: false,
		},
		{
			name: "error policy fail",
			rules: []model.RuleConfig{
				{
					Name:    "failing_rule",
					Type:    "error_rule",
					Args:    map[string]interface{}{},
					OnError: model.ErrorPolicyFail,
				},
			},
			event: &model.Event{
				EventID:    "test-123",
				TenantID:   "tenant-1",
				Timestamp:  time.Now(),
				Kind:       model.EventKindLog,
				Payload:    map[string]interface{}{},
				Attributes: map[string]interface{}{},
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			registry := pipeline.NewRegistry()
			registry.Register("add_attribute", newAddAttributeRule)
			registry.Register("error_rule", newErrorRule)

			executor := pipeline.NewExecutor(pipeline.ExecutorConfig{
				Registry: registry,
				Logger:   zap.NewNop(),
			})

			config := &model.PipelineConfig{
				Version: 1,
				Rules:   tt.rules,
			}

			err := executor.LoadPipeline(context.Background(), config)
			require.NoError(t, err)

			result, err := executor.Execute(context.Background(), tt.event)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				if tt.checkResult != nil {
					tt.checkResult(t, result)
				}
			}
		})
	}
}

// Test rules
type testRule struct{}

func (r *testRule) Name() string { return "test" }
func (r *testRule) Type() string { return "test" }
func (r *testRule) Apply(ctx context.Context, e *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	return e, nil
}

type addAttributeRule struct {
	key   string
	value string
}

func newAddAttributeRule(args map[string]interface{}) (pipeline.Rule, error) {
	return &addAttributeRule{
		key:   args["key"].(string),
		value: args["value"].(string),
	}, nil
}

func (r *addAttributeRule) Name() string { return "add_attribute" }
func (r *addAttributeRule) Type() string { return "add_attribute" }
func (r *addAttributeRule) Apply(ctx context.Context, e *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	e.Attributes[r.key] = r.value
	return e, nil
}

type errorRule struct{}

func newErrorRule(args map[string]interface{}) (pipeline.Rule, error) {
	return &errorRule{}, nil
}

func (r *errorRule) Name() string { return "error_rule" }
func (r *errorRule) Type() string { return "error_rule" }
func (r *errorRule) Apply(ctx context.Context, e *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	return nil, assert.AnError
}
