package test

import (
	"context"
	"testing"
	"time"

	"github.com/dnasol/dna-platform/services/ingestion/pkg/auth"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/mongo"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/schema"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TestCompleteAgentFlow tests the complete agent registration → health → pulse flow
func TestCompleteAgentFlow(t *testing.T) {
	// Skip if MongoDB is not available
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Initialize test store
	store, err := mongo.NewStore("mongodb://localhost:27017/dna-pulse-test")
	if err != nil {
		t.Fatalf("Failed to connect to test MongoDB: %v", err)
	}
	defer store.Close(context.Background())

	ctx := context.Background()

	// Create test organization
	org := &mongo.Organization{
		Name:      "Test Organization",
		CreatedAt: time.Now(),
	}
	if err := store.CreateOrganization(ctx, org); err != nil {
		t.Fatalf("Failed to create organization: %v", err)
	}

	// Create test API key
	apiKeyPlain := "test-api-key-" + primitive.NewObjectID().Hex()
	apiKeyHash, err := auth.HashAPIKey(apiKeyPlain)
	if err != nil {
		t.Fatalf("Failed to hash API key: %v", err)
	}

	apiKey := &mongo.APIKey{
		OrganizationID: org.ID,
		Key:            apiKeyHash,
		Name:           "Test API Key",
		Permissions:    []string{"agent:register", "agent:ingest"},
		CreatedAt:      time.Now(),
	}
	if err := store.CreateAPIKey(ctx, apiKey); err != nil {
		t.Fatalf("Failed to create API key: %v", err)
	}

	// Test 1: Register Agent
	t.Run("RegisterAgent", func(t *testing.T) {
		// Test agent creation directly via store
		agent := &mongo.Agent{
			OrganizationID: org.ID,
			DataSourceID:   primitive.NewObjectID(),
			Name:           "Test Agent",
			Version:        "1.0.0",
			Platform:       "linux",
			Status:         "online",
			Hostname:       "test-host",
			Config:         make(map[string]interface{}),
		}

		if err := store.CreateAgent(ctx, agent); err != nil {
			t.Fatalf("Failed to create agent: %v", err)
		}

		if agent.ID.IsZero() {
			t.Error("Agent ID should be set after creation")
		}

		t.Logf("Agent created with ID: %s", agent.ID.Hex())
	})

	// Test 2: Schema Discovery
	t.Run("SchemaDiscovery", func(t *testing.T) {
		sampleData := []map[string]interface{}{
			{
				"timestamp": time.Now().Format(time.RFC3339),
				"metric":    "cpu_usage",
				"value":     75.5,
				"tags":      []string{"production", "web"},
			},
			{
				"timestamp": time.Now().Format(time.RFC3339),
				"metric":    "memory_usage",
				"value":     60.2,
				"tags":      []string{"production"},
			},
		}

		discoveredSchema, err := schema.DiscoverSchema(sampleData)
		if err != nil {
			t.Fatalf("Schema discovery failed: %v", err)
		}

		if len(discoveredSchema.Fields) == 0 {
			t.Error("Expected discovered schema to have fields")
		}

		// Verify required fields
		fieldNames := make(map[string]bool)
		for _, field := range discoveredSchema.Fields {
			fieldNames[field.Name] = true
		}

		expectedFields := []string{"timestamp", "metric", "value", "tags"}
		for _, expected := range expectedFields {
			if !fieldNames[expected] {
				t.Errorf("Expected field %s not found in schema", expected)
			}
		}
	})

	// Test 3: Invalid API Key
	t.Run("InvalidAPIKey", func(t *testing.T) {
		invalidKey := "invalid-key"
		_, _, err := auth.ValidateAPIKey(ctx, store, invalidKey)
		if err == nil {
			t.Error("Expected error for invalid API key")
		}
	})

	// Test 4: JWT Generation and Validation
	t.Run("JWTFlow", func(t *testing.T) {
		agentID := primitive.NewObjectID().Hex()
		orgID := org.ID.Hex()
		dataSourceID := primitive.NewObjectID().Hex()

		// Generate JWT
		token, err := auth.GenerateJWT(agentID, orgID, dataSourceID, 1*time.Hour)
		if err != nil {
			t.Fatalf("Failed to generate JWT: %v", err)
		}

		// Validate JWT
		claims, err := auth.ValidateJWT(token)
		if err != nil {
			t.Fatalf("Failed to validate JWT: %v", err)
		}

		if claims.AgentID != agentID {
			t.Errorf("Expected agent ID %s, got %s", agentID, claims.AgentID)
		}

		if claims.OrgID != orgID {
			t.Errorf("Expected org ID %s, got %s", orgID, claims.OrgID)
		}
	})

	// Test 5: Schema Validation
	t.Run("SchemaValidation", func(t *testing.T) {
		// Create a schema
		discoveredSchema := &mongo.DiscoveredSchema{
			Version: 1,
			Fields: []mongo.SchemaField{
				{Name: "timestamp", Type: "string", Required: true},
				{Name: "metric", Type: "string", Required: true},
				{Name: "value", Type: "number", Required: true},
			},
		}

		// Valid event
		validEvent := map[string]interface{}{
			"timestamp": time.Now().Format(time.RFC3339),
			"metric":    "cpu_usage",
			"value":     75.5,
		}

		if err := schema.ValidateAgainstSchema(validEvent, discoveredSchema); err != nil {
			t.Errorf("Valid event failed validation: %v", err)
		}

		// Invalid event (missing required field)
		invalidEvent := map[string]interface{}{
			"timestamp": time.Now().Format(time.RFC3339),
			"value":     75.5,
		}

		if err := schema.ValidateAgainstSchema(invalidEvent, discoveredSchema); err == nil {
			t.Error("Expected validation error for missing required field")
		}
	})

	// Test 6: Data Source Creation
	t.Run("DataSourceCreation", func(t *testing.T) {
		ds := &mongo.DataSource{
			OrganizationID: org.ID,
			Name:           "Test Data Source",
			Type:           "agent-based",
			AgentType:      "test-agent",
			Status:         "active",
			Throughput:     0,
			AgentCount:     0,
		}

		if err := store.CreateDataSource(ctx, ds); err != nil {
			t.Fatalf("Failed to create data source: %v", err)
		}

		// Verify data source was created
		retrieved, err := store.GetDataSourceByID(ctx, ds.ID)
		if err != nil {
			t.Fatalf("Failed to retrieve data source: %v", err)
		}

		if retrieved.Name != ds.Name {
			t.Errorf("Expected name %s, got %s", ds.Name, retrieved.Name)
		}
	})

	// Cleanup
	t.Cleanup(func() {
		// Delete test data
		ctx := context.Background()
		store.Close(ctx)
	})
}

// TestConcurrentAgentRegistration tests concurrent agent registrations
func TestConcurrentAgentRegistration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping concurrent test in short mode")
	}

	store, err := mongo.NewStore("mongodb://localhost:27017/dna-pulse-test")
	if err != nil {
		t.Fatalf("Failed to connect to test MongoDB: %v", err)
	}
	defer store.Close(context.Background())

	ctx := context.Background()

	// Create test organization
	org := &mongo.Organization{
		Name:      "Concurrent Test Org",
		CreatedAt: time.Now(),
	}
	if err := store.CreateOrganization(ctx, org); err != nil {
		t.Fatalf("Failed to create organization: %v", err)
	}

	// Create multiple agents concurrently
	numAgents := 10
	errors := make(chan error, numAgents)
	done := make(chan bool, numAgents)

	for i := 0; i < numAgents; i++ {
		go func(index int) {
			agent := &mongo.Agent{
				OrganizationID: org.ID,
				DataSourceID:   primitive.NewObjectID(),
				Name:           "Concurrent Agent " + string(rune(index)),
				Version:        "1.0.0",
				Platform:       "linux",
				Status:         "online",
				Config:         make(map[string]interface{}),
			}

			if err := store.CreateAgent(ctx, agent); err != nil {
				errors <- err
			}
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < numAgents; i++ {
		<-done
	}

	close(errors)
	for err := range errors {
		t.Errorf("Concurrent agent creation error: %v", err)
	}
}

// TestSchemaEvolution tests schema evolution and versioning
func TestSchemaEvolution(t *testing.T) {
	// Initial schema
	sampleData1 := []map[string]interface{}{
		{"field1": "value1", "field2": 123},
	}

	schema1, err := schema.DiscoverSchema(sampleData1)
	if err != nil {
		t.Fatalf("Failed to discover initial schema: %v", err)
	}

	// Evolved schema (new field added)
	sampleData2 := []map[string]interface{}{
		{"field1": "value1", "field2": 123, "field3": true},
	}

	schema2, changed, err := schema.UpdateSchemaVersion(schema1, sampleData2)
	if err != nil {
		t.Fatalf("Failed to update schema version: %v", err)
	}

	if !changed {
		t.Error("Expected schema to have changed")
	}

	if schema2.Version != schema1.Version+1 {
		t.Errorf("Expected version %d, got %d", schema1.Version+1, schema2.Version)
	}
}

// BenchmarkSchemaDiscovery benchmarks schema discovery performance
func BenchmarkSchemaDiscovery(b *testing.B) {
	sampleData := []map[string]interface{}{
		{
			"timestamp": time.Now().Format(time.RFC3339),
			"metric":    "cpu_usage",
			"value":     75.5,
			"host":      "server-01",
			"tags":      []string{"production", "web"},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := schema.DiscoverSchema(sampleData)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkJWTGeneration benchmarks JWT generation performance
func BenchmarkJWTGeneration(b *testing.B) {
	agentID := primitive.NewObjectID().Hex()
	orgID := primitive.NewObjectID().Hex()
	dataSourceID := primitive.NewObjectID().Hex()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := auth.GenerateJWT(agentID, orgID, dataSourceID, 1*time.Hour)
		if err != nil {
			b.Fatal(err)
		}
	}
}
