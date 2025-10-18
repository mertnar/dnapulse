package rules

import (
	"context"
	"fmt"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// UnitConvertRule converts units for numeric fields
type UnitConvertRule struct {
	conversions []conversion
}

type conversion struct {
	field string
	from  string
	to    string
}

// NewUnitConvertRule creates a new unit_convert rule
func NewUnitConvertRule(args map[string]interface{}) (pipeline.Rule, error) {
	conversionsRaw, ok := args["conversions"]
	if !ok {
		return nil, fmt.Errorf("conversions arg required")
	}

	conversionsSlice, ok := conversionsRaw.([]interface{})
	if !ok {
		return nil, fmt.Errorf("conversions must be an array")
	}

	conversions := make([]conversion, 0, len(conversionsSlice))
	for _, c := range conversionsSlice {
		cMap, ok := c.(map[string]interface{})
		if !ok {
			continue
		}

		field, _ := cMap["field"].(string)
		from, _ := cMap["from"].(string)
		to, _ := cMap["to"].(string)

		if field != "" && from != "" && to != "" {
			conversions = append(conversions, conversion{
				field: field,
				from:  from,
				to:    to,
			})
		}
	}

	return &UnitConvertRule{
		conversions: conversions,
	}, nil
}

func (r *UnitConvertRule) Name() string {
	return "unit_convert"
}

func (r *UnitConvertRule) Type() string {
	return "unit_convert"
}

func (r *UnitConvertRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	for _, conv := range r.conversions {
		if value, exists := event.Payload[conv.field]; exists {
			if numValue, ok := toFloat64(value); ok {
				converted := convert(numValue, conv.from, conv.to)
				event.Payload[conv.field] = converted
			}
		}
	}

	return event, nil
}

func toFloat64(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int:
		return float64(val), true
	case int64:
		return float64(val), true
	default:
		return 0, false
	}
}

func convert(value float64, from, to string) float64 {
	// Percent conversions
	if from == "percent" && to == "decimal" {
		return value / 100.0
	}
	if from == "decimal" && to == "percent" {
		return value * 100.0
	}

	// Bytes conversions
	if from == "bytes" && to == "KB" {
		return value / 1024.0
	}
	if from == "bytes" && to == "MB" {
		return value / (1024.0 * 1024.0)
	}
	if from == "bytes" && to == "GB" {
		return value / (1024.0 * 1024.0 * 1024.0)
	}

	// Temperature conversions
	if from == "celsius" && to == "fahrenheit" {
		return value*9.0/5.0 + 32.0
	}
	if from == "fahrenheit" && to == "celsius" {
		return (value - 32.0) * 5.0 / 9.0
	}

	// No conversion
	return value
}
