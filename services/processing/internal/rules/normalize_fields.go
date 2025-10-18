package rules

import (
	"context"
	"fmt"
	"strconv"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// NormalizeFieldsRule normalizes and renames fields
type NormalizeFieldsRule struct {
	mappings map[string]string
}

// NewNormalizeFieldsRule creates a new normalize_fields rule
func NewNormalizeFieldsRule(args map[string]interface{}) (pipeline.Rule, error) {
	mappingsRaw, ok := args["mappings"]
	if !ok {
		return nil, fmt.Errorf("mappings arg required")
	}

	mappingsMap, ok := mappingsRaw.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("mappings must be a map")
	}

	mappings := make(map[string]string)
	for k, v := range mappingsMap {
		str, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("mapping value for %s must be a string", k)
		}
		mappings[k] = str
	}

	return &NormalizeFieldsRule{
		mappings: mappings,
	}, nil
}

func (r *NormalizeFieldsRule) Name() string {
	return "normalize_fields"
}

func (r *NormalizeFieldsRule) Type() string {
	return "normalize_fields"
}

func (r *NormalizeFieldsRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	// Apply mappings to payload
	for oldKey, newKey := range r.mappings {
		if value, exists := event.Payload[oldKey]; exists {
			// Type coercion
			coerced := coerceType(value)
			event.Payload[newKey] = coerced
			if oldKey != newKey {
				delete(event.Payload, oldKey)
			}
		}
	}

	return event, nil
}

// coerceType attempts basic type coercion
func coerceType(value interface{}) interface{} {
	switch v := value.(type) {
	case string:
		// Try to convert to number
		if num, err := strconv.ParseFloat(v, 64); err == nil {
			return num
		}
		// Try to convert to bool
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
		return v
	default:
		return v
	}
}
