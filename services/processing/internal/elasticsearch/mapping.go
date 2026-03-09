package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/elastic/go-elasticsearch/v8"
	"go.uber.org/zap"
)

// MappingManager handles Elasticsearch index mappings
type MappingManager struct {
	client *elasticsearch.Client
	logger *zap.Logger
}

// NewMappingManager creates a new mapping manager
func NewMappingManager(client *elasticsearch.Client, logger *zap.Logger) *MappingManager {
	return &MappingManager{
		client: client,
		logger: logger,
	}
}

// EnsureIndexWithMapping ensures an index exists with the correct mapping
func (m *MappingManager) EnsureIndexWithMapping(ctx context.Context, dataModel *model.DataModel) error {
	indexName := dataModel.ELK.IndexName

	// Check if index exists
	res, err := m.client.Indices.Exists([]string{indexName})
	if err != nil {
		return fmt.Errorf("failed to check if index exists: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode == 200 {
		// Index exists, update mapping
		m.logger.Info("index exists, updating mapping",
			zap.String("index", indexName))
		return m.UpdateMapping(ctx, dataModel)
	}

	// Index doesn't exist, create it with mapping
	m.logger.Info("creating index with mapping",
		zap.String("index", indexName))
	return m.CreateIndexWithMapping(ctx, dataModel)
}

// CreateIndexWithMapping creates an index with the given mapping
func (m *MappingManager) CreateIndexWithMapping(ctx context.Context, dataModel *model.DataModel) error {
	indexName := dataModel.ELK.IndexName
	mapping := dataModel.ToELKMapping()

	indexBody := map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 1,
			"index": map[string]interface{}{
				"max_result_window": 10000,
			},
		},
		"mappings": mapping,
	}

	bodyBytes, err := json.Marshal(indexBody)
	if err != nil {
		return fmt.Errorf("failed to marshal index body: %w", err)
	}

	res, err := m.client.Indices.Create(
		indexName,
		m.client.Indices.Create.WithBody(bytes.NewReader(bodyBytes)),
		m.client.Indices.Create.WithContext(ctx),
	)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		var errBody map[string]interface{}
		if err := json.NewDecoder(res.Body).Decode(&errBody); err == nil {
			errJSON, _ := json.Marshal(errBody)
			return fmt.Errorf("elasticsearch error creating index: %s - %s", res.Status(), string(errJSON))
		}
		return fmt.Errorf("elasticsearch error creating index: %s", res.Status())
	}

	m.logger.Info("index created successfully",
		zap.String("index", indexName),
		zap.Int("attributes", len(dataModel.Attributes)),
		zap.Int("schema_fields", len(dataModel.Schema.Fields)))

	return nil
}

// UpdateMapping updates the mapping of an existing index
func (m *MappingManager) UpdateMapping(ctx context.Context, dataModel *model.DataModel) error {
	indexName := dataModel.ELK.IndexName
	mapping := dataModel.ToELKMapping()

	bodyBytes, err := json.Marshal(mapping)
	if err != nil {
		return fmt.Errorf("failed to marshal mapping: %w", err)
	}

	res, err := m.client.Indices.PutMapping(
		[]string{indexName},
		bytes.NewReader(bodyBytes),
		m.client.Indices.PutMapping.WithContext(ctx),
	)
	if err != nil {
		return fmt.Errorf("failed to update mapping: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		var errBody map[string]interface{}
		if err := json.NewDecoder(res.Body).Decode(&errBody); err == nil {
			errJSON, _ := json.Marshal(errBody)
			return fmt.Errorf("elasticsearch error updating mapping: %s - %s", res.Status(), string(errJSON))
		}
		return fmt.Errorf("elasticsearch error updating mapping: %s", res.Status())
	}

	m.logger.Info("mapping updated successfully",
		zap.String("index", indexName),
		zap.Int("attributes", len(dataModel.Attributes)),
		zap.Int("schema_fields", len(dataModel.Schema.Fields)))

	return nil
}

// EnsureAllModelMappings ensures mappings for all data models
func (m *MappingManager) EnsureAllModelMappings(ctx context.Context, registry *model.DataModelRegistry) error {
	// Get all models from registry
	models := registry.GetAllModels()

	for _, dataModel := range models {
		if err := m.EnsureIndexWithMapping(ctx, dataModel); err != nil {
			m.logger.Error("failed to ensure mapping for model",
				zap.String("model_name", dataModel.Name),
				zap.String("index", dataModel.ELK.IndexName),
				zap.Error(err))
			// Continue with other models even if one fails
			continue
		}
	}

	m.logger.Info("ensured mappings for all models", zap.Int("count", len(models)))
	return nil
}
