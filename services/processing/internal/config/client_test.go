package config_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/config"
	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestClient_LoadPipeline(t *testing.T) {
	tests := []struct {
		name           string
		serverResponse string
		statusCode     int
		expectError    bool
		expectedConfig *model.PipelineConfig
	}{
		{
			name: "successful config load",
			serverResponse: `{
				"version": 1,
				"rules": [
					{
						"name": "parse_json",
						"type": "parse_json",
						"args": {"source_field": "raw"},
						"on_error": "skip"
					}
				]
			}`,
			statusCode:  http.StatusOK,
			expectError: false,
			expectedConfig: &model.PipelineConfig{
				Version: 1,
				Rules: []model.RuleConfig{
					{
						Name:    "parse_json",
						Type:    "parse_json",
						Args:    map[string]interface{}{"source_field": "raw"},
						OnError: model.ErrorPolicySkip,
					},
				},
			},
		},
		{
			name:        "server error",
			statusCode:  http.StatusInternalServerError,
			expectError: true,
		},
		{
			name:           "invalid JSON",
			serverResponse: `invalid json`,
			statusCode:     http.StatusOK,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "/v1/config/processing", r.URL.Path)
				assert.Equal(t, "GET", r.Method)

				w.WriteHeader(tt.statusCode)
				if tt.serverResponse != "" {
					w.Write([]byte(tt.serverResponse))
				}
			}))
			defer server.Close()

			// Create client
			client := config.NewClient(config.ClientConfig{
				BaseURL: server.URL,
				Scope:   "processing",
				Timeout: 5 * time.Second,
				Logger:  zap.NewNop(),
			})

			// Test LoadPipeline
			config, err := client.LoadPipeline(context.Background())

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, config)
			} else {
				require.NoError(t, err)
				assert.NotNil(t, config)
				assert.Equal(t, tt.expectedConfig.Version, config.Version)
				assert.Len(t, config.Rules, len(tt.expectedConfig.Rules))
			}
		})
	}
}

func TestClient_WatchSSE(t *testing.T) {
	// Create test server that handles both config and SSE endpoints
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/stream" {
			// SSE endpoint
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "text/event-stream", r.Header.Get("Accept"))

			// Send SSE event
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")

			// Send config update event
			eventData := `{"scope": "processing", "etag": "123"}`
			fmt.Fprintf(w, "event: config:update\n")
			fmt.Fprintf(w, "data: %s\n\n", eventData)
			w.(http.Flusher).Flush()

			// Keep connection alive for a bit
			time.Sleep(100 * time.Millisecond)
		} else if r.URL.Path == "/v1/config/processing" {
			// Config endpoint
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"version": 1, "rules": []}`))
		}
	}))
	defer server.Close()

	// Create client
	client := config.NewClient(config.ClientConfig{
		BaseURL: server.URL,
		Scope:   "processing",
		Timeout: 5 * time.Second,
		Logger:  zap.NewNop(),
	})

	// Track config updates
	var updateReceived bool
	var receivedConfig *model.PipelineConfig

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Start SSE watch in goroutine
	go func() {
		client.WatchSSE(ctx, func(config *model.PipelineConfig) {
			updateReceived = true
			receivedConfig = config
		})
	}()

	// Wait for update or timeout
	<-ctx.Done()

	// Check if update was received
	assert.True(t, updateReceived, "SSE update should have been received")
	assert.NotNil(t, receivedConfig, "Config should have been received")
}

func TestClient_SSE_InvalidEvent(t *testing.T) {
	// Create test server that sends invalid SSE event
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")

		// Send invalid event data
		fmt.Fprintf(w, "event: config:update\n")
		fmt.Fprintf(w, "data: invalid json\n\n")
		w.(http.Flusher).Flush()
	}))
	defer server.Close()

	client := config.NewClient(config.ClientConfig{
		BaseURL: server.URL,
		Scope:   "processing",
		Timeout: 5 * time.Second,
		Logger:  zap.NewNop(),
	})

	var updateReceived bool
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	go func() {
		client.WatchSSE(ctx, func(config *model.PipelineConfig) {
			updateReceived = true
		})
	}()

	<-ctx.Done()

	// Should not receive update due to invalid JSON
	assert.False(t, updateReceived, "Should not receive update for invalid JSON")
}

func TestClient_SSE_WrongScope(t *testing.T) {
	// Create test server that sends event for different scope
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")

		// Send event for different scope
		eventData := `{"scope": "different", "etag": "123"}`
		fmt.Fprintf(w, "event: config:update\n")
		fmt.Fprintf(w, "data: %s\n\n", eventData)
		w.(http.Flusher).Flush()
	}))
	defer server.Close()

	client := config.NewClient(config.ClientConfig{
		BaseURL: server.URL,
		Scope:   "processing",
		Timeout: 5 * time.Second,
		Logger:  zap.NewNop(),
	})

	var updateReceived bool
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	go func() {
		client.WatchSSE(ctx, func(config *model.PipelineConfig) {
			updateReceived = true
		})
	}()

	<-ctx.Done()

	// Should not receive update for different scope
	assert.False(t, updateReceived, "Should not receive update for different scope")
}

func TestClient_LoadPipeline_ContextCancellation(t *testing.T) {
	// Create slow server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second) // Simulate slow response
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"version": 1, "rules": []}`))
	}))
	defer server.Close()

	client := config.NewClient(config.ClientConfig{
		BaseURL: server.URL,
		Scope:   "processing",
		Timeout: 5 * time.Second,
		Logger:  zap.NewNop(),
	})

	// Create context with short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// Should fail due to context cancellation
	_, err := client.LoadPipeline(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "context deadline exceeded")
}

func TestClient_NewClient_Defaults(t *testing.T) {
	// Test with minimal config
	client := config.NewClient(config.ClientConfig{
		BaseURL: "http://localhost:8080",
		Scope:   "test",
	})

	assert.NotNil(t, client)
	// Note: We can't access private fields directly, so we just verify the client was created
}

func TestClient_BaseURL_TrimSuffix(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"version": 1, "rules": []}`))
	}))
	defer server.Close()

	// Test with trailing slash
	client := config.NewClient(config.ClientConfig{
		BaseURL: server.URL + "/",
		Scope:   "test",
		Logger:  zap.NewNop(),
	})

	_, err := client.LoadPipeline(context.Background())
	assert.NoError(t, err)
}
