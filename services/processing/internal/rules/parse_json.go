package rules

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// ParseJSONRule parses JSON from a specified field into payload
type ParseJSONRule struct {
	sourceField string
}

// NewParseJSONRule creates a new parse_json rule
func NewParseJSONRule(args map[string]interface{}) (pipeline.Rule, error) {
	sourceField, ok := args["source_field"].(string)
	if !ok || sourceField == "" {
		sourceField = "raw" // default
	}

	return &ParseJSONRule{
		sourceField: sourceField,
	}, nil
}

func (r *ParseJSONRule) Name() string {
	return "parse_json"
}

func (r *ParseJSONRule) Type() string {
	return "parse_json"
}

func (r *ParseJSONRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	// Get raw data from attributes
	rawData, ok := event.Attributes[r.sourceField]
	if !ok {
		return event, fmt.Errorf("source field %s not found in attributes", r.sourceField)
	}

	// Convert to string if needed
	var jsonStr string
	switch v := rawData.(type) {
	case string:
		jsonStr = v
	case []byte:
		jsonStr = string(v)
	default:
		return event, fmt.Errorf("source field %s is not a string or bytes", r.sourceField)
	}

	// Parse JSON into payload
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &payload); err != nil {
		return event, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Update event payload
	event.Payload = payload

	return event, nil
}
