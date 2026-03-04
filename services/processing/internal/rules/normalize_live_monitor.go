package rules

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// NormalizeLiveMonitorRule adds canonical fields for Live Monitor
type NormalizeLiveMonitorRule struct {
	severityFieldHints []string
	flattenPrefixes    []string
}

// NewNormalizeLiveMonitorRule creates a new normalize_live_monitor rule
func NewNormalizeLiveMonitorRule(args map[string]interface{}) (pipeline.Rule, error) {
	rule := &NormalizeLiveMonitorRule{
		severityFieldHints: []string{"level", "severity", "priority", "log_level"},
		flattenPrefixes:    []string{"cpu", "memory", "disk", "network", "process"},
	}

	// Parse optional severity field hints
	if hints, ok := args["severity_field_hints"].([]interface{}); ok {
		rule.severityFieldHints = make([]string, 0, len(hints))
		for _, hint := range hints {
			if str, ok := hint.(string); ok {
				rule.severityFieldHints = append(rule.severityFieldHints, str)
			}
		}
	}

	// Parse optional flatten prefixes
	if prefixes, ok := args["flatten_prefixes"].([]interface{}); ok {
		rule.flattenPrefixes = make([]string, 0, len(prefixes))
		for _, prefix := range prefixes {
			if str, ok := prefix.(string); ok {
				rule.flattenPrefixes = append(rule.flattenPrefixes, str)
			}
		}
	}

	return rule, nil
}

func (r *NormalizeLiveMonitorRule) Name() string {
	return "normalize_live_monitor"
}

func (r *NormalizeLiveMonitorRule) Type() string {
	return "normalize_live_monitor"
}

func (r *NormalizeLiveMonitorRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	// 1. Add @ts field (canonical timestamp)
	r.addCanonicalTimestamp(event)

	// 2. Add severity (default: info)
	r.addSeverity(event)

	// 3. Extract common fields: event_type, host, user, service
	r.extractCommonFields(event)

	// 4. Create flattened object for hot fields
	r.createFlattenedFields(event)

	return event, nil
}

// addCanonicalTimestamp adds @ts field from payload.timestamp or event.Timestamp
func (r *NormalizeLiveMonitorRule) addCanonicalTimestamp(event *model.Event) {
	// Try various timestamp field names
	timestampFields := []string{"timestamp", "@timestamp", "ts", "time", "event_time"}

	for _, field := range timestampFields {
		if tsValue, exists := event.Payload[field]; exists {
			switch v := tsValue.(type) {
			case string:
				// Try to parse and use as-is if valid
				if _, err := time.Parse(time.RFC3339, v); err == nil {
					event.Payload["@ts"] = v
					return
				}
			case time.Time:
				event.Payload["@ts"] = v.Format(time.RFC3339)
				return
			}
		}
	}

	// Fallback to event.Timestamp
	event.Payload["@ts"] = event.Timestamp.Format(time.RFC3339)
}

// addSeverity infers and adds severity field
func (r *NormalizeLiveMonitorRule) addSeverity(event *model.Event) {
	// If severity already exists, normalize it
	if sev, exists := event.Payload["severity"]; exists {
		event.Payload["severity"] = normalizeSeverity(fmt.Sprintf("%v", sev))
		return
	}

	// Try to find severity from hints
	for _, hint := range r.severityFieldHints {
		if value, exists := event.Payload[hint]; exists {
			severity := inferSeverityFromValue(fmt.Sprintf("%v", value))
			event.Payload["severity"] = severity
			return
		}
	}

	// Check event_type for error/alert indicators
	if eventType, exists := event.Payload["event_type"]; exists {
		eventTypeStr := strings.ToLower(fmt.Sprintf("%v", eventType))
		if strings.Contains(eventTypeStr, "error") || strings.Contains(eventTypeStr, "failure") {
			event.Payload["severity"] = "high"
			return
		}
		if strings.Contains(eventTypeStr, "alert") || strings.Contains(eventTypeStr, "critical") {
			event.Payload["severity"] = "critical"
			return
		}
		if strings.Contains(eventTypeStr, "warn") {
			event.Payload["severity"] = "medium"
			return
		}
	}

	// Default severity
	event.Payload["severity"] = "info"
}

// extractCommonFields extracts event_type, host, user, service from payload
func (r *NormalizeLiveMonitorRule) extractCommonFields(event *model.Event) {
	// Extract event_type if not present
	if _, exists := event.Payload["event_type"]; !exists {
		// Try common field names
		eventTypeFields := []string{"type", "event", "log_type", "category", "action"}
		for _, field := range eventTypeFields {
			if value, exists := event.Payload[field]; exists {
				event.Payload["event_type"] = fmt.Sprintf("%v", value)
				break
			}
		}

		// If still not found, infer from event kind
		if _, exists := event.Payload["event_type"]; !exists {
			event.Payload["event_type"] = string(event.Kind)
		}
	}

	// Extract host if not present
	if _, exists := event.Payload["host"]; !exists {
		hostFields := []string{"hostname", "host_name", "server", "node", "machine"}
		for _, field := range hostFields {
			if value, exists := event.Payload[field]; exists {
				event.Payload["host"] = fmt.Sprintf("%v", value)
				break
			}
		}
	}

	// Extract user if not present
	if _, exists := event.Payload["user"]; !exists {
		userFields := []string{"username", "user_name", "uid", "user_id", "actor"}
		for _, field := range userFields {
			if value, exists := event.Payload[field]; exists {
				event.Payload["user"] = fmt.Sprintf("%v", value)
				break
			}
		}
	}

	// Extract service if not present
	if _, exists := event.Payload["service"]; !exists {
		serviceFields := []string{"service_name", "app", "application", "process_name"}
		for _, field := range serviceFields {
			if value, exists := event.Payload[field]; exists {
				event.Payload["service"] = fmt.Sprintf("%v", value)
				break
			}
		}
	}
}

// createFlattenedFields creates a flattened map of hot fields for indexing
func (r *NormalizeLiveMonitorRule) createFlattenedFields(event *model.Event) {
	flattened := make(map[string]interface{})

	// Flatten specific prefixes (e.g., cpu.*, memory.*, etc.)
	for _, prefix := range r.flattenPrefixes {
		if nestedObj, exists := event.Payload[prefix]; exists {
			if nested, ok := nestedObj.(map[string]interface{}); ok {
				flattenMapWithPrefix(nested, prefix, flattened)
			}
		}
	}

	// Add commonly queried top-level fields
	hotFields := []string{"severity", "event_type", "host", "user", "service", "ip_address", "port", "status", "message"}
	for _, field := range hotFields {
		if value, exists := event.Payload[field]; exists {
			flattened[field] = value
		}
	}

	if len(flattened) > 0 {
		event.Payload["flattened"] = flattened
	}
}

// flattenMapWithPrefix recursively flattens a nested map with dot notation
func flattenMapWithPrefix(nested map[string]interface{}, prefix string, result map[string]interface{}) {
	for key, value := range nested {
		flatKey := prefix + "." + key

		switch v := value.(type) {
		case map[string]interface{}:
			// Recursively flatten nested objects
			flattenMapWithPrefix(v, flatKey, result)
		case []interface{}:
			// For arrays, just store the array as-is (we don't deep-flatten arrays)
			result[flatKey] = v
		default:
			// Store primitive values
			result[flatKey] = v
		}
	}
}

// normalizeSeverity normalizes severity to standard values
func normalizeSeverity(severity string) string {
	severity = strings.ToLower(strings.TrimSpace(severity))

	// Map to standard severities
	switch severity {
	case "critical", "crit", "fatal", "emergency", "emerg", "panic":
		return "critical"
	case "high", "error", "err", "alert":
		return "high"
	case "medium", "warn", "warning":
		return "medium"
	case "low", "notice", "debug":
		return "low"
	case "info", "information", "informational", "trace":
		return "info"
	default:
		return "info"
	}
}

// inferSeverityFromValue infers severity from a field value
func inferSeverityFromValue(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))

	// Try direct mapping first
	normalized := normalizeSeverity(value)
	if normalized != "info" || value == "info" {
		return normalized
	}

	// Try numeric levels (syslog-style)
	switch value {
	case "0", "1":
		return "critical"
	case "2", "3":
		return "high"
	case "4", "5":
		return "medium"
	case "6":
		return "low"
	case "7":
		return "info"
	}

	return "info"
}
