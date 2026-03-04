package rules

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
)

// PersistESRule persists events to Elasticsearch
type PersistESRule struct {
	client *elasticsearch.Client
	index  string
}

// NewPersistESRule creates a new persist_es rule
func NewPersistESRule(args map[string]interface{}) (pipeline.Rule, error) {
	return &PersistESRule{
		index: "dna-events",
	}, nil
}

// SetClient sets the Elasticsearch client (for dependency injection)
func (r *PersistESRule) SetClient(client interface{}) {
	if esClient, ok := client.(*elasticsearch.Client); ok {
		r.client = esClient
	}
}

// SetIndex sets the index name
func (r *PersistESRule) SetIndex(index string) {
	r.index = index
}

func (r *PersistESRule) Name() string {
	return "persist_es"
}

func (r *PersistESRule) Type() string {
	return "persist_es"
}

func (r *PersistESRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	if r.client == nil {
		return event, fmt.Errorf("elasticsearch client not configured")
	}

	// Prepare document with all metadata
	doc := map[string]interface{}{
		"event_id":        event.EventID,
		"organization_id": event.OrganizationID,
		"data_source_id":  event.DataSourceID,
		"agent_id":        event.AgentID,
		"tenant_id":       event.TenantID,
		"type":            event.Type,
		"@timestamp":      event.Timestamp,
		"ingested_at":     event.IngestedAt,
		"kind":            string(event.Kind),
		"source":          event.Source,
		"payload":         event.Payload,
		"attributes":      event.Attributes,
	}

	// Marshal to JSON
	docBytes, err := json.Marshal(doc)
	if err != nil {
		return event, fmt.Errorf("failed to marshal document: %w", err)
	}

	// Index document
	req := esapi.IndexRequest{
		Index:      r.index,
		DocumentID: event.EventID,
		Body:       bytes.NewReader(docBytes),
		Refresh:    "false",
	}

	res, err := req.Do(ctx, r.client)
	if err != nil {
		return event, fmt.Errorf("failed to index document: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		// Read error body for detailed error message
		var errBody map[string]interface{}
		if err := json.NewDecoder(res.Body).Decode(&errBody); err == nil {
			errJSON, _ := json.Marshal(errBody)
			return event, fmt.Errorf("elasticsearch error: %s - %s", res.Status(), string(errJSON))
		}
		return event, fmt.Errorf("elasticsearch error: %s", res.Status())
	}

	// Mark as persisted
	event.Attributes["persisted_es"] = true

	return event, nil
}
