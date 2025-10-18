package rules

import (
	"context"
	"fmt"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
)

// GeoIPProvider defines the interface for GeoIP lookups
type GeoIPProvider interface {
	Lookup(ctx context.Context, ip string) (*GeoIPResult, error)
}

// GeoIPResult represents GeoIP lookup result
type GeoIPResult struct {
	Country   string  `json:"country"`
	City      string  `json:"city"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// EnrichGeoIPRule enriches events with GeoIP data
type EnrichGeoIPRule struct {
	srcField string
	cacheTTL int
	provider GeoIPProvider
}

// StubGeoIPProvider is a stub implementation for testing
type StubGeoIPProvider struct{}

func (s *StubGeoIPProvider) Lookup(ctx context.Context, ip string) (*GeoIPResult, error) {
	// Stub implementation - returns dummy data
	return &GeoIPResult{
		Country:   "US",
		City:      "New York",
		Latitude:  40.7128,
		Longitude: -74.0060,
	}, nil
}

// NewEnrichGeoIPRule creates a new enrich_geoip rule
func NewEnrichGeoIPRule(args map[string]interface{}) (pipeline.Rule, error) {
	srcField, ok := args["src_field"].(string)
	if !ok || srcField == "" {
		srcField = "ip_address"
	}

	cacheTTL, _ := args["cache_ttl_sec"].(float64)
	if cacheTTL == 0 {
		cacheTTL = 3600
	}

	// Use stub provider by default
	provider := &StubGeoIPProvider{}

	return &EnrichGeoIPRule{
		srcField: srcField,
		cacheTTL: int(cacheTTL),
		provider: provider,
	}, nil
}

func (r *EnrichGeoIPRule) Name() string {
	return "enrich_geoip"
}

func (r *EnrichGeoIPRule) Type() string {
	return "enrich_geoip"
}

func (r *EnrichGeoIPRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	// Get IP address from payload
	ipValue, exists := event.Payload[r.srcField]
	if !exists {
		return event, fmt.Errorf("source field %s not found", r.srcField)
	}

	ip, ok := ipValue.(string)
	if !ok {
		return event, fmt.Errorf("source field %s is not a string", r.srcField)
	}

	// Lookup GeoIP data
	result, err := r.provider.Lookup(ctx, ip)
	if err != nil {
		return event, fmt.Errorf("geoip lookup failed: %w", err)
	}

	// Enrich payload with geo data
	if event.Payload["geo"] == nil {
		event.Payload["geo"] = make(map[string]interface{})
	}

	geoMap, ok := event.Payload["geo"].(map[string]interface{})
	if !ok {
		geoMap = make(map[string]interface{})
		event.Payload["geo"] = geoMap
	}

	geoMap["country"] = result.Country
	geoMap["city"] = result.City
	geoMap["latitude"] = result.Latitude
	geoMap["longitude"] = result.Longitude

	return event, nil
}
