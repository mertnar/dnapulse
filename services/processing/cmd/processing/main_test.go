package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/app"
	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestDevProcessHandler(t *testing.T) {
	// Create mock application
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

	// Create handler
	handler := DevProcessHandler(application, logger)

	tests := []struct {
		name           string
		requestBody    string
		expectedStatus int
		expectError    bool
	}{
		{
			name: "valid event",
			requestBody: `{
				"event_id": "test-123",
				"tenant_id": "tenant-1",
				"ts": "2024-01-01T00:00:00Z",
				"kind": "log",
				"payload": {"message": "test"},
				"attributes": {"raw": "{\"level\":\"info\"}"}
			}`,
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:           "invalid JSON",
			requestBody:    `invalid json`,
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name: "missing required fields",
			requestBody: `{
				"event_id": "test-123"
			}`,
			expectedStatus: http.StatusOK, // Should still process
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/v1/process", strings.NewReader(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if !tt.expectError {
				assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
				assert.NotEmpty(t, w.Header().Get("X-Processing-Duration"))

				// Parse response
				var response model.Event
				err := json.NewDecoder(w.Body).Decode(&response)
				assert.NoError(t, err)
				assert.NotEmpty(t, response.EventID)
			} else {
				assert.Contains(t, w.Body.String(), "invalid JSON")
			}
		})
	}
}

func TestLoadConfig(t *testing.T) {
	// Test with default values
	config := LoadConfig()

	assert.Equal(t, "processing", config.ServiceName)
	assert.Equal(t, []string{"localhost:9092"}, config.KafkaBrokers)
	assert.Equal(t, "ingestion.raw.v1", config.KafkaInputTopic)
	assert.Equal(t, "processing.cleaned.v1", config.KafkaOutputTopic)
	assert.Equal(t, "processing.dlq", config.KafkaDLQTopic)
	assert.Equal(t, "processing-service", config.KafkaGroupID)
	assert.Equal(t, "http://localhost:8084", config.ConfigURL)
	assert.Equal(t, "processing", config.ConfigScope)
	assert.Equal(t, "", config.MongoURI)
	assert.Equal(t, "dna", config.MongoDatabase)
	assert.Equal(t, []string{""}, config.ElasticAddresses)
	assert.Equal(t, "", config.ElasticUsername)
	assert.Equal(t, "", config.ElasticPassword)
	assert.Equal(t, "", config.JaegerEndpoint)
	assert.Equal(t, "contracts/schemas/processing.rules.schema.json", config.SchemaPath)
}

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name         string
		key          string
		defaultValue string
		expected     string
	}{
		{
			name:         "existing environment variable",
			key:          "PATH",
			defaultValue: "default",
			expected:     os.Getenv("PATH"), // Should return actual PATH value
		},
		{
			name:         "non-existing environment variable",
			key:          "NON_EXISTING_VAR_12345",
			defaultValue: "default",
			expected:     "default",
		},
		{
			name:         "empty environment variable",
			key:          "EMPTY_VAR",
			defaultValue: "default",
			expected:     "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetEnv(tt.key, tt.defaultValue)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestConsumeLoop_ContextCancellation(t *testing.T) {
	// Create mock application
	logger := zap.NewNop()
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
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
		SchemaPath:       "../../contracts/schemas/processing.rules.schema.json",
	}

	application, err := app.New(ctx, config, logger)
	require.NoError(t, err)
	require.NotNil(t, application)

	// Start consume loop
	go ConsumeLoop(ctx, application, logger)

	// Wait for context to be cancelled
	<-ctx.Done()

	// Should not panic or crash
	assert.NotNil(t, application)
}

func TestDevProcessHandler_ProcessingError(t *testing.T) {
	// Create mock application with invalid config to cause processing errors
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
		SchemaPath:       "non-existent-schema.json", // This will cause errors
	}

	application, err := app.New(ctx, config, logger)
	require.NoError(t, err)
	require.NotNil(t, application)

	// Create handler
	handler := DevProcessHandler(application, logger)

	// Test with event that might cause processing errors
	requestBody := `{
		"event_id": "test-error",
		"tenant_id": "tenant-1",
		"ts": "2024-01-01T00:00:00Z",
		"kind": "log",
		"payload": {"message": "test"},
		"attributes": {"raw": "{\"level\":\"info\"}"}
	}`

	req := httptest.NewRequest("POST", "/v1/process", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Should handle errors gracefully
	assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError)
}

func TestDevProcessHandler_EmptyBody(t *testing.T) {
	// Create mock application
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

	// Create handler
	handler := DevProcessHandler(application, logger)

	// Test with empty body
	req := httptest.NewRequest("POST", "/v1/process", strings.NewReader(""))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "invalid JSON")
}

func TestDevProcessHandler_ResponseHeaders(t *testing.T) {
	// Create mock application
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

	// Create handler
	handler := DevProcessHandler(application, logger)

	// Test with valid event
	requestBody := `{
		"event_id": "test-headers",
		"tenant_id": "tenant-1",
		"ts": "2024-01-01T00:00:00Z",
		"kind": "log",
		"payload": {"message": "test"},
		"attributes": {"raw": "{\"level\":\"info\"}"}
	}`

	req := httptest.NewRequest("POST", "/v1/process", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

	// Check that processing duration header is set
	duration := w.Header().Get("X-Processing-Duration")
	assert.NotEmpty(t, duration)

	// Should be a valid duration string
	_, err = time.ParseDuration(duration)
	assert.NoError(t, err)
}
