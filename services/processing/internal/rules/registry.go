package rules

import (
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// RegisterAll registers all built-in rules to the registry
func RegisterAll(registry *pipeline.Registry) error {
	rules := map[string]pipeline.RuleConstructor{
		// Existing rules
		"parse_json":            NewParseJSONRule,
		"normalize_fields":      NewNormalizeFieldsRule,
		"normalize_live_monitor": NewNormalizeLiveMonitorRule,
		"unit_convert":          NewUnitConvertRule,
		"redact_mask":           NewRedactMaskRule,
		"deduplicate":           NewDeduplicateRule,
		"enrich_geoip":          NewEnrichGeoIPRule,
		"validate_schema":       NewValidateSchemaRule,
		"persist_mongo":         NewPersistMongoRule,
		"persist_es":            NewPersistESRule,

		// NEW: Derived attribute rules
		"derive_math":        NewDeriveMathRule,
		"derive_concat":      NewDeriveConcatRule,
		"derive_conditional": NewDeriveConditionalRule,
		"vectorize_openai":   NewVectorizeOpenAIRule,
	}

	for ruleType, constructor := range rules {
		if err := registry.Register(ruleType, constructor); err != nil {
			return err
		}
	}

	return nil
}
