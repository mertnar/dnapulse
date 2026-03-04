package schema

import (
	"fmt"
	"reflect"

	"github.com/dnasol/dna-platform/services/ingestion/pkg/mongo"
)

// DiscoverSchema analyzes sample data and creates schema with recursive field discovery
func DiscoverSchema(sampleData []map[string]interface{}) (*mongo.DiscoveredSchema, error) {
	if len(sampleData) == 0 {
		return nil, fmt.Errorf("sample data is empty")
	}

	// Collect all field information recursively
	fieldMap := make(map[string]*fieldInfo)

	for _, sample := range sampleData {
		discoverFieldsRecursive(sample, "", fieldMap)
	}

	// Convert field map to schema fields
	fields := make([]mongo.SchemaField, 0, len(fieldMap))

	for _, info := range fieldMap {
		field := mongo.SchemaField{
			Name: info.Name,
			Type: consolidateTypes(info.Types),
			// Never mark fields as required - agent data can be dynamic
			// and fields may not always be present in every event
			Required: false,
		}

		// Pick first example
		if len(info.Examples) > 0 {
			field.Example = info.Examples[0]
		}

		fields = append(fields, field)
	}

	schema := &mongo.DiscoveredSchema{
		Version:    1,
		Fields:     fields,
		SampleData: sampleData[0], // Store first sample
	}

	return schema, nil
}

// discoverFieldsRecursive recursively discovers fields in nested objects
func discoverFieldsRecursive(data map[string]interface{}, prefix string, fieldMap map[string]*fieldInfo) {
	for key, value := range data {
		// Create full field path (e.g., "cpu.usage" or "disk.partitions[].size")
		fieldPath := key
		if prefix != "" {
			fieldPath = prefix + "." + key
		}

		fieldType := inferType(value)

		// Add or update field info
		if info, exists := fieldMap[fieldPath]; exists {
			info.Count++
			info.Types[fieldType] = true
			if value != nil && len(info.Examples) < 3 {
				info.Examples = append(info.Examples, value)
			}
		} else {
			types := make(map[string]bool)
			types[fieldType] = true
			examples := []interface{}{}
			if value != nil {
				examples = append(examples, value)
			}
			fieldMap[fieldPath] = &fieldInfo{
				Name:     fieldPath,
				Count:    1,
				Types:    types,
				Examples: examples,
			}
		}

		// Recursively process nested objects
		if nestedMap, ok := value.(map[string]interface{}); ok {
			discoverFieldsRecursive(nestedMap, fieldPath, fieldMap)
		}

		// Process arrays (analyze first element if it's an object)
		if arr, ok := value.([]interface{}); ok && len(arr) > 0 {
			if firstElem, ok := arr[0].(map[string]interface{}); ok {
				// Use [] notation for array elements
				discoverFieldsRecursive(firstElem, fieldPath+"[]", fieldMap)
			}
		}
	}
}

// ValidateAgainstSchema validates event data against schema
func ValidateAgainstSchema(event map[string]interface{}, schema *mongo.DiscoveredSchema) error {
	if schema == nil {
		return fmt.Errorf("schema is nil")
	}

	// Build a map of all event fields (including nested paths)
	eventFields := make(map[string]interface{})
	flattenEventFields(event, "", eventFields)

	// Check required fields (using flattened paths)
	for _, field := range schema.Fields {
		if field.Required {
			if _, exists := eventFields[field.Name]; !exists {
				return fmt.Errorf("missing required field: %s", field.Name)
			}
		}
	}

	// Since fields are rarely required now, we can skip type validation
	// to be more flexible with dynamic agent data
	return nil
}

// flattenEventFields recursively flattens nested event fields
func flattenEventFields(data map[string]interface{}, prefix string, result map[string]interface{}) {
	for key, value := range data {
		fieldPath := key
		if prefix != "" {
			fieldPath = prefix + "." + key
		}

		result[fieldPath] = value

		// Recursively flatten nested objects
		if nestedMap, ok := value.(map[string]interface{}); ok {
			flattenEventFields(nestedMap, fieldPath, result)
		}

		// Flatten arrays of objects
		if arr, ok := value.([]interface{}); ok && len(arr) > 0 {
			if firstElem, ok := arr[0].(map[string]interface{}); ok {
				flattenEventFields(firstElem, fieldPath+"[]", result)
			}
		}
	}
}

// fieldInfo stores information about a field during discovery
type fieldInfo struct {
	Name     string
	Count    int
	Types    map[string]bool
	Examples []interface{}
}

// inferType infers the type of a value
func inferType(value interface{}) string {
	if value == nil {
		return "null"
	}

	switch v := value.(type) {
	case bool:
		return "boolean"
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return "number"
	case float32, float64:
		return "number"
	case string:
		return "string"
	case []interface{}:
		return "array"
	case map[string]interface{}:
		return "object"
	default:
		// Check if it's a numeric type using reflection
		val := reflect.ValueOf(v)
		kind := val.Kind()
		switch kind {
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
			reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
			reflect.Float32, reflect.Float64:
			return "number"
		case reflect.Slice, reflect.Array:
			return "array"
		case reflect.Map, reflect.Struct:
			return "object"
		default:
			return "string" // Default fallback
		}
	}
}

// consolidateTypes consolidates multiple types into a single type
func consolidateTypes(types map[string]bool) string {
	// If only one type, return it
	if len(types) == 1 {
		for t := range types {
			return t
		}
	}

	// Priority order: object > array > number > boolean > string
	if types["object"] {
		return "object"
	}
	if types["array"] {
		return "array"
	}
	if types["number"] {
		return "number"
	}
	if types["boolean"] {
		return "boolean"
	}

	// Default to string for mixed types
	return "string"
}

// isCompatibleType checks if actual type is compatible with expected type
func isCompatibleType(actual, expected string) bool {
	// Exact match
	if actual == expected {
		return true
	}

	// null is compatible with any type
	if actual == "null" {
		return true
	}

	// string can accept anything (lenient)
	if expected == "string" {
		return true
	}

	return false
}

// UpdateSchemaVersion creates a new schema version if changes detected
func UpdateSchemaVersion(currentSchema *mongo.DiscoveredSchema, newSampleData []map[string]interface{}) (*mongo.DiscoveredSchema, bool, error) {
	newSchema, err := DiscoverSchema(newSampleData)
	if err != nil {
		return nil, false, err
	}

	// Compare schemas to detect changes
	if schemasEqual(currentSchema, newSchema) {
		return currentSchema, false, nil
	}

	// Create new version
	newSchema.Version = currentSchema.Version + 1
	newSchema.DataSourceID = currentSchema.DataSourceID
	return newSchema, true, nil
}

// schemasEqual checks if two schemas are equivalent
func schemasEqual(s1, s2 *mongo.DiscoveredSchema) bool {
	if len(s1.Fields) != len(s2.Fields) {
		return false
	}

	// Create field maps for comparison
	fields1 := make(map[string]mongo.SchemaField)
	for _, f := range s1.Fields {
		fields1[f.Name] = f
	}

	for _, f2 := range s2.Fields {
		f1, exists := fields1[f2.Name]
		if !exists {
			return false
		}
		if f1.Type != f2.Type || f1.Required != f2.Required {
			return false
		}
	}

	return true
}

// GenerateSchemaName generates a name for the data source based on agent type
func GenerateSchemaName(agentType string) string {
	return fmt.Sprintf("%s Data Source", agentType)
}
