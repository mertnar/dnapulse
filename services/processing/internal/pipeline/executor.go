package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/xeipuuv/gojsonschema"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

var tracer = otel.Tracer("processing-pipeline")

// Executor executes a pipeline of rules
type Executor struct {
	registry     *Registry
	config       *model.PipelineConfig
	rules        []Rule
	schemaPath   string
	logger       *zap.Logger
	dlqPublisher DLQPublisher
	mu           sync.RWMutex
}

// DLQPublisher defines the interface for publishing to DLQ
type DLQPublisher interface {
	Publish(ctx context.Context, event *model.Event, reason string) error
}

// ExecutorConfig holds executor configuration
type ExecutorConfig struct {
	Registry     *Registry
	SchemaPath   string
	Logger       *zap.Logger
	DLQPublisher DLQPublisher
}

// NewExecutor creates a new pipeline executor
func NewExecutor(cfg ExecutorConfig) *Executor {
	if cfg.Logger == nil {
		cfg.Logger = zap.NewNop()
	}

	return &Executor{
		registry:     cfg.Registry,
		schemaPath:   cfg.SchemaPath,
		logger:       cfg.Logger,
		dlqPublisher: cfg.DLQPublisher,
	}
}

// LoadPipeline loads and validates a pipeline configuration
func (e *Executor) LoadPipeline(ctx context.Context, config *model.PipelineConfig) error {
	ctx, span := tracer.Start(ctx, "load_pipeline")
	defer span.End()

	// Validate configuration against JSON schema (disabled for now)
	// if e.schemaPath != "" {
	// 	if err := e.validateSchema(config); err != nil {
	// 		span.RecordError(err)
	// 		return fmt.Errorf("schema validation failed: %w", err)
	// 	}
	// }

	// Build rules from configuration
	rules := make([]Rule, 0, len(config.Rules))
	for _, ruleCfg := range config.Rules {
		rule, err := e.registry.Create(ruleCfg.Type, ruleCfg.Args)
		if err != nil {
			span.RecordError(err)
			return fmt.Errorf("failed to create rule %s: %w", ruleCfg.Name, err)
		}
		rules = append(rules, rule)
	}

	// Atomically swap configuration
	e.mu.Lock()
	e.config = config
	e.rules = rules
	e.mu.Unlock()

	e.logger.Info("pipeline loaded",
		zap.Int("version", config.Version),
		zap.Int("rule_count", len(rules)),
	)

	return nil
}

// Execute executes the pipeline on an event
func (e *Executor) Execute(ctx context.Context, event *model.Event) (*model.Event, error) {
	ctx, span := tracer.Start(ctx, "execute_pipeline",
		trace.WithAttributes(
			attribute.String("event_id", event.EventID),
			attribute.String("tenant_id", event.TenantID),
		),
	)
	defer span.End()

	e.mu.RLock()
	config := e.config
	rules := e.rules
	e.mu.RUnlock()

	if config == nil {
		return nil, fmt.Errorf("pipeline not loaded")
	}

	// Work on a clone to preserve original
	current := event.Clone()

	// Execute rules in order
	for i, rule := range rules {
		ruleCfg := &config.Rules[i]

		ctx, ruleSpan := tracer.Start(ctx, "rule_"+rule.Type(),
			trace.WithAttributes(
				attribute.String("rule_name", ruleCfg.Name),
				attribute.String("rule_type", ruleCfg.Type),
			),
		)

		processed, err := rule.Apply(ctx, current, ruleCfg)

		if err != nil {
			ruleSpan.RecordError(err)
			e.logger.Error("rule execution failed",
				zap.String("rule_name", ruleCfg.Name),
				zap.String("rule_type", ruleCfg.Type),
				zap.Error(err),
			)

			// Handle error according to policy
			switch ruleCfg.OnError {
			case model.ErrorPolicySkip:
				e.logger.Warn("skipping rule due to error", zap.String("rule", ruleCfg.Name))
				ruleSpan.End()
				continue

			case model.ErrorPolicyDLQ:
				if e.dlqPublisher != nil {
					dlqErr := e.dlqPublisher.Publish(ctx, event, fmt.Sprintf("rule %s failed: %v", ruleCfg.Name, err))
					if dlqErr != nil {
						e.logger.Error("failed to publish to DLQ", zap.Error(dlqErr))
					}
				}
				ruleSpan.End()
				continue

			case model.ErrorPolicyFail:
				ruleSpan.End()
				span.RecordError(err)
				return nil, fmt.Errorf("pipeline failed at rule %s: %w", ruleCfg.Name, err)

			default:
				ruleSpan.End()
				span.RecordError(err)
				return nil, fmt.Errorf("pipeline failed at rule %s: %w", ruleCfg.Name, err)
			}
		}

		current = processed
		ruleSpan.End()
	}

	return current, nil
}

// GetConfig returns the current pipeline configuration (thread-safe copy)
func (e *Executor) GetConfig() *model.PipelineConfig {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if e.config == nil {
		return nil
	}

	// Return a shallow copy
	configCopy := *e.config
	return &configCopy
}

// validateSchema validates the configuration against the JSON schema
func (e *Executor) validateSchema(config *model.PipelineConfig) error {
	// Read schema file
	schemaBytes, err := os.ReadFile(e.schemaPath)
	if err != nil {
		return fmt.Errorf("failed to read schema file: %w", err)
	}

	// Marshal config to JSON
	configBytes, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Create schema and document loaders
	schemaLoader := gojsonschema.NewBytesLoader(schemaBytes)
	documentLoader := gojsonschema.NewBytesLoader(configBytes)

	// Validate
	result, err := gojsonschema.Validate(schemaLoader, documentLoader)
	if err != nil {
		return fmt.Errorf("validation error: %w", err)
	}

	if !result.Valid() {
		errMsg := "schema validation errors:"
		for _, desc := range result.Errors() {
			errMsg += fmt.Sprintf("\n  - %s", desc)
		}
		return fmt.Errorf("%s", errMsg)
	}

	return nil
}
