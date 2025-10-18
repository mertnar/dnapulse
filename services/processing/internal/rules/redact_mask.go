package rules

import (
	"context"
	"fmt"
	"strings"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// RedactMaskRule masks sensitive fields
type RedactMaskRule struct {
	fields   []string
	strategy string
}

// NewRedactMaskRule creates a new redact_mask rule
func NewRedactMaskRule(args map[string]interface{}) (pipeline.Rule, error) {
	fieldsRaw, ok := args["fields"]
	if !ok {
		return nil, fmt.Errorf("fields arg required")
	}

	fieldsSlice, ok := fieldsRaw.([]interface{})
	if !ok {
		return nil, fmt.Errorf("fields must be an array")
	}

	fields := make([]string, 0, len(fieldsSlice))
	for _, f := range fieldsSlice {
		if str, ok := f.(string); ok {
			fields = append(fields, str)
		}
	}

	strategy, _ := args["strategy"].(string)
	if strategy == "" {
		strategy = "partial"
	}

	return &RedactMaskRule{
		fields:   fields,
		strategy: strategy,
	}, nil
}

func (r *RedactMaskRule) Name() string {
	return "redact_mask"
}

func (r *RedactMaskRule) Type() string {
	return "redact_mask"
}

func (r *RedactMaskRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	for _, field := range r.fields {
		if value, exists := event.Payload[field]; exists {
			if strValue, ok := value.(string); ok {
				event.Payload[field] = r.mask(strValue, field)
			}
		}
	}

	return event, nil
}

func (r *RedactMaskRule) mask(value, fieldName string) string {
	if r.strategy == "full" {
		return strings.Repeat("*", len(value))
	}

	// Partial masking based on field type
	fieldLower := strings.ToLower(fieldName)

	if strings.Contains(fieldLower, "email") {
		return maskEmail(value)
	}
	if strings.Contains(fieldLower, "card") || strings.Contains(fieldLower, "credit") {
		return maskCard(value)
	}
	if strings.Contains(fieldLower, "ssn") || strings.Contains(fieldLower, "social") {
		return maskSSN(value)
	}

	// Default partial mask
	return maskDefault(value)
}

func maskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "***@***.***"
	}

	localLen := len(parts[0])
	if localLen <= 2 {
		return "**@" + parts[1]
	}

	return parts[0][:1] + strings.Repeat("*", localLen-2) + parts[0][localLen-1:] + "@" + parts[1]
}

func maskCard(card string) string {
	// Remove spaces/dashes
	clean := strings.ReplaceAll(strings.ReplaceAll(card, " ", ""), "-", "")
	if len(clean) < 4 {
		return "****"
	}
	return strings.Repeat("*", len(clean)-4) + clean[len(clean)-4:]
}

func maskSSN(ssn string) string {
	clean := strings.ReplaceAll(strings.ReplaceAll(ssn, "-", ""), " ", "")
	if len(clean) < 4 {
		return "***-**-****"
	}
	return "***-**-" + clean[len(clean)-4:]
}

func maskDefault(value string) string {
	if len(value) <= 4 {
		return strings.Repeat("*", len(value))
	}
	return value[:2] + strings.Repeat("*", len(value)-4) + value[len(value)-2:]
}
