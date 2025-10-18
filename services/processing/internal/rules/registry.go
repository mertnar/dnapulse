package rules

import (
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// RegisterAll registers all built-in rules to the registry
func RegisterAll(registry *pipeline.Registry) error {
	rules := map[string]pipeline.RuleConstructor{
		"parse_json":       NewParseJSONRule,
		"normalize_fields": NewNormalizeFieldsRule,
		"unit_convert":     NewUnitConvertRule,
		"redact_mask":      NewRedactMaskRule,
		"deduplicate":      NewDeduplicateRule,
		"enrich_geoip":     NewEnrichGeoIPRule,
		"validate_schema":  NewValidateSchemaRule,
		"persist_mongo":    NewPersistMongoRule,
		"persist_es":       NewPersistESRule,
	}

	for ruleType, constructor := range rules {
		if err := registry.Register(ruleType, constructor); err != nil {
			return err
		}
	}

	return nil
}
