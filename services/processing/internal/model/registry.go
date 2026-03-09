package model

import (
	"context"
	"fmt"
	"strings"
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
	Attributes     []DataModelAttribute `bson:"attributes,omitempty"`
	Processing     *DataModelPipeline  `bson:"processing,omitempty"`
	Composite      *CompositeConfig    `bson:"composite,omitempty"`
	ELK            ELKConfig           `bson:"elk"`
	CreatedAt      time.Time           `bson:"created_at"`
	UpdatedAt      time.Time           `bson:"updated_at"`
	CreatedBy      string              `bson:"created_by"`
}

// DataModelAttribute represents an attribute from data_model_attributes collection
type DataModelAttribute struct {
	ID          primitive.ObjectID     `bson:"_id,omitempty"`
	DataModelID primitive.ObjectID     `bson:"data_model_id"`
	Path        string                 `bson:"path"`
	Type        string                 `bson:"type"`
	Source      string                 `bson:"source,omitempty"`
	Required    bool                   `bson:"required,omitempty"`
	Indexed     bool                   `bson:"indexed,omitempty"`
	Description string                 `bson:"description,omitempty"`
	Example     interface{}            `bson:"example,omitempty"`
	Status      string                 `bson:"status,omitempty"`
	Order       int                    `bson:"order,omitempty"`
	Derivation  map[string]interface{} `bson:"derivation,omitempty"`
	CreatedAt   time.Time              `bson:"created_at"`
	UpdatedAt   time.Time              `bson:"updated_at"`
	CreatedBy   string                 `bson:"created_by"`
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

// ToELKMapping converts data model to Elasticsearch mapping including attributes
func (m *DataModel) ToELKMapping() map[string]interface{} {
	properties := make(map[string]interface{})
	nestedFields := make(map[string]map[string]interface{})

	// First pass: identify array/nested fields and collect their children
	arrayFields := make(map[string]bool)
	for _, attr := range m.Attributes {
		if attr.Type == "array" {
			arrayFields[attr.Path] = true
		}
	}

	// Second pass: build properties
	for _, attr := range m.Attributes {
		path := attr.Path

		// Skip array notation like "field[]"
		if len(path) > 2 && path[len(path)-2:] == "[]" {
			continue
		}

		// Check if this is a child of a nested field
		isNestedChild := false
		parentPath := ""
		parts := splitPath(path)

		for i := len(parts) - 1; i > 0; i-- {
			potentialParent := joinPath(parts[:i])
			if arrayFields[potentialParent] {
				isNestedChild = true
				parentPath = potentialParent
				break
			}
		}

		elkType := convertTypeToELK(attr.Type)
		fieldMapping := map[string]interface{}{
			"type": elkType,
		}

		// Add keyword subfield for text fields
		if elkType == "text" {
			fieldMapping["fields"] = map[string]interface{}{
				"keyword": map[string]interface{}{
					"type":         "keyword",
					"ignore_above": 256,
				},
			}
		}

		if isNestedChild && parentPath != "" {
			// Add to nested field's properties
			if nestedFields[parentPath] == nil {
				nestedFields[parentPath] = make(map[string]interface{})
			}
			childPath := path[len(parentPath)+1:]
			nestedFields[parentPath][childPath] = fieldMapping
		} else if attr.Type == "array" {
			// This is a nested field parent - will be added later
			// Skip for now
		} else {
			// Regular field
			properties[path] = fieldMapping
		}
	}

	// Add nested properties that were collected
	for parentPath, nestedProps := range nestedFields {
		if len(nestedProps) > 0 {
			properties[parentPath] = map[string]interface{}{
				"type":       "nested",
				"properties": nestedProps,
			}
		}
	}

	return map[string]interface{}{
		"properties": properties,
	}
}

// Helper functions for path manipulation
func splitPath(path string) []string {
	parts := []string{}
	for _, part := range strings.Split(path, ".") {
		if part != "" {
			parts = append(parts, part)
		}
	}
	return parts
}

func joinPath(parts []string) string {
	return strings.Join(parts, ".")
}

// convertTypeToELK converts data model type to Elasticsearch type
func convertTypeToELK(dataType string) string {
	switch dataType {
	case "string":
		return "text"
	case "number":
		return "long"
	case "date":
		return "date"
	case "ip":
		return "ip"
	case "bool", "boolean":
		return "boolean"
	case "vector":
		return "dense_vector"
	case "object":
		return "object"
	case "array":
		return "nested"
	default:
		return "text"
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
	db := r.mongoClient.Database("dna-pulse")
	modelsCollection := db.Collection("data_models")
	attributesCollection := db.Collection("data_model_attributes")

	cursor, err := modelsCollection.Find(ctx, bson.M{"status": "active"})
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

		// Load attributes for this model
		attrCursor, err := attributesCollection.Find(ctx, bson.M{"data_model_id": model.ID})
		if err != nil {
			r.logger.Warn("failed to load attributes for model",
				zap.String("model_id", model.ID.Hex()),
				zap.Error(err))
		} else {
			var attributes []DataModelAttribute
			if err := attrCursor.All(ctx, &attributes); err != nil {
				r.logger.Warn("failed to decode attributes",
					zap.String("model_id", model.ID.Hex()),
					zap.Error(err))
			} else {
				model.Attributes = attributes
				r.logger.Info("loaded attributes for model",
					zap.String("model_name", model.Name),
					zap.Int("attribute_count", len(attributes)))
			}
			attrCursor.Close(ctx)
		}

		r.models[model.DataIndex] = &model
		r.logger.Info("loaded data model",
			zap.String("name", model.Name),
			zap.String("data_index", model.DataIndex),
			zap.String("type", model.Type),
			zap.Int("attributes", len(model.Attributes)))
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

// GetModelByDataSourceID retrieves a root model by data_source_id
func (r *DataModelRegistry) GetModelByDataSourceID(ctx context.Context, dataSourceID string) (*DataModel, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Convert string to ObjectID
	dsObjID, err := primitive.ObjectIDFromHex(dataSourceID)
	if err != nil {
		return nil, fmt.Errorf("invalid data_source_id: %w", err)
	}

	// Find ROOT model that has this data_source_id in its source.data_source_ids
	for _, model := range r.models {
		// Only return root models - derived models shouldn't be source models
		if model.Type == "root" {
			for _, dsID := range model.Source.DataSourceIDs {
				if dsID == dsObjID {
					return model, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("no root model found for data_source_id: %s", dataSourceID)
}

// GetDerivedModels returns all derived models that use the given source data_index
func (r *DataModelRegistry) GetDerivedModels(sourceDataIndex string) []*DataModel {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var derived []*DataModel
	for _, model := range r.models {
		if model.Type == "derived" && model.Source.SourceType == "derived" {
			// Check if this derived model uses the source data index
			// by checking if any of its source data_source_ids match
			for _, sourceID := range model.Source.DataSourceIDs {
				// Find the source model by data_source_id
				sourceModel, err := r.GetModelByDataSourceID(context.Background(), sourceID.Hex())
				if err == nil && sourceModel != nil && sourceModel.DataIndex == sourceDataIndex {
					derived = append(derived, model)
					break
				}
			}
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

// GetAllModels returns all loaded models
func (r *DataModelRegistry) GetAllModels() []*DataModel {
	r.mu.RLock()
	defer r.mu.RUnlock()

	models := make([]*DataModel, 0, len(r.models))
	for _, model := range r.models {
		models = append(models, model)
	}
	return models
}
