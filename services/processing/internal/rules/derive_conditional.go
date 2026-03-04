package rules

import (
	"context"
	"fmt"

	"github.com/Knetic/govaluate"
	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// DeriveConditionalRule applies conditional logic (if-then-else)
type DeriveConditionalRule struct {
	condition   *govaluate.EvaluableExpression
	thenValue   interface{}
	elseValue   interface{}
	outputField string
}

// NewDeriveConditionalRule creates a new conditional derivation rule
func NewDeriveConditionalRule(args map[string]interface{}) (pipeline.Rule, error) {
	conditionStr, ok := args["condition"].(string)
	if !ok || conditionStr == "" {
		return nil, fmt.Errorf("condition is required")
	}

	outputField, ok := args["output_field"].(string)
	if !ok || outputField == "" {
		return nil, fmt.Errorf("output_field is required")
	}

	thenValue, ok := args["then_value"]
	if !ok {
		return nil, fmt.Errorf("then_value is required")
	}

	elseValue, ok := args["else_value"]
	if !ok {
		return nil, fmt.Errorf("else_value is required")
	}

	// Create condition evaluator
	condition, err := govaluate.NewEvaluableExpression(conditionStr)
	if err != nil {
		return nil, fmt.Errorf("invalid condition: %w", err)
	}

	return &DeriveConditionalRule{
		condition:   condition,
		thenValue:   thenValue,
		elseValue:   elseValue,
		outputField: outputField,
	}, nil
}

// Type returns the rule type identifier
func (r *DeriveConditionalRule) Type() string {
	return "derive_conditional"
}

// Name returns the rule name
func (r *DeriveConditionalRule) Name() string {
	return "derive_conditional"
}

// Apply evaluates the condition and sets the appropriate value
func (r *DeriveConditionalRule) Apply(ctx context.Context, event *model.Event, config *model.RuleConfig) (*model.Event, error) {
	// Extract variables from event payload
	parameters := make(map[string]interface{})
	flattenMap(event.Payload, "", parameters)

	// Evaluate condition
	result, err := r.condition.Evaluate(parameters)
	if err != nil {
		return nil, fmt.Errorf("condition evaluation failed: %w", err)
	}

	// Determine which value to use
	var value interface{}
	if boolResult, ok := result.(bool); ok && boolResult {
		value = r.thenValue
	} else {
		value = r.elseValue
	}

	// Set output field
	setNestedField(event.Payload, r.outputField, value)

	return event, nil
}
