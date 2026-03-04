package mongo

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

// IngestedEvent represents an event stored in MongoDB
type IngestedEvent struct {
	ID             primitive.ObjectID     `bson:"_id,omitempty"`
	EventID        string                 `bson:"event_id"`
	OrganizationID primitive.ObjectID     `bson:"organization_id"`
	DataSourceID   primitive.ObjectID     `bson:"data_source_id"`
	AgentID        primitive.ObjectID     `bson:"agent_id,omitempty"`
	TenantID       string                 `bson:"tenant_id"`
	Type           string                 `bson:"type"`
	Source         interface{}            `bson:"source"`
	Payload        map[string]interface{} `bson:"payload"`
	Attributes     map[string]interface{} `bson:"attributes"`
	IngestedAt     time.Time              `bson:"ingested_at"`
	ProcessedAt    time.Time              `bson:"processed_at"`
	CreatedAt      time.Time              `bson:"created_at"`
	UpdatedAt      time.Time              `bson:"updated_at"`
}

// Store handles MongoDB operations for ingestion service
type Store struct {
	client              *mongo.Client
	database            *mongo.Database
	events              *mongo.Collection
	organizations       *mongo.Collection
	users               *mongo.Collection
	apiKeys             *mongo.Collection
	agentTypes          *mongo.Collection
	agents              *mongo.Collection
	dataSources         *mongo.Collection
	discoveredSchemas   *mongo.Collection
	dataModels          *mongo.Collection
	dataModelAttributes *mongo.Collection
}

// NewStore creates a new MongoDB store
func NewStore(mongoURL string) (*Store, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Configure client with longer timeouts for Atlas
	clientOpts := options.Client().
		ApplyURI(mongoURL).
		SetServerSelectionTimeout(30 * time.Second).
		SetConnectTimeout(30 * time.Second).
		SetSocketTimeout(30 * time.Second).
		SetMaxPoolSize(50).
		SetMinPoolSize(10)

	log.Printf("[MongoDB] Connecting to MongoDB...")
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Printf("[MongoDB] Connection failed: %v", err)
		return nil, err
	}

	// Test connection
	log.Printf("[MongoDB] Testing connection with Ping...")
	if err := client.Ping(ctx, nil); err != nil {
		log.Printf("[MongoDB] Ping failed: %v", err)
		return nil, err
	}

	log.Printf("[MongoDB] Connection successful!")

	database := client.Database("dna-pulse")
	log.Printf("[MongoDB] Using database: %s", database.Name())

	store := &Store{
		client:              client,
		database:            database,
		events:              database.Collection("events"),
		organizations:       database.Collection("organizations"),
		users:               database.Collection("users"),
		apiKeys:             database.Collection("api_keys"),
		agentTypes:          database.Collection("agent_types"),
		agents:              database.Collection("agents"),
		dataSources:         database.Collection("data_sources"),
		discoveredSchemas:   database.Collection("discovered_schemas"),
		dataModels:          database.Collection("data_models"),
		dataModelAttributes: database.Collection("data_model_attributes"),
	}

	// Create indexes
	if err := store.createIndexes(ctx); err != nil {
		return nil, fmt.Errorf("failed to create indexes: %w", err)
	}

	return store, nil
}

// createIndexes creates all necessary indexes
func (s *Store) createIndexes(ctx context.Context) error {
	// Events indexes
	eventIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "event_id", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "ingested_at", Value: -1}},
		},
		{
			Keys: bson.D{{Key: "organization_id", Value: 1}, {Key: "data_source_id", Value: 1}},
		},
	}
	if _, err := s.events.Indexes().CreateMany(ctx, eventIndexes); err != nil {
		return err
	}

	// API Keys indexes
	apiKeyIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "key", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "organization_id", Value: 1}},
		},
	}
	if _, err := s.apiKeys.Indexes().CreateMany(ctx, apiKeyIndexes); err != nil {
		return err
	}

	// Agent Types indexes
	agentTypeIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "organization_id", Value: 1}, {Key: "name", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "status", Value: 1}},
		},
	}
	if _, err := s.agentTypes.Indexes().CreateMany(ctx, agentTypeIndexes); err != nil {
		return err
	}

	// Agents indexes
	agentIndexes := []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "organization_id", Value: 1}, {Key: "data_source_id", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "agent_type_id", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "status", Value: 1}, {Key: "last_heartbeat", Value: -1}},
		},
		{
			Keys: bson.D{{Key: "hostname", Value: 1}},
		},
	}
	if _, err := s.agents.Indexes().CreateMany(ctx, agentIndexes); err != nil {
		return err
	}

	// Data Sources indexes
	dataSourceIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "organization_id", Value: 1}, {Key: "agent_type", Value: 1}},
			Options: options.Index().SetUnique(true).SetPartialFilterExpression(bson.M{"agent_type": bson.M{"$exists": true, "$type": "string"}}),
		},
		{
			Keys: bson.D{{Key: "organization_id", Value: 1}},
		},
	}
	if _, err := s.dataSources.Indexes().CreateMany(ctx, dataSourceIndexes); err != nil {
		return err
	}

	// Discovered Schemas indexes
	schemaIndexes := []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "data_source_id", Value: 1}, {Key: "version", Value: -1}},
		},
	}
	if _, err := s.discoveredSchemas.Indexes().CreateMany(ctx, schemaIndexes); err != nil {
		return err
	}

	return nil
}

// ============== Organization Methods ==============

// CreateOrganization creates a new organization
func (s *Store) CreateOrganization(ctx context.Context, org *Organization) error {
	org.CreatedAt = time.Now()
	result, err := s.organizations.InsertOne(ctx, org)
	if err != nil {
		return err
	}
	org.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetOrganizationByID retrieves an organization by ID
func (s *Store) GetOrganizationByID(ctx context.Context, id primitive.ObjectID) (*Organization, error) {
	var org Organization
	err := s.organizations.FindOne(ctx, bson.M{"_id": id}).Decode(&org)
	if err != nil {
		return nil, err
	}
	return &org, nil
}

// ============== API Key Methods ==============

// ValidateAPIKey validates an API key (plain text) and returns the associated organization.
// It first tries to compare against bcrypt-hashed keys, and if none match it falls back
// to a direct plaintext comparison. This makes it work in both cases:
// - keys created via ingestion tests/seed (bcrypt hashes)
// - keys inserted manually as plaintext for development
func (s *Store) ValidateAPIKey(ctx context.Context, plainKey string) (*APIKey, *Organization, error) {
	log.Printf("[APIKey] ValidateAPIKey called, incoming plain key: %s (len=%d)", maskKey(plainKey), len(plainKey))

	// Get all API keys (we need to compare against all hashes / plaintext)
	cursor, err := s.apiKeys.Find(ctx, bson.M{})
	if err != nil {
		return nil, nil, err
	}
	defer cursor.Close(ctx)

	var keys []APIKey
	if err := cursor.All(ctx, &keys); err != nil {
		return nil, nil, err
	}

	var plaintextCandidates []*APIKey

	// Compare plain key against each stored key
	for _, apiKey := range keys {
		log.Printf("[APIKey] Checking stored key id=%s hash=%s (len=%d)", apiKey.ID.Hex(), maskKey(apiKey.Key), len(apiKey.Key))

		// First, try bcrypt compare (hashed key)
		if err := bcrypt.CompareHashAndPassword([]byte(apiKey.Key), []byte(plainKey)); err == nil {
			// Match found with bcrypt
			log.Printf("[APIKey] Bcrypt match found for key id=%s", apiKey.ID.Hex())
			return s.handleValidAPIKey(ctx, &apiKey) //BUG:this returns nil, nil
		}

		// If bcrypt fails, collect for potential plaintext comparison
		plaintextCandidates = append(plaintextCandidates, &apiKey)
	}

	// Fallback: plaintext comparison for dev / manually inserted keys
	for _, apiKey := range plaintextCandidates {
		if apiKey.Key == plainKey {
			return s.handleValidAPIKey(ctx, apiKey)
		}
	}

	return nil, nil, fmt.Errorf("invalid API key")
}

// handleValidAPIKey performs common post-validation logic (expiry check, last_used update, org load)
func (s *Store) handleValidAPIKey(ctx context.Context, apiKey *APIKey) (*APIKey, *Organization, error) {
	// Check expiration
	if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(time.Now()) {
		log.Printf("[APIKey] API key has expired id=%s", apiKey.ID.Hex())
		return nil, nil, fmt.Errorf("API key has expired")
	}

	// Update last used (non-fatal if it fails)
	now := time.Now()
	_, _ = s.apiKeys.UpdateOne(ctx, bson.M{"_id": apiKey.ID}, bson.M{"$set": bson.M{"last_used": now}})

	// Get organization
	org, err := s.GetOrganizationByID(ctx, apiKey.OrganizationID)
	if err != nil {
		// Geliştirme ortamında organizasyon kaydı eksik olsa bile API key geçerli sayalım.
		log.Printf("[APIKey] Error getting organization by ID orgID=%s error=%v (proceeding with fallback org)", apiKey.OrganizationID.Hex(), err)
		org = &Organization{
			ID:   apiKey.OrganizationID,
			Name: "Unknown",
		}
	} else {
		log.Printf("[APIKey] Organization loaded id=%s name=%s", org.ID.Hex(), org.Name)
	}
	return apiKey, org, nil
}

// maskKey masks a sensitive key for safe logging (shows only start and end)
func maskKey(k string) string {
	if k == "" {
		return "<empty>"
	}
	if len(k) <= 6 {
		return "***"
	}
	return k[:3] + "..." + k[len(k)-3:]
}

// CreateAPIKey creates a new API key
func (s *Store) CreateAPIKey(ctx context.Context, key *APIKey) error {
	key.CreatedAt = time.Now()
	result, err := s.apiKeys.InsertOne(ctx, key)
	if err != nil {
		return err
	}
	key.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetAPIKeysByOrganization retrieves all API keys for an organization
func (s *Store) GetAPIKeysByOrganization(ctx context.Context, orgID primitive.ObjectID) ([]*APIKey, error) {
	cursor, err := s.apiKeys.Find(ctx, bson.M{"organization_id": orgID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var keys []*APIKey
	if err := cursor.All(ctx, &keys); err != nil {
		return nil, err
	}
	return keys, nil
}

// ============== Agent Methods ==============

// CreateAgent creates a new agent
func (s *Store) CreateAgent(ctx context.Context, agent *Agent) error {
	agent.RegisteredAt = time.Now()
	agent.LastHeartbeat = time.Now()
	result, err := s.agents.InsertOne(ctx, agent)
	if err != nil {
		return err
	}
	agent.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// UpdateAgent updates an existing agent
func (s *Store) UpdateAgent(ctx context.Context, agent *Agent) error {
	_, err := s.agents.ReplaceOne(ctx, bson.M{"_id": agent.ID}, agent)
	return err
}

// GetAgentByID retrieves an agent by ID
func (s *Store) GetAgentByID(ctx context.Context, id primitive.ObjectID) (*Agent, error) {
	var agent Agent
	err := s.agents.FindOne(ctx, bson.M{"_id": id}).Decode(&agent)
	if err != nil {
		return nil, err
	}
	return &agent, nil
}

// GetAgentsByDataSource retrieves all agents for a data source
func (s *Store) GetAgentsByDataSource(ctx context.Context, dataSourceID primitive.ObjectID) ([]*Agent, error) {
	cursor, err := s.agents.Find(ctx, bson.M{"data_source_id": dataSourceID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var agents []*Agent
	if err := cursor.All(ctx, &agents); err != nil {
		return nil, err
	}
	return agents, nil
}

// GetAgentsByOrganization retrieves all agents for an organization
func (s *Store) GetAgentsByOrganization(ctx context.Context, orgID primitive.ObjectID) ([]*Agent, error) {
	cursor, err := s.agents.Find(ctx, bson.M{"organization_id": orgID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var agents []*Agent
	if err := cursor.All(ctx, &agents); err != nil {
		return nil, err
	}
	return agents, nil
}

// UpdateAgentHeartbeat updates the agent's heartbeat and status
func (s *Store) UpdateAgentHeartbeat(ctx context.Context, agentID primitive.ObjectID, status string) error {
	_, err := s.agents.UpdateOne(
		ctx,
		bson.M{"_id": agentID},
		bson.M{
			"$set": bson.M{
				"last_heartbeat": time.Now(),
				"status":         status,
			},
		},
	)
	return err
}

// ============== Data Source Methods ==============

// CreateDataSource creates a new data source
func (s *Store) CreateDataSource(ctx context.Context, ds *DataSource) error {
	ds.CreatedAt = time.Now()
	ds.LastSeen = time.Now()
	result, err := s.dataSources.InsertOne(ctx, ds)
	if err != nil {
		return err
	}
	ds.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetDataSourceByID retrieves a data source by ID
func (s *Store) GetDataSourceByID(ctx context.Context, id primitive.ObjectID) (*DataSource, error) {
	var ds DataSource
	err := s.dataSources.FindOne(ctx, bson.M{"_id": id}).Decode(&ds)
	if err != nil {
		return nil, err
	}
	return &ds, nil
}

// GetDataSourceByAgentType retrieves a data source by organization and agent type
func (s *Store) GetDataSourceByAgentType(ctx context.Context, orgID primitive.ObjectID, agentType string) (*DataSource, error) {
	var ds DataSource
	err := s.dataSources.FindOne(ctx, bson.M{
		"organization_id": orgID,
		"agent_type":      agentType,
	}).Decode(&ds)
	if err != nil {
		return nil, err
	}
	return &ds, nil
}

// GetDataSourcesByOrganization retrieves all data sources for an organization
func (s *Store) GetDataSourcesByOrganization(ctx context.Context, orgID primitive.ObjectID) ([]*DataSource, error) {
	cursor, err := s.dataSources.Find(ctx, bson.M{"organization_id": orgID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var dataSources []*DataSource
	if err := cursor.All(ctx, &dataSources); err != nil {
		return nil, err
	}
	return dataSources, nil
}

// UpdateDataSourceThroughput updates the data source throughput and last seen
func (s *Store) UpdateDataSourceThroughput(ctx context.Context, dsID primitive.ObjectID, throughput int) error {
	_, err := s.dataSources.UpdateOne(
		ctx,
		bson.M{"_id": dsID},
		bson.M{
			"$set": bson.M{
				"throughput": throughput,
				"last_seen":  time.Now(),
			},
		},
	)
	return err
}

// IncrementDataSourceAgentCount increments the agent count for a data source
func (s *Store) IncrementDataSourceAgentCount(ctx context.Context, dsID primitive.ObjectID) error {
	_, err := s.dataSources.UpdateOne(
		ctx,
		bson.M{"_id": dsID},
		bson.M{
			"$inc": bson.M{"agent_count": 1},
		},
	)
	return err
}

// UpdateDataSource updates a data source
func (s *Store) UpdateDataSource(ctx context.Context, ds *DataSource) error {
	_, err := s.dataSources.ReplaceOne(ctx, bson.M{"_id": ds.ID}, ds)
	return err
}

// ============== Discovered Schema Methods ==============

// CreateDiscoveredSchema creates a new discovered schema
func (s *Store) CreateDiscoveredSchema(ctx context.Context, schema *DiscoveredSchema) error {
	schema.DiscoveredAt = time.Now()
	result, err := s.discoveredSchemas.InsertOne(ctx, schema)
	if err != nil {
		return err
	}
	schema.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetLatestSchemaByDataSource retrieves the latest schema for a data source
func (s *Store) GetLatestSchemaByDataSource(ctx context.Context, dataSourceID primitive.ObjectID) (*DiscoveredSchema, error) {
	var schema DiscoveredSchema
	opts := options.FindOne().SetSort(bson.D{{Key: "version", Value: -1}})
	err := s.discoveredSchemas.FindOne(ctx, bson.M{"data_source_id": dataSourceID}, opts).Decode(&schema)
	if err != nil {
		return nil, err
	}
	return &schema, nil
}

// GetSchemaByID retrieves a schema by ID
func (s *Store) GetSchemaByID(ctx context.Context, id primitive.ObjectID) (*DiscoveredSchema, error) {
	var schema DiscoveredSchema
	err := s.discoveredSchemas.FindOne(ctx, bson.M{"_id": id}).Decode(&schema)
	if err != nil {
		return nil, err
	}
	return &schema, nil
}

// ============== Event Methods ==============

// StoreEvent stores an ingested event in MongoDB
func (s *Store) StoreEvent(ctx context.Context, event *IngestedEvent) error {
	event.CreatedAt = time.Now()
	event.UpdatedAt = time.Now()
	event.IngestedAt = time.Now()

	_, err := s.events.InsertOne(ctx, event)
	return err
}

// StoreEventsBatch stores multiple events in a batch
func (s *Store) StoreEventsBatch(ctx context.Context, events []*IngestedEvent) error {
	if len(events) == 0 {
		return nil
	}

	now := time.Now()
	docs := make([]interface{}, len(events))
	for i, event := range events {
		event.CreatedAt = now
		event.UpdatedAt = now
		event.IngestedAt = now
		docs[i] = event
	}

	_, err := s.events.InsertMany(ctx, docs)
	return err
}

// GetEvent retrieves an event by event_id
func (s *Store) GetEvent(ctx context.Context, eventID string) (*IngestedEvent, error) {
	var event IngestedEvent
	err := s.events.FindOne(ctx, bson.M{"event_id": eventID}).Decode(&event)
	if err != nil {
		return nil, err
	}
	return &event, nil
}

// GetEventsByTimeRange retrieves events within a time range
func (s *Store) GetEventsByTimeRange(ctx context.Context, start, end time.Time, limit int64) ([]*IngestedEvent, error) {
	filter := bson.M{
		"ingested_at": bson.M{
			"$gte": start,
			"$lte": end,
		},
	}

	opts := options.Find().SetSort(bson.D{{Key: "ingested_at", Value: -1}})
	if limit > 0 {
		opts.SetLimit(limit)
	}

	cursor, err := s.events.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var events []*IngestedEvent
	if err := cursor.All(ctx, &events); err != nil {
		return nil, err
	}

	return events, nil
}

// GetEventsByDataSource retrieves events for a specific data source
func (s *Store) GetEventsByDataSource(ctx context.Context, dataSourceID primitive.ObjectID, limit int64) ([]*IngestedEvent, error) {
	opts := options.Find().SetSort(bson.D{{Key: "ingested_at", Value: -1}})
	if limit > 0 {
		opts.SetLimit(limit)
	}

	cursor, err := s.events.Find(ctx, bson.M{"data_source_id": dataSourceID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var events []*IngestedEvent
	if err := cursor.All(ctx, &events); err != nil {
		return nil, err
	}
	return events, nil
}

// UpdateEventProcessed marks an event as processed
func (s *Store) UpdateEventProcessed(ctx context.Context, eventID string) error {
	filter := bson.M{"event_id": eventID}
	update := bson.M{
		"$set": bson.M{
			"processed_at": time.Now(),
			"updated_at":   time.Now(),
		},
	}

	_, err := s.events.UpdateOne(ctx, filter, update)
	return err
}

// GetStats returns ingestion statistics
func (s *Store) GetStats(ctx context.Context) (map[string]interface{}, error) {
	pipeline := []bson.M{
		{
			"$group": bson.M{
				"_id":          nil,
				"total_events": bson.M{"$sum": 1},
				"processed_events": bson.M{
					"$sum": bson.M{
						"$cond": bson.M{
							"if":   bson.M{"$ne": []interface{}{"$processed_at", nil}},
							"then": 1,
							"else": 0,
						},
					},
				},
			},
		},
	}

	cursor, err := s.events.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var result []bson.M
	if err := cursor.All(ctx, &result); err != nil {
		return nil, err
	}

	if len(result) == 0 {
		return map[string]interface{}{
			"total_events":     0,
			"processed_events": 0,
		}, nil
	}

	return map[string]interface{}{
		"total_events":     result[0]["total_events"],
		"processed_events": result[0]["processed_events"],
	}, nil
}

// ============== Agent Type Methods ==============

// CreateAgentType creates a new agent type
func (s *Store) CreateAgentType(ctx context.Context, agentType *AgentType) error {
	agentType.CreatedAt = time.Now()
	agentType.UpdatedAt = time.Now()
	result, err := s.agentTypes.InsertOne(ctx, agentType)
	if err != nil {
		return err
	}
	agentType.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetAgentTypeByName retrieves an agent type by name and organization
func (s *Store) GetAgentTypeByName(ctx context.Context, orgID primitive.ObjectID, name string) (*AgentType, error) {
	var agentType AgentType
	err := s.agentTypes.FindOne(ctx, bson.M{"organization_id": orgID, "name": name}).Decode(&agentType)
	if err != nil {
		return nil, err
	}
	return &agentType, nil
}

// GetAgentTypeByID retrieves an agent type by ID
func (s *Store) GetAgentTypeByID(ctx context.Context, id primitive.ObjectID) (*AgentType, error) {
	var agentType AgentType
	err := s.agentTypes.FindOne(ctx, bson.M{"_id": id}).Decode(&agentType)
	if err != nil {
		return nil, err
	}
	return &agentType, nil
}

// GetAllAgentTypes retrieves all agent types for an organization
func (s *Store) GetAllAgentTypes(ctx context.Context, orgID primitive.ObjectID) ([]*AgentType, error) {
	cursor, err := s.agentTypes.Find(ctx, bson.M{"organization_id": orgID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var agentTypes []*AgentType
	if err := cursor.All(ctx, &agentTypes); err != nil {
		return nil, err
	}
	return agentTypes, nil
}

// UpdateAgentType updates an agent type
func (s *Store) UpdateAgentType(ctx context.Context, id primitive.ObjectID, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now()
	_, err := s.agentTypes.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	return err
}

// ============== Enhanced Agent Instance Methods ==============

// GetAgentInstancesByType retrieves all agent instances of a specific type
func (s *Store) GetAgentInstancesByType(ctx context.Context, agentTypeID primitive.ObjectID) ([]*Agent, error) {
	cursor, err := s.agents.Find(ctx, bson.M{"agent_type_id": agentTypeID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var agents []*Agent
	if err := cursor.All(ctx, &agents); err != nil {
		return nil, err
	}
	return agents, nil
}

// GetAgentInstancesByDataSource retrieves all agent instances sending data to a specific data source
func (s *Store) GetAgentInstancesByDataSource(ctx context.Context, dataSourceID primitive.ObjectID) ([]*Agent, error) {
	cursor, err := s.agents.Find(ctx, bson.M{"data_source_id": dataSourceID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var agents []*Agent
	if err := cursor.All(ctx, &agents); err != nil {
		return nil, err
	}
	return agents, nil
}

// UpdateAgentStatus updates an agent's status
func (s *Store) UpdateAgentStatus(ctx context.Context, agentID primitive.ObjectID, status string) error {
	_, err := s.agents.UpdateOne(ctx, bson.M{"_id": agentID}, bson.M{
		"$set": bson.M{
			"status":       status,
			"last_seen_at": time.Now(),
		},
	})
	return err
}

// UpdateAgentMetrics updates an agent's metrics snapshot
func (s *Store) UpdateAgentMetrics(ctx context.Context, agentID primitive.ObjectID, metrics map[string]interface{}) error {
	_, err := s.agents.UpdateOne(ctx, bson.M{"_id": agentID}, bson.M{
		"$set": bson.M{
			"metrics":      metrics,
			"last_seen_at": time.Now(),
		},
	})
	return err
}

// ============== Data Model Methods ==============

// CreateDataModel creates a new data model
func (s *Store) CreateDataModel(ctx context.Context, dm *DataModel) error {
	log.Printf("[DataModel] CreateDataModel called: name=%s, type=%s, data_index=%s", dm.Name, dm.Type, dm.DataIndex)
	dm.CreatedAt = time.Now()
	dm.UpdatedAt = time.Now()

	log.Printf("[DataModel] Inserting into database: %s, collection: %s", s.database.Name(), s.dataModels.Name())
	log.Printf("[DataModel] Document to insert: org_id=%s, name=%s", dm.OrganizationID.Hex(), dm.Name)
	result, err := s.dataModels.InsertOne(ctx, dm)
	if err != nil {
		log.Printf("[DataModel] Insert FAILED: %v", err)
		return err
	}
	dm.ID = result.InsertedID.(primitive.ObjectID)
	log.Printf("[DataModel] Insert SUCCESS: ID=%s", dm.ID.Hex())
	return nil
}

// GetDataModelByDataIndex retrieves a data model by organization and data_index
func (s *Store) GetDataModelByDataIndex(ctx context.Context, orgID primitive.ObjectID, dataIndex string) (*DataModel, error) {
	var dm DataModel
	err := s.dataModels.FindOne(ctx, bson.M{
		"organization_id": orgID,
		"data_index":      dataIndex,
	}).Decode(&dm)
	if err != nil {
		return nil, err
	}
	return &dm, nil
}

// CreateDataModelAttributesFromSchema creates attributes from discovered schema
func (s *Store) CreateDataModelAttributesFromSchema(ctx context.Context, dataModelID primitive.ObjectID, schemaFields []SchemaField, createdBy string) error {
	if len(schemaFields) == 0 {
		return nil
	}

	log.Printf("[DataModelAttributes] Creating %d attributes for model %s", len(schemaFields), dataModelID.Hex())

	var attributes []interface{}
	now := time.Now()

	for i, field := range schemaFields {
		attr := DataModelAttribute{
			DataModelID: dataModelID,
			Path:        field.Name,
			Type:        field.Type,
			Source:      "discovered",
			Required:    field.Required,
			Indexed:     field.Indexed,
			Description: field.Description,
			Example:     field.Example,
			Status:      "normal",
			Order:       i + 1,
			CreatedAt:   now,
			UpdatedAt:   now,
			CreatedBy:   createdBy,
		}
		attributes = append(attributes, attr)
	}

	result, err := s.dataModelAttributes.InsertMany(ctx, attributes)
	if err != nil {
		log.Printf("[DataModelAttributes] Insert FAILED: %v", err)
		return err
	}

	log.Printf("[DataModelAttributes] Insert SUCCESS: %d attributes created", len(result.InsertedIDs))
	return nil
}

// GetDataModelAttributes retrieves all attributes for a data model
func (s *Store) GetDataModelAttributes(ctx context.Context, dataModelID primitive.ObjectID) ([]DataModelAttribute, error) {
	cursor, err := s.dataModelAttributes.Find(ctx, bson.M{
		"data_model_id": dataModelID,
	}, options.Find().SetSort(bson.D{{Key: "order", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var attributes []DataModelAttribute
	if err := cursor.All(ctx, &attributes); err != nil {
		return nil, err
	}

	return attributes, nil
}

// CreateDataModelAttribute creates a new attribute
func (s *Store) CreateDataModelAttribute(ctx context.Context, attr *DataModelAttribute) error {
	attr.CreatedAt = time.Now()
	attr.UpdatedAt = time.Now()
	result, err := s.dataModelAttributes.InsertOne(ctx, attr)
	if err != nil {
		return err
	}
	attr.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// UpdateDataModelAttribute updates an existing attribute
func (s *Store) UpdateDataModelAttribute(ctx context.Context, attrID primitive.ObjectID, updates bson.M) error {
	updates["updated_at"] = time.Now()
	_, err := s.dataModelAttributes.UpdateOne(
		ctx,
		bson.M{"_id": attrID},
		bson.M{"$set": updates},
	)
	return err
}

// DeleteDataModelAttribute deletes an attribute
func (s *Store) DeleteDataModelAttribute(ctx context.Context, attrID primitive.ObjectID) error {
	_, err := s.dataModelAttributes.DeleteOne(ctx, bson.M{"_id": attrID})
	return err
}

// Close closes the MongoDB connection
func (s *Store) Close(ctx context.Context) error {
	return s.client.Disconnect(ctx)
}
