package rules

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
	"github.com/xeipuuv/gojsonschema"
)

// ValidateSchemaRule validates payload against a JSON schema
type ValidateSchemaRule struct {
	schemaURL    string
	schemaLoader gojsonschema.JSONLoader
}

// NewValidateSchemaRule creates a new validate_schema rule
func NewValidateSchemaRule(args map[string]interface{}) (pipeline.Rule, error) {
	schemaURL, ok := args["schema_url"].(string)
	if !ok || schemaURL == "" {
		return nil, fmt.Errorf("schema_url arg required")
	}

	// Load schema (can be URL or file path)
	var schemaLoader gojsonschema.JSONLoader
	if len(schemaURL) > 4 && schemaURL[:4] == "http" {
		// Download schema
		schema, err := downloadSchema(schemaURL)
		if err != nil {
			return nil, fmt.Errorf("failed to download schema: %w", err)
		}
		schemaLoader = gojsonschema.NewStringLoader(schema)
	} else {
		// File path
		schemaLoader = gojsonschema.NewReferenceLoader("file://" + schemaURL)
	}

	return &ValidateSchemaRule{
		schemaURL:    schemaURL,
		schemaLoader: schemaLoader,
	}, nil
}

func (r *ValidateSchemaRule) Name() string {
	return "validate_schema"
}

func (r *ValidateSchemaRule) Type() string {
	return "validate_schema"
}

func (r *ValidateSchemaRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	// Marshal payload to JSON
	payloadBytes, err := json.Marshal(event.Payload)
	if err != nil {
		return event, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create document loader
	documentLoader := gojsonschema.NewBytesLoader(payloadBytes)

	// Validate
	result, err := gojsonschema.Validate(r.schemaLoader, documentLoader)
	if err != nil {
		return event, fmt.Errorf("validation error: %w", err)
	}

	if !result.Valid() {
		errMsg := "schema validation failed:"
		for _, desc := range result.Errors() {
			errMsg += fmt.Sprintf("\n  - %s", desc)
		}
		return event, fmt.Errorf("%s", errMsg)
	}

	// Mark as validated
	event.Attributes["schema_validated"] = true

	return event, nil
}

func downloadSchema(url string) (string, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}
