package model

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/zap"
)

// DataModel represents a data model from MongoDB
type DataModel struct {
	ID             primitive.ObjectID  `bson:"_id,omitempty"`
	OrganizationID primitive.ObjectID  `bson:"organization_id"`
	Name           string              `bson:"name"`
	DataIndex      string              `bson:"data_index"`
	Type           string              `bson:"type"` // root, derived, composite, vector
	Version        int                 `bson:"version"`
	Status         string              `bson:"status"`
	Source         DataModelSource     `bson:"source"`
	Schema         DataModelSchema     `bson:"schema"`
	Processing     *DataModelPipeline  `bson:"processing,omitempty"`
	Composite      *CompositeConfig    `bson:"composite,omitempty"`
	ELK            ELKConfig           `bson:"elk"`
	CreatedAt      time.Time           `bson:"created_at"`
	UpdatedAt      time.Time           `bson:"updated_at"`
	CreatedBy      string              `bson:"created_by"`
}

type DataModelSource struct {
	DataSourceIDs []primitive.ObjectID `bson:"data_source_ids"`
	AgentType     string               `bson:"agent_type,omitempty"`
	SourceType    string               `bson:"source_type,omitempty"`
}

type DataModelSchema struct {
	Fields []SchemaField `bson:"fields"`
}

type SchemaField struct {
	Path        string      `bson:"path"`
	Type        string      `bson:"type"`
	Required    bool        `bson:"required,omitempty"`
	Indexed     bool        `bson:"indexed,omitempty"`
	Description string      `bson:"description,omitempty"`
	Example     interface{} `bson:"example,omitempty"`
	Status      string      `bson:"status,omitempty"`
}

type DataModelPipeline struct {
	Pipeline []PipelineStep `bson:"pipeline"`
}

type PipelineStep struct {
	ID        string                 `bson:"id"`
	Operation string                 `bson:"operation"`
	When      string                 `bson:"when,omitempty"`
	Inputs    []PipelineField        `bson:"inputs"`
	Params    map[string]interface{} `bson:"params,omitempty"`
	Outputs   []PipelineField        `bson:"outputs"`
}

type PipelineField struct {
	Field string `bson:"field"`
	Type  string `bson:"type,omitempty"`
}

type CompositeConfig struct {
	JoinType      string    `bson:"join_type"`
	TimeWindowSec int       `bson:"time_window_sec"`
	JoinKeys      []JoinKey `bson:"join_keys"`
}

type JoinKey struct {
	LeftModelID  primitive.ObjectID `bson:"left_model_id"`
	LeftField    string             `bson:"left_field"`
	RightModelID primitive.ObjectID `bson:"right_model_id"`
	RightField   string             `bson:"right_field"`
}

type ELKConfig struct {
	IndexName    string     `bson:"index_name"`
	TemplateName string     `bson:"template_name,omitempty"`
	MappingHash  string     `bson:"mapping_hash,omitempty"`
	LastWriteAt  *time.Time `bson:"last_write_at,omitempty"`
}

// ToELKMapping converts schema fields to Elasticsearch mapping
func (s *DataModelSchema) ToELKMapping() map[string]interface{} {
	properties := make(map[string]interface{})

	for _, field := range s.Fields {
		var elkType string
		switch field.Type {
		case "string":
			elkType = "text"
		case "number":
			elkType = "long"
		case "date":
			elkType = "date"
		case "ip":
			elkType = "ip"
		case "bool":
			elkType = "boolean"
		case "vector":
			elkType = "dense_vector"
		default:
			elkType = "text"
		}

		properties[field.Path] = map[string]interface{}{
			"type": elkType,
		}
	}

	return map[string]interface{}{
		"properties": properties,
	}
}

// DataModelRegistry manages data models in memory
type DataModelRegistry struct {
	mongoClient *mongo.Client
	logger      *zap.Logger
	models      map[string]*DataModel // key: data_index
	mu          sync.RWMutex
}

// NewDataModelRegistry creates a new data model registry
func NewDataModelRegistry(mongoClient *mongo.Client, logger *zap.Logger) *DataModelRegistry {
	return &DataModelRegistry{
		mongoClient: mongoClient,
		logger:      logger,
		models:      make(map[string]*DataModel),
	}
}

// LoadModels loads all active data models from MongoDB
func (r *DataModelRegistry) LoadModels(ctx context.Context) error {
	collection := r.mongoClient.Database("dna-pulse").Collection("data_models")

	cursor, err := collection.Find(ctx, bson.M{"status": "active"})
	if err != nil {
		return fmt.Errorf("failed to load models: %w", err)
	}
	defer cursor.Close(ctx)

	r.mu.Lock()
	defer r.mu.Unlock()

	r.models = make(map[string]*DataModel)

	for cursor.Next(ctx) {
		var model DataModel
		if err := cursor.Decode(&model); err != nil {
			r.logger.Warn("failed to decode model", zap.Error(err))
			continue
		}

		r.models[model.DataIndex] = &model
		r.logger.Info("loaded data model",
			zap.String("name", model.Name),
			zap.String("data_index", model.DataIndex),
			zap.String("type", model.Type))
	}

	r.logger.Info("data model registry loaded", zap.Int("count", len(r.models)))

	return nil
}

// GetModelByDataIndex retrieves a model by data_index
func (r *DataModelRegistry) GetModelByDataIndex(dataIndex string) (*DataModel, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	model, ok := r.models[dataIndex]
	return model, ok
}

// GetModelByDataSourceID retrieves a model by data_source_id
func (r *DataModelRegistry) GetModelByDataSourceID(ctx context.Context, dataSourceID string) (*DataModel, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Convert string to ObjectID
	dsObjID, err := primitive.ObjectIDFromHex(dataSourceID)
	if err != nil {
		return nil, fmt.Errorf("invalid data_source_id: %w", err)
	}

	// Find model that has this data_source_id in its source.data_source_ids
	for _, model := range r.models {
		for _, dsID := range model.Source.DataSourceIDs {
			if dsID == dsObjID {
				return model, nil
			}
		}
	}

	return nil, fmt.Errorf("no model found for data_source_id: %s", dataSourceID)
}

// GetDerivedModels returns all derived models that use the given source data_index
func (r *DataModelRegistry) GetDerivedModels(sourceDataIndex string) []*DataModel {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var derived []*DataModel
	for _, model := range r.models {
		if model.Type == "derived" {
			// Check if this model uses the source data index
			// Note: This is simplified - in production, we'd need to resolve
			// data_source_id to data_index mapping
			derived = append(derived, model)
		}
	}

	return derived
}

// GetCompositeModels returns all composite models
func (r *DataModelRegistry) GetCompositeModels(sourceDataIndex string) []*DataModel {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var composite []*DataModel
	for _, model := range r.models {
		if model.Type == "composite" {
			composite = append(composite, model)
		}
	}

	return composite
}

// Reload reloads all models from MongoDB
func (r *DataModelRegistry) Reload(ctx context.Context) error {
	return r.LoadModels(ctx)
}
