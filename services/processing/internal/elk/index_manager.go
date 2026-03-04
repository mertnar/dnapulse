package elk

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/elastic/go-elasticsearch/v8"
	"go.uber.org/zap"
)

// IndexManager manages Elasticsearch indexes
type IndexManager struct {
	esClient *elasticsearch.Client
	logger   *zap.Logger
}

// NewIndexManager creates a new index manager
func NewIndexManager(esClient *elasticsearch.Client, logger *zap.Logger) *IndexManager {
	return &IndexManager{
		esClient: esClient,
		logger:   logger,
	}
}

// EnsureIndex ensures an Elasticsearch index exists with the given mapping
func (im *IndexManager) EnsureIndex(ctx context.Context, indexName string, mapping map[string]interface{}) error {
	// Check if index exists
	res, err := im.esClient.Indices.Exists([]string{indexName})
	if err != nil {
		return fmt.Errorf("failed to check index existence: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode == 200 {
		im.logger.Debug("index already exists", zap.String("index", indexName))
		return nil
	}

	// Create index with mapping
	body, err := json.Marshal(map[string]interface{}{
		"mappings": mapping,
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 0,
		},
	})
	if err != nil {
		return fmt.Errorf("failed to marshal index config: %w", err)
	}

	res, err = im.esClient.Indices.Create(
		indexName,
		im.esClient.Indices.Create.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("elasticsearch error: %s", res.Status())
	}

	im.logger.Info("created elasticsearch index", zap.String("index", indexName))
	return nil
}

// WriteEvent writes an event to an Elasticsearch index
func (im *IndexManager) WriteEvent(ctx context.Context, indexName string, event map[string]interface{}) error {
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	res, err := im.esClient.Index(
		indexName,
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("failed to index event: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("elasticsearch error: %s", res.Status())
	}

	return nil
}

// BulkWriteEvents writes multiple events to an Elasticsearch index
func (im *IndexManager) BulkWriteEvents(ctx context.Context, indexName string, events []map[string]interface{}) error {
	if len(events) == 0 {
		return nil
	}

	var buf bytes.Buffer
	for _, event := range events {
		// Action line
		action := map[string]interface{}{
			"index": map[string]interface{}{
				"_index": indexName,
			},
		}
		actionBytes, err := json.Marshal(action)
		if err != nil {
			return fmt.Errorf("failed to marshal action: %w", err)
		}
		buf.Write(actionBytes)
		buf.WriteByte('\n')

		// Document line
		eventBytes, err := json.Marshal(event)
		if err != nil {
			return fmt.Errorf("failed to marshal event: %w", err)
		}
		buf.Write(eventBytes)
		buf.WriteByte('\n')
	}

	res, err := im.esClient.Bulk(bytes.NewReader(buf.Bytes()))
	if err != nil {
		return fmt.Errorf("failed to bulk index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("elasticsearch bulk error: %s", res.Status())
	}

	im.logger.Debug("bulk indexed events",
		zap.String("index", indexName),
		zap.Int("count", len(events)))

	return nil
}
