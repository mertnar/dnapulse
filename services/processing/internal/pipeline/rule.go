package pipeline

import (
	"context"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
)

// Rule defines the interface that all processing rules must implement
type Rule interface {
	// Name returns the rule name
	Name() string

	// Type returns the rule type
	Type() string

	// Apply applies the rule to an event
	Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error)
}

// RuleConstructor is a function that creates a new rule instance
type RuleConstructor func(args map[string]interface{}) (Rule, error)
