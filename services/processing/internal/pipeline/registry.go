package pipeline

import (
	"fmt"
	"sync"
)

// Registry manages rule constructors
type Registry struct {
	mu           sync.RWMutex
	constructors map[string]RuleConstructor
}

// NewRegistry creates a new rule registry
func NewRegistry() *Registry {
	return &Registry{
		constructors: make(map[string]RuleConstructor),
	}
}

// Register registers a rule constructor for a given type
func (r *Registry) Register(ruleType string, constructor RuleConstructor) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.constructors[ruleType]; exists {
		return fmt.Errorf("rule type %s already registered", ruleType)
	}

	r.constructors[ruleType] = constructor
	return nil
}

// Create creates a new rule instance of the given type
func (r *Registry) Create(ruleType string, args map[string]interface{}) (Rule, error) {
	r.mu.RLock()
	constructor, exists := r.constructors[ruleType]
	r.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("unknown rule type: %s", ruleType)
	}

	return constructor(args)
}

// Has checks if a rule type is registered
func (r *Registry) Has(ruleType string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.constructors[ruleType]
	return exists
}

// Types returns all registered rule types
func (r *Registry) Types() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	types := make([]string, 0, len(r.constructors))
	for t := range r.constructors {
		types = append(types, t)
	}
	return types
}
