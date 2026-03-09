package transform

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.uber.org/zap"
)

// DerivedModelTransformer transforms events for derived models
type DerivedModelTransformer struct {
	logger *zap.Logger
}

// NewDerivedModelTransformer creates a new transformer
func NewDerivedModelTransformer(logger *zap.Logger) *DerivedModelTransformer {
	return &DerivedModelTransformer{
		logger: logger,
	}
}

// Transform transforms an event based on derived model's attributes
func (t *DerivedModelTransformer) Transform(ctx context.Context, sourceEvent *model.Event, derivedModel *model.DataModel) (*model.Event, error) {
	// Create new event with only selected attributes
	derivedEvent := &model.Event{
		EventID:        sourceEvent.EventID,
		TenantID:       sourceEvent.TenantID,
		OrganizationID: sourceEvent.OrganizationID,
		DataSourceID:   sourceEvent.DataSourceID,
		AgentID:        sourceEvent.AgentID,
		Kind:           sourceEvent.Kind,
		Source:         sourceEvent.Source,
		Timestamp:      sourceEvent.Timestamp,
		IngestedAt:     sourceEvent.IngestedAt,
		Payload:        make(map[string]interface{}),
		Attributes:     make(map[string]interface{}),
	}

	// First, identify parent paths for nested fields
	parentPaths := make(map[string]bool)
	for _, attr := range derivedModel.Attributes {
		parts := strings.Split(attr.Path, ".")
		// Check if this is a nested field (e.g., "payload.top_processes.name")
		if len(parts) > 2 {
			// Get parent path (e.g., "payload.top_processes")
			parentPath := strings.Join(parts[:len(parts)-1], ".")
			parentPaths[parentPath] = true
		}
	}

	// Extract parent arrays/objects first
	for parentPath := range parentPaths {
		value := extractValue(sourceEvent, parentPath)
		if value != nil {
			setValue(derivedEvent, parentPath, value)
		}
	}

	// Extract only the attributes defined in the derived model
	for _, attr := range derivedModel.Attributes {
		// Skip if attribute has derivation (will be computed)
		if attr.Derivation != nil && len(attr.Derivation) > 0 {
			continue
		}

		// Skip if this is a child of a parent we already extracted
		isChildOfParent := false
		for parentPath := range parentPaths {
			if strings.HasPrefix(attr.Path, parentPath+".") {
				isChildOfParent = true
				break
			}
		}
		if isChildOfParent {
			continue
		}

		// Extract value from source event
		value := extractValue(sourceEvent, attr.Path)
		if value != nil {
			// Set value in derived event
			setValue(derivedEvent, attr.Path, value)
		}
	}

	// Process derived/computed attributes
	for _, attr := range derivedModel.Attributes {
		if attr.Derivation != nil && len(attr.Derivation) > 0 {
			value, err := t.computeDerivedAttribute(ctx, derivedEvent, attr)
			if err != nil {
				t.logger.Warn("failed to compute derived attribute",
					zap.String("attribute", attr.Path),
					zap.Error(err))
				continue
			}
			setValue(derivedEvent, attr.Path, value)
		}
	}

	return derivedEvent, nil
}

// extractValue extracts a value from the event using dot notation path
func extractValue(event *model.Event, path string) interface{} {
	parts := strings.Split(path, ".")

	// Check if path starts with "payload."
	if len(parts) > 0 && parts[0] == "payload" {
		return getNestedValue(event.Payload, parts[1:])
	}

	// Check if path starts with "attributes."
	if len(parts) > 0 && parts[0] == "attributes" {
		return getNestedValue(event.Attributes, parts[1:])
	}

	// Check top-level event fields
	switch parts[0] {
	case "event_id":
		return event.EventID
	case "tenant_id":
		return event.TenantID
	case "organization_id":
		return event.OrganizationID
	case "data_source_id":
		return event.DataSourceID
	case "agent_id":
		return event.AgentID
	case "timestamp":
		return event.Timestamp
	case "source":
		return event.Source
	case "type":
		return event.Kind
	default:
		// Try payload directly
		return getNestedValue(event.Payload, parts)
	}
}

// getNestedValue gets a nested value from a map using path parts
func getNestedValue(data map[string]interface{}, parts []string) interface{} {
	if len(parts) == 0 {
		return nil
	}

	current := data
	for i, part := range parts {
		if current == nil {
			return nil
		}

		value, ok := current[part]
		if !ok {
			return nil
		}

		// If this is the last part, return the value
		if i == len(parts)-1 {
			return value
		}

		// Otherwise, continue traversing
		if nextMap, ok := value.(map[string]interface{}); ok {
			current = nextMap
		} else {
			return nil
		}
	}

	return nil
}

// setValue sets a value in the event using dot notation path
func setValue(event *model.Event, path string, value interface{}) {
	parts := strings.Split(path, ".")

	// Check if path starts with "payload."
	if len(parts) > 0 && parts[0] == "payload" {
		setNestedValue(event.Payload, parts[1:], value)
		return
	}

	// Check if path starts with "attributes."
	if len(parts) > 0 && parts[0] == "attributes" {
		setNestedValue(event.Attributes, parts[1:], value)
		return
	}

	// Otherwise set in payload
	setNestedValue(event.Payload, parts, value)
}

// setNestedValue sets a nested value in a map using path parts
func setNestedValue(data map[string]interface{}, parts []string, value interface{}) {
	if len(parts) == 0 {
		return
	}

	current := data
	for i, part := range parts {
		// If this is the last part, set the value
		if i == len(parts)-1 {
			current[part] = value
			return
		}

		// Otherwise, create nested map if needed
		if _, ok := current[part]; !ok {
			current[part] = make(map[string]interface{})
		}

		if nextMap, ok := current[part].(map[string]interface{}); ok {
			current = nextMap
		} else {
			// Can't traverse further
			return
		}
	}
}

// computeDerivedAttribute computes a derived attribute value
func (t *DerivedModelTransformer) computeDerivedAttribute(ctx context.Context, event *model.Event, attr model.DataModelAttribute) (interface{}, error) {
	derivation := attr.Derivation

	// Get operation type
	operation, ok := derivation["operation"].(string)
	if !ok {
		return nil, fmt.Errorf("missing or invalid operation in derivation")
	}

	switch operation {
	case "math", "derive_math":
		return t.computeMath(event, derivation)
	case "concat", "derive_concat":
		return t.computeConcat(event, derivation)
	case "conditional", "derive_conditional":
		return t.computeConditional(event, derivation)
	case "extract_regex":
		return t.extractRegex(event, derivation)
	case "normalize":
		return t.normalize(event, derivation)
	case "vectorize_openai":
		// Vectorization requires external API call - skip for now
		return nil, fmt.Errorf("vectorize_openai not yet implemented in processing service")
	case "expression":
		// Advanced mode - custom expression
		return t.evaluateExpression(event, derivation)
	default:
		return nil, fmt.Errorf("unsupported derivation operation: %s", operation)
	}
}

// computeMath performs mathematical operations
func (t *DerivedModelTransformer) computeMath(event *model.Event, derivation map[string]interface{}) (interface{}, error) {
	// Try to get expression first (new format from frontend)
	if expression, ok := derivation["expression"].(string); ok {
		return t.evaluateMathExpression(event, expression, derivation)
	}

	// Fallback to operands/operator format (old format)
	operands, ok := derivation["operands"].([]interface{})
	if !ok || len(operands) < 2 {
		return nil, fmt.Errorf("invalid operands for math operation")
	}

	operator, ok := derivation["operator"].(string)
	if !ok {
		return nil, fmt.Errorf("missing operator for math operation")
	}

	// Extract values
	var values []float64
	for _, operand := range operands {
		if path, ok := operand.(string); ok {
			val := extractValue(event, path)
			if numVal, ok := toFloat64(val); ok {
				values = append(values, numVal)
			} else {
				return nil, fmt.Errorf("operand %s is not a number", path)
			}
		}
	}

	if len(values) < 2 {
		return nil, fmt.Errorf("insufficient numeric operands")
	}

	// Perform operation
	result := values[0]
	for i := 1; i < len(values); i++ {
		switch operator {
		case "+":
			result += values[i]
		case "-":
			result -= values[i]
		case "*":
			result *= values[i]
		case "/":
			if values[i] == 0 {
				return nil, fmt.Errorf("division by zero")
			}
			result /= values[i]
		default:
			return nil, fmt.Errorf("unsupported operator: %s", operator)
		}
	}

	return result, nil
}

// evaluateMathExpression evaluates a math expression like "{{a}} + {{b}}"
func (t *DerivedModelTransformer) evaluateMathExpression(event *model.Event, expression string, derivation map[string]interface{}) (interface{}, error) {
	// Get source attributes
	sourceAttrs, ok := derivation["source_attributes"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("missing source_attributes")
	}

	// Replace placeholders with actual values
	expr := expression
	for _, attr := range sourceAttrs {
		if path, ok := attr.(string); ok {
			val := extractValue(event, path)
			if val != nil {
				placeholder := "{{" + path + "}}"
				expr = strings.ReplaceAll(expr, placeholder, fmt.Sprintf("%v", val))
			}
		}
	}

	// Simple expression evaluation (supports +, -, *, /)
	// For production, use a proper expression evaluator
	// For now, just return the expression as-is (would need proper parser)
	return expr, nil
}

// computeConcat concatenates string values
func (t *DerivedModelTransformer) computeConcat(event *model.Event, derivation map[string]interface{}) (interface{}, error) {
	// Try to get source attributes from derivation
	var fields []string

	// Try "source_attributes" (can be []interface{} or []string from BSON)
	if sourceAttrs, ok := derivation["source_attributes"]; ok {
		switch v := sourceAttrs.(type) {
		case []interface{}:
			for _, item := range v {
				if str, ok := item.(string); ok {
					fields = append(fields, str)
				}
			}
		case []string:
			fields = v
		case primitive.A: // BSON array type
			for _, item := range v {
				if str, ok := item.(string); ok {
					fields = append(fields, str)
				}
			}
		}
	}

	// Fallback to "fields" (old format)
	if len(fields) == 0 {
		if fieldsList, ok := derivation["fields"]; ok {
			switch v := fieldsList.(type) {
			case []interface{}:
				for _, item := range v {
					if str, ok := item.(string); ok {
						fields = append(fields, str)
					}
				}
			case []string:
				fields = v
			}
		}
	}

	if len(fields) == 0 {
		return nil, fmt.Errorf("no source attributes found for concat operation")
	}

	separator := " "
	if sep, ok := derivation["separator"].(string); ok {
		separator = sep
	}

	var parts []string
	for _, path := range fields {
		val := extractValue(event, path)
		if val != nil {
			parts = append(parts, fmt.Sprintf("%v", val))
		}
	}

	return strings.Join(parts, separator), nil
}

// computeConditional evaluates conditional logic
func (t *DerivedModelTransformer) computeConditional(event *model.Event, derivation map[string]interface{}) (interface{}, error) {
	condition, ok := derivation["condition"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid condition")
	}

	// Evaluate condition
	result := t.evaluateCondition(event, condition)

	// Return value based on result
	if result {
		if trueValue, ok := derivation["true_value"]; ok {
			return trueValue, nil
		}
	} else {
		if falseValue, ok := derivation["false_value"]; ok {
			return falseValue, nil
		}
	}

	return nil, nil
}

// evaluateCondition evaluates a condition
func (t *DerivedModelTransformer) evaluateCondition(event *model.Event, condition map[string]interface{}) bool {
	field, ok := condition["field"].(string)
	if !ok {
		return false
	}

	operator, ok := condition["operator"].(string)
	if !ok {
		return false
	}

	value := extractValue(event, field)
	compareValue := condition["value"]

	switch operator {
	case "==", "equals":
		return fmt.Sprintf("%v", value) == fmt.Sprintf("%v", compareValue)
	case "!=", "not_equals":
		return fmt.Sprintf("%v", value) != fmt.Sprintf("%v", compareValue)
	case ">", "greater_than":
		if numVal, ok := toFloat64(value); ok {
			if compareNum, ok := toFloat64(compareValue); ok {
				return numVal > compareNum
			}
		}
	case "<", "less_than":
		if numVal, ok := toFloat64(value); ok {
			if compareNum, ok := toFloat64(compareValue); ok {
				return numVal < compareNum
			}
		}
	case ">=", "greater_than_or_equal":
		if numVal, ok := toFloat64(value); ok {
			if compareNum, ok := toFloat64(compareValue); ok {
				return numVal >= compareNum
			}
		}
	case "<=", "less_than_or_equal":
		if numVal, ok := toFloat64(value); ok {
			if compareNum, ok := toFloat64(compareValue); ok {
				return numVal <= compareNum
			}
		}
	case "contains":
		return strings.Contains(fmt.Sprintf("%v", value), fmt.Sprintf("%v", compareValue))
	}

	return false
}

// extractRegex extracts text using regex pattern
func (t *DerivedModelTransformer) extractRegex(event *model.Event, derivation map[string]interface{}) (interface{}, error) {
	// Get source attribute
	var sourceAttr string
	if sourceAttrs, ok := derivation["source_attributes"].([]interface{}); ok && len(sourceAttrs) > 0 {
		if str, ok := sourceAttrs[0].(string); ok {
			sourceAttr = str
		}
	} else if sourceAttrs, ok := derivation["source_attributes"].(primitive.A); ok && len(sourceAttrs) > 0 {
		if str, ok := sourceAttrs[0].(string); ok {
			sourceAttr = str
		}
	}

	if sourceAttr == "" {
		return nil, fmt.Errorf("missing source attribute for extract_regex")
	}

	// Get pattern from params or expression
	var pattern string
	if params, ok := derivation["params"].(map[string]interface{}); ok {
		if p, ok := params["pattern"].(string); ok {
			pattern = p
		}
	}
	if pattern == "" {
		if expr, ok := derivation["expression"].(string); ok {
			pattern = expr
		}
	}

	if pattern == "" {
		return nil, fmt.Errorf("missing regex pattern")
	}

	// Get source value
	val := extractValue(event, sourceAttr)
	if val == nil {
		return nil, nil
	}

	// Convert to string
	str := fmt.Sprintf("%v", val)

	// Compile and execute regex
	re, err := regexp.Compile(pattern)
	if err != nil {
		t.logger.Warn("invalid regex pattern",
			zap.String("pattern", pattern),
			zap.Error(err))
		return nil, fmt.Errorf("invalid regex pattern: %w", err)
	}

	// Extract first match
	match := re.FindString(str)
	if match == "" {
		return nil, nil
	}

	return match, nil
}

// normalize normalizes a value (lowercase, trim, etc.)
func (t *DerivedModelTransformer) normalize(event *model.Event, derivation map[string]interface{}) (interface{}, error) {
	// Get source attribute
	var sourceAttr string
	if sourceAttrs, ok := derivation["source_attributes"].([]interface{}); ok && len(sourceAttrs) > 0 {
		if str, ok := sourceAttrs[0].(string); ok {
			sourceAttr = str
		}
	} else if sourceAttrs, ok := derivation["source_attributes"].(primitive.A); ok && len(sourceAttrs) > 0 {
		if str, ok := sourceAttrs[0].(string); ok {
			sourceAttr = str
		}
	}

	if sourceAttr == "" {
		return nil, fmt.Errorf("missing source attribute for normalize")
	}

	// Get source value
	val := extractValue(event, sourceAttr)
	if val == nil {
		return nil, nil
	}

	// Normalize: lowercase and trim
	str := fmt.Sprintf("%v", val)
	normalized := strings.ToLower(strings.TrimSpace(str))

	return normalized, nil
}

// evaluateExpression evaluates a custom expression (advanced mode)
func (t *DerivedModelTransformer) evaluateExpression(event *model.Event, derivation map[string]interface{}) (interface{}, error) {
	// Get expression
	expression, ok := derivation["expression"].(string)
	if !ok || expression == "" {
		return nil, fmt.Errorf("missing expression")
	}

	// Get source attributes
	var sourceAttrs []string
	if attrs, ok := derivation["source_attributes"].([]interface{}); ok {
		for _, attr := range attrs {
			if str, ok := attr.(string); ok {
				sourceAttrs = append(sourceAttrs, str)
			}
		}
	} else if attrs, ok := derivation["source_attributes"].(primitive.A); ok {
		for _, attr := range attrs {
			if str, ok := attr.(string); ok {
				sourceAttrs = append(sourceAttrs, str)
			}
		}
	}

	// Replace all {{field}} placeholders with actual values
	result := expression
	for _, attrPath := range sourceAttrs {
		val := extractValue(event, attrPath)
		if val != nil {
			// Replace {{attrPath}} with value
			placeholder := "{{" + attrPath + "}}"
			result = strings.ReplaceAll(result, placeholder, fmt.Sprintf("%v", val))

			// Also try without "payload." prefix for convenience
			if strings.HasPrefix(attrPath, "payload.") {
				shortPath := strings.TrimPrefix(attrPath, "payload.")
				shortPlaceholder := "{{" + shortPath + "}}"
				result = strings.ReplaceAll(result, shortPlaceholder, fmt.Sprintf("%v", val))
			}
		}
	}

	// Try to evaluate simple expressions
	result = t.evaluateSimpleExpression(result)

	return result, nil
}

// evaluateSimpleExpression evaluates simple expressions like "5 + 3" or "hello world"
func (t *DerivedModelTransformer) evaluateSimpleExpression(expr string) string {
	// Remove quotes if the entire expression is quoted
	expr = strings.TrimSpace(expr)
	if (strings.HasPrefix(expr, "'") && strings.HasSuffix(expr, "'")) ||
		(strings.HasPrefix(expr, "\"") && strings.HasSuffix(expr, "\"")) {
		return expr[1 : len(expr)-1]
	}

	// Check if it's a simple math expression (e.g., "5 + 3")
	// For production, use a proper expression parser/evaluator
	// For now, just return the expression as-is

	return expr
}

// toFloat64 converts a value to float64
func toFloat64(val interface{}) (float64, bool) {
	switch v := val.(type) {
	case float64:
		return v, true
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int32:
		return float64(v), true
	case int64:
		return float64(v), true
	case uint:
		return float64(v), true
	case uint32:
		return float64(v), true
	case uint64:
		return float64(v), true
	default:
		return 0, false
	}
}
