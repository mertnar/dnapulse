package app_test

import (
	"context"
	"testing"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestApp_New_MinimalConfig(t *testing.T) {
	logger := zap.NewNop()
	ctx := context.Background()

	config := app.Config{
		ServiceName:      "test-processing",
		KafkaBrokers:     []string{"localhost:9092"},
		KafkaInputTopic:  "test-input",
		KafkaOutputTopic: "test-output",
		KafkaDLQTopic:    "test-dlq",
		KafkaGroupID:     "test-group",
		ConfigURL:        "http://localhost:8084",
		ConfigScope:      "test",
	}

	application, err := app.New(ctx, config, logger)
	require.NoError(t, err)
	assert.NotNil(t, application)
	assert.NotNil(t, application.Registry)
	assert.NotNil(t, application.Executor)
	assert.NotNil(t, application.Config)
	assert.NotNil(t, application.Consumer)
	assert.NotNil(t, application.Producer)
	assert.NotNil(t, application.DLQPublisher)
	assert.NotNil(t, application.Metrics)
	assert.NotNil(t, application.Health)
	assert.NotNil(t, application.Logger)
}

func TestApp_New_WithMongoDB(t *testing.T) {
	logger := zap.NewNop()
	ctx := context.Background()

	config := app.Config{
		ServiceName:      "test-processing",
		KafkaBrokers:     []string{"localhost:9092"},
		KafkaInputTopic:  "test-input",
		KafkaOutputTopic: "test-output",
		KafkaDLQTopic:    "test-dlq",
		KafkaGroupID:     "test-group",
		ConfigURL:        "http://localhost:8084",
		ConfigScope:      "test",
		MongoURI:         "mongodb://localhost:27017",
		MongoDatabase:    "test",
	}

	application, err := app.New(ctx, config, logger)
	require.NoError(t, err)
	assert.NotNil(t, application)
	assert.NotNil(t, application.Registry)
	assert.NotNil(t, application.Executor)
	assert.NotNil(t, application.Config)
	assert.NotNil(t, application.Consumer)
	assert.NotNil(t, application.Producer)
	assert.NotNil(t, application.DLQPublisher)
	assert.NotNil(t, application.Metrics)
	assert.NotNil(t, application.Health)
	assert.NotNil(t, application.Logger)
}

func TestApp_New_WithElasticsearch(t *testing.T) {
	logger := zap.NewNop()
	ctx := context.Background()

	config := app.Config{
		ServiceName:      "test-processing",
		KafkaBrokers:     []string{"localhost:9092"},
		KafkaInputTopic:  "test-input",
		KafkaOutputTopic: "test-output",
		KafkaDLQTopic:    "test-dlq",
		KafkaGroupID:     "test-group",
		ConfigURL:        "http://localhost:8084",
		ConfigScope:      "test",
		ElasticAddresses: []string{"http://localhost:9200"},
		ElasticUsername:  "elastic",
		ElasticPassword:  "password",
	}

	application, err := app.New(ctx, config, logger)
	require.NoError(t, err)
	assert.NotNil(t, application)
	assert.NotNil(t, application.Registry)
	assert.NotNil(t, application.Executor)
	assert.NotNil(t, application.Config)
	assert.NotNil(t, application.Consumer)
	assert.NotNil(t, application.Producer)
	assert.NotNil(t, application.DLQPublisher)
	assert.NotNil(t, application.Metrics)
	assert.NotNil(t, application.Health)
	assert.NotNil(t, application.Logger)
}

func TestApp_Shutdown(t *testing.T) {
	logger := zap.NewNop()
	ctx := context.Background()

	config := app.Config{
		ServiceName:      "test-processing",
		KafkaBrokers:     []string{"localhost:9092"},
		KafkaInputTopic:  "test-input",
		KafkaOutputTopic: "test-output",
		KafkaDLQTopic:    "test-dlq",
		KafkaGroupID:     "test-group",
		ConfigURL:        "http://localhost:8084",
		ConfigScope:      "test",
	}

	application, err := app.New(ctx, config, logger)
	require.NoError(t, err)
	require.NotNil(t, application)

	// Test shutdown
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = application.Shutdown(shutdownCtx)
	assert.NoError(t, err)
}

func TestApp_StartSSEWatch(t *testing.T) {
	logger := zap.NewNop()
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	config := app.Config{
		ServiceName:      "test-processing",
		KafkaBrokers:     []string{"localhost:9092"},
		KafkaInputTopic:  "test-input",
		KafkaOutputTopic: "test-output",
		KafkaDLQTopic:    "test-dlq",
		KafkaGroupID:     "test-group",
		ConfigURL:        "http://localhost:8084",
		ConfigScope:      "test",
	}

	application, err := app.New(ctx, config, logger)
	require.NoError(t, err)
	require.NotNil(t, application)

	// Start SSE watch
	application.StartSSEWatch(ctx)

	// Wait for context to timeout (SSE will fail to connect, but that's expected)
	<-ctx.Done()

	// Should not panic or crash
	assert.NotNil(t, application)
}

func TestApp_Config_Validation(t *testing.T) {
	tests := []struct {
		name        string
		config      app.Config
		expectError bool
		errorMsg    string
	}{
		{
			name: "empty service name",
			config: app.Config{
				ServiceName:      "",
				KafkaBrokers:     []string{"localhost:9092"},
				KafkaInputTopic:  "test-input",
				KafkaOutputTopic: "test-output",
				KafkaDLQTopic:    "test-dlq",
				KafkaGroupID:     "test-group",
				ConfigURL:        "http://localhost:8084",
				ConfigScope:      "test",
			},
			expectError: false, // Service name can be empty, will use default
		},
		{
			name: "empty Kafka brokers",
			config: app.Config{
				ServiceName:      "test",
				KafkaBrokers:     []string{},
				KafkaInputTopic:  "test-input",
				KafkaOutputTopic: "test-output",
				KafkaDLQTopic:    "test-dlq",
				KafkaGroupID:     "test-group",
				ConfigURL:        "http://localhost:8084",
				ConfigScope:      "test",
			},
			expectError: false, // Empty brokers will cause issues later but not in New()
		},
		{
			name: "empty config URL",
			config: app.Config{
				ServiceName:      "test",
				KafkaBrokers:     []string{"localhost:9092"},
				KafkaInputTopic:  "test-input",
				KafkaOutputTopic: "test-output",
				KafkaDLQTopic:    "test-dlq",
				KafkaGroupID:     "test-group",
				ConfigURL:        "",
				ConfigScope:      "test",
			},
			expectError: false, // Empty config URL will cause issues later but not in New()
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger := zap.NewNop()
			ctx := context.Background()

			application, err := app.New(ctx, tt.config, logger)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
				assert.Nil(t, application)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, application)
			}
		})
	}
}

func TestApp_Components_Initialization(t *testing.T) {
	logger := zap.NewNop()
	ctx := context.Background()

	config := app.Config{
		ServiceName:      "test-processing",
		KafkaBrokers:     []string{"localhost:9092"},
		KafkaInputTopic:  "test-input",
		KafkaOutputTopic: "test-output",
		KafkaDLQTopic:    "test-dlq",
		KafkaGroupID:     "test-group",
		ConfigURL:        "http://localhost:8084",
		ConfigScope:      "test",
		SchemaPath:       "../../contracts/schemas/processing.rules.schema.json",
	}

	application, err := app.New(ctx, config, logger)
	require.NoError(t, err)
	require.NotNil(t, application)

	// Test that all components are initialized
	assert.NotNil(t, application.Registry, "Registry should be initialized")
	assert.NotNil(t, application.Executor, "Executor should be initialized")
	assert.NotNil(t, application.Config, "Config client should be initialized")
	assert.NotNil(t, application.Consumer, "Consumer should be initialized")
	assert.NotNil(t, application.Producer, "Producer should be initialized")
	assert.NotNil(t, application.DLQPublisher, "DLQ publisher should be initialized")
	assert.NotNil(t, application.Metrics, "Metrics should be initialized")
	assert.NotNil(t, application.Health, "Health check should be initialized")
	assert.NotNil(t, application.Logger, "Logger should be initialized")

	// Test that registry has rules registered
	types := application.Registry.Types()
	assert.NotEmpty(t, types, "Registry should have rules registered")

	// Check for some expected rule types
	expectedRules := []string{"parse_json", "normalize_fields", "unit_convert", "redact_mask", "deduplicate"}
	for _, ruleType := range expectedRules {
		assert.Contains(t, types, ruleType, "Registry should contain %s rule", ruleType)
	}
}

func TestApp_WithObservability(t *testing.T) {
	logger := zap.NewNop()
	ctx := context.Background()

	config := app.Config{
		ServiceName:      "test-processing",
		KafkaBrokers:     []string{"localhost:9092"},
		KafkaInputTopic:  "test-input",
		KafkaOutputTopic: "test-output",
		KafkaDLQTopic:    "test-dlq",
		KafkaGroupID:     "test-group",
		ConfigURL:        "http://localhost:8084",
		ConfigScope:      "test",
		JaegerEndpoint:   "http://localhost:14268/api/traces",
	}

	application, err := app.New(ctx, config, logger)
	require.NoError(t, err)
	require.NotNil(t, application)

	// Test that observability components are initialized
	assert.NotNil(t, application.Metrics, "Metrics should be initialized")
	assert.NotNil(t, application.Health, "Health check should be initialized")

	// Test health check registration
	// Note: We can't easily test the health check functions without actual services
	// but we can verify the health check object is created
	assert.NotNil(t, application.Health)
}
