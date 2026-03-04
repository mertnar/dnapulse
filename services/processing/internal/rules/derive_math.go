package rules

import (
	"context"
	"fmt"

	"github.com/Knetic/govaluate"
	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// DeriveMathRule performs mathematical operations on event fields
type DeriveMathRule struct {
	expression   string
	evaluator    *govaluate.EvaluableExpression
	outputField  string
	inputField   string
}

// NewDeriveMathRule creates a new mathematical derivation rule
func NewDeriveMathRule(args map[string]interface{}) (pipeline.Rule, error) {
	expr, ok := args["expression"].(string)
	if !ok || expr == "" {
		return nil, fmt.Errorf("expression is required")
	}

	outputField, ok := args["output_field"].(string)
	if !ok || outputField == "" {
		return nil, fmt.Errorf("output_field is required")
	}

	// Optional input field for simple operations
	inputField, _ := args["input_field"].(string)

	// Create evaluator
	evaluator, err := govaluate.NewEvaluableExpression(expr)
	if err != nil {
		return nil, fmt.Errorf("invalid expression: %w", err)
	}

	return &DeriveMathRule{
		expression:  expr,
		evaluator:   evaluator,
		outputField: outputField,
		inputField:  inputField,
	}, nil
}

// Type returns the rule type identifier
func (r *DeriveMathRule) Type() string {
	return "derive_math"
}

// Name returns the rule name
func (r *DeriveMathRule) Name() string {
	return "derive_math"
}

// Apply executes the mathematical expression on the event
func (r *DeriveMathRule) Apply(ctx context.Context, event *model.Event, config *model.RuleConfig) (*model.Event, error) {
	// Extract variables from event payload
	parameters := make(map[string]interface{})

	// Flatten nested fields for expression evaluation
	flattenMap(event.Payload, "", parameters)

	// Evaluate expression
	result, err := r.evaluator.Evaluate(parameters)
	if err != nil {
		return nil, fmt.Errorf("evaluation failed for expression '%s': %w", r.expression, err)
	}

	// Set output field in payload
	setNestedField(event.Payload, r.outputField, result)

	return event, nil
}
