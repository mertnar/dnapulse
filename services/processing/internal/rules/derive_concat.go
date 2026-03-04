package rules

import (
	"context"
	"fmt"
	"strings"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// DeriveConcatRule concatenates multiple string fields
type DeriveConcatRule struct {
	fields      []string
	separator   string
	outputField string
}

// NewDeriveConcatRule creates a new string concatenation rule
func NewDeriveConcatRule(args map[string]interface{}) (pipeline.Rule, error) {
	outputField, ok := args["output_field"].(string)
	if !ok || outputField == "" {
		return nil, fmt.Errorf("output_field is required")
	}

	// Get fields to concatenate
	var fields []string
	if fieldsArg, ok := args["fields"].([]interface{}); ok {
		for _, f := range fieldsArg {
			if fieldStr, ok := f.(string); ok {
				fields = append(fields, fieldStr)
			}
		}
	} else if fieldsArg, ok := args["fields"].([]string); ok {
		fields = fieldsArg
	}

	if len(fields) == 0 {
		return nil, fmt.Errorf("at least one field is required")
	}

	// Get separator (default to space)
	separator := " "
	if sep, ok := args["separator"].(string); ok {
		separator = sep
	}

	return &DeriveConcatRule{
		fields:      fields,
		separator:   separator,
		outputField: outputField,
	}, nil
}

// Type returns the rule type identifier
func (r *DeriveConcatRule) Type() string {
	return "derive_concat"
}

// Name returns the rule name
func (r *DeriveConcatRule) Name() string {
	return "derive_concat"
}

// Apply concatenates the specified fields
func (r *DeriveConcatRule) Apply(ctx context.Context, event *model.Event, config *model.RuleConfig) (*model.Event, error) {
	var parts []string

	for _, field := range r.fields {
		value := getNestedField(event.Payload, field)
		if value != nil {
			parts = append(parts, fmt.Sprintf("%v", value))
		}
	}

	// Concatenate and set output
	result := strings.Join(parts, r.separator)
	setNestedField(event.Payload, r.outputField, result)

	return event, nil
}
