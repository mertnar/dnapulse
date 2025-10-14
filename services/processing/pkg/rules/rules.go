package rules

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/dnasol/dna-platform/sdks/go-sdk/configclient"
	eventv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/event/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gopkg.in/yaml.v3"
)

// ProcessingConfig represents the processing rules configuration
type ProcessingConfig struct {
	Normalization NormalizationRules `yaml:"normalization" json:"normalization"`
	Enrichment    EnrichmentRules    `yaml:"enrichment" json:"enrichment"`
}

// NormalizationRules defines how to normalize events
type NormalizationRules struct {
	TimestampFormat string   `yaml:"timestamp" json:"timestamp"` // e.g., "rfc3339"
	DropFields      []string `yaml:"drop_fields" json:"drop_fields"`
}

// EnrichmentRules defines how to enrich events
type EnrichmentRules struct {
	LookupTables  map[string]map[string]string `yaml:"lookup_tables" json:"lookup_tables"`
	AddAttributes map[string]string            `yaml:"add_attributes" json:"add_attributes"`
}

// RuleEngine processes events according to the configured rules
type RuleEngine struct {
	config      *ProcessingConfig
	configMu    sync.RWMutex
	client      *configclient.ConfigClient
	configURL   string
	configScope string
}

// NewRuleEngine creates a new rule engine
func NewRuleEngine(configURL, configScope string) *RuleEngine {
	client := configclient.New(configURL)

	return &RuleEngine{
		config:      &ProcessingConfig{}, // Start with empty config
		client:      client,
		configURL:   configURL,
		configScope: configScope,
	}
}

// LoadRules loads processing rules from the Config Service
func (re *RuleEngine) LoadRules(ctx context.Context) error {
	result, err := re.client.Load(ctx, re.configScope, nil)
	if err != nil {
		return fmt.Errorf("failed to load rules: %w", err)
	}

	if result.Status == 200 {
		var newConfig ProcessingConfig
		if err := yaml.Unmarshal([]byte(result.YAML), &newConfig); err != nil {
			return fmt.Errorf("failed to parse rules YAML: %w", err)
		}

		// Validate rules
		if err := re.validateRules(&newConfig); err != nil {
			return fmt.Errorf("invalid rules: %w", err)
		}

		re.configMu.Lock()
		re.config = &newConfig
		re.configMu.Unlock()

		fmt.Printf("Processing rules loaded successfully: %+v\n", re.config)
	}

	return nil
}

// StartHotReload starts watching for rules updates via SSE
func (re *RuleEngine) StartHotReload(ctx context.Context) error {
	return re.client.WatchSSE(ctx, func(scope, etag string) {
		if scope == re.configScope {
			fmt.Printf("Rules update detected for scope: %s, etag: %s\n", scope, etag)

			// Reload rules
			if err := re.LoadRules(ctx); err != nil {
				fmt.Printf("Failed to reload rules: %v\n", err)
			} else {
				fmt.Printf("Rules reloaded successfully for scope: %s\n", scope)
			}
		}
	})
}

// ProcessEvent applies all rules to an event
func (re *RuleEngine) ProcessEvent(ctx context.Context, event *eventv1.Event) (*eventv1.Event, error) {
	re.configMu.RLock()
	config := re.config
	re.configMu.RUnlock()

	// Create a copy of the event to avoid modifying the original
	processedEvent := &eventv1.Event{
		EventId:    event.EventId,
		Source:     event.Source,
		Type:       event.Type,
		Ts:         event.Ts,
		Attributes: make(map[string]string),
		Body:       event.Body,
	}

	// Copy attributes
	for k, v := range event.Attributes {
		processedEvent.Attributes[k] = v
	}

	// Apply normalization rules
	if err := re.applyNormalization(processedEvent, config); err != nil {
		return nil, fmt.Errorf("normalization failed: %w", err)
	}

	// Apply enrichment rules
	if err := re.applyEnrichment(processedEvent, config); err != nil {
		return nil, fmt.Errorf("enrichment failed: %w", err)
	}

	return processedEvent, nil
}

// applyNormalization applies normalization rules to an event
func (re *RuleEngine) applyNormalization(event *eventv1.Event, config *ProcessingConfig) error {
	// Apply timestamp normalization
	if config.Normalization.TimestampFormat == "rfc3339" {
		// Ensure timestamp is in RFC3339 format
		if event.Ts != nil {
			// Timestamp is already in protobuf format, which is RFC3339 compatible
			// Just ensure it's properly formatted
			event.Ts = timestamppb.New(event.Ts.AsTime())
		}
	}

	// Drop specified fields from attributes
	for _, field := range config.Normalization.DropFields {
		delete(event.Attributes, field)
	}

	// Normalize level field (common case)
	if level, exists := event.Attributes["level"]; exists {
		normalizedLevel := strings.ToLower(strings.TrimSpace(level))
		event.Attributes["level"] = normalizedLevel
	}

	return nil
}

// applyEnrichment applies enrichment rules to an event
func (re *RuleEngine) applyEnrichment(event *eventv1.Event, config *ProcessingConfig) error {
	// Apply lookup tables
	for tableName, lookupTable := range config.Enrichment.LookupTables {
		// Check if we have a key to look up
		if key, exists := event.Attributes[tableName]; exists {
			if value, found := lookupTable[key]; found {
				event.Attributes[tableName+"_resolved"] = value
			}
		}
	}

	// Add static attributes
	for key, value := range config.Enrichment.AddAttributes {
		event.Attributes[key] = value
	}

	return nil
}

// GetConfig returns a copy of the current configuration
func (re *RuleEngine) GetConfig() *ProcessingConfig {
	re.configMu.RLock()
	defer re.configMu.RUnlock()

	// Return a copy to prevent race conditions
	configCopy := &ProcessingConfig{
		Normalization: NormalizationRules{
			TimestampFormat: re.config.Normalization.TimestampFormat,
			DropFields:      make([]string, len(re.config.Normalization.DropFields)),
		},
		Enrichment: EnrichmentRules{
			LookupTables:  make(map[string]map[string]string),
			AddAttributes: make(map[string]string),
		},
	}

	copy(configCopy.Normalization.DropFields, re.config.Normalization.DropFields)

	for k, v := range re.config.Enrichment.LookupTables {
		configCopy.Enrichment.LookupTables[k] = make(map[string]string)
		for k2, v2 := range v {
			configCopy.Enrichment.LookupTables[k][k2] = v2
		}
	}

	for k, v := range re.config.Enrichment.AddAttributes {
		configCopy.Enrichment.AddAttributes[k] = v
	}

	return configCopy
}

// validateRules validates the processing rules
func (re *RuleEngine) validateRules(config *ProcessingConfig) error {
	// Validate normalization rules
	if config.Normalization.TimestampFormat != "" &&
		config.Normalization.TimestampFormat != "rfc3339" {
		return fmt.Errorf("unsupported timestamp format: %s", config.Normalization.TimestampFormat)
	}

	return nil
}
