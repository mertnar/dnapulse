package rules

import "strings"

// flattenMap recursively flattens nested maps for expression evaluation
func flattenMap(m map[string]interface{}, prefix string, result map[string]interface{}) {
	for key, value := range m {
		fullKey := key
		if prefix != "" {
			fullKey = prefix + "." + key
		}

		switch v := value.(type) {
		case map[string]interface{}:
			flattenMap(v, fullKey, result)
		case float64, int, int64, float32:
			result[key] = v
			if prefix != "" {
				result[fullKey] = v
			}
		default:
			result[key] = v
			if prefix != "" {
				result[fullKey] = v
			}
		}
	}
}

// setNestedField sets a value in a nested map using dot notation
func setNestedField(m map[string]interface{}, path string, value interface{}) {
	keys := splitPath(path)

	// Navigate to the parent map
	current := m
	for i := 0; i < len(keys)-1; i++ {
		key := keys[i]
		if _, exists := current[key]; !exists {
			current[key] = make(map[string]interface{})
		}

		if next, ok := current[key].(map[string]interface{}); ok {
			current = next
		} else {
			// If the path conflicts with existing non-map value, overwrite it
			newMap := make(map[string]interface{})
			current[key] = newMap
			current = newMap
		}
	}

	// Set the final value
	current[keys[len(keys)-1]] = value
}

// getNestedField retrieves a value from a nested map using dot notation
func getNestedField(m map[string]interface{}, path string) interface{} {
	keys := splitPath(path)

	current := interface{}(m)
	for _, key := range keys {
		if currentMap, ok := current.(map[string]interface{}); ok {
			if value, exists := currentMap[key]; exists {
				current = value
			} else {
				return nil
			}
		} else {
			return nil
		}
	}

	return current
}

// splitPath splits a dot-notation path into keys
func splitPath(path string) []string {
	if path == "" {
		return []string{}
	}
	return strings.Split(path, ".")
}
