package configclient

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ConfigClient provides methods to interact with the Config Service
type ConfigClient struct {
	baseURL    string
	httpClient *http.Client
}

// New creates a new ConfigClient instance
func New(baseURL string) *ConfigClient {
	return &ConfigClient{
		baseURL: strings.TrimSuffix(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// LoadResult represents the result of a config load operation
type LoadResult struct {
	YAML   string
	ETag   string
	Status int
}

// Load retrieves configuration for the given scope
// If etag is provided, it will send If-None-Match header for conditional requests
func (c *ConfigClient) Load(ctx context.Context, scope string, etag *string) (*LoadResult, error) {
	url := fmt.Sprintf("%s/v1/config/%s", c.baseURL, scope)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/x-yaml")

	// Add If-None-Match header if etag is provided
	if etag != nil && *etag != "" {
		req.Header.Set("If-None-Match", *etag)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	responseETag := resp.Header.Get("ETag")

	return &LoadResult{
		YAML:   string(body),
		ETag:   responseETag,
		Status: resp.StatusCode,
	}, nil
}

// SSEUpdate represents an SSE update message
type SSEUpdate struct {
	Scope string `json:"scope"`
	ETag  string `json:"etag"`
}

// WatchSSE connects to the SSE stream and calls onUpdate for each config update
func (c *ConfigClient) WatchSSE(ctx context.Context, onUpdate func(scope, etag string)) error {
	sseURL := fmt.Sprintf("%s/v1/stream", c.baseURL)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		err := c.connectSSE(ctx, sseURL, onUpdate)
		if err != nil {
			// Log error and retry with backoff
			fmt.Printf("SSE connection error: %v\n", err)

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(5 * time.Second):
				continue
			}
		}
	}
}

func (c *ConfigClient) connectSSE(ctx context.Context, sseURL string, onUpdate func(scope, etag string)) error {
	req, err := http.NewRequestWithContext(ctx, "GET", sseURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create SSE request: %w", err)
	}

	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to SSE: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("SSE connection failed with status: %d", resp.StatusCode)
	}

	decoder := json.NewDecoder(resp.Body)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		var update SSEUpdate
		err := decoder.Decode(&update)
		if err != nil {
			if err == io.EOF {
				// Connection closed by server, will retry
				return fmt.Errorf("SSE connection closed by server")
			}
			return fmt.Errorf("failed to decode SSE message: %w", err)
		}

		onUpdate(update.Scope, update.ETag)
	}
}

// LoadWithRetry loads configuration with exponential backoff retry
func (c *ConfigClient) LoadWithRetry(ctx context.Context, scope string, etag *string, maxRetries int) (*LoadResult, error) {
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		result, err := c.Load(ctx, scope, etag)
		if err == nil {
			return result, nil
		}

		lastErr = err

		// Exponential backoff: 1s, 2s, 4s, 8s...
		backoff := time.Duration(1<<uint(i)) * time.Second

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(backoff):
			continue
		}
	}

	return nil, fmt.Errorf("failed after %d retries: %w", maxRetries, lastErr)
}

// Helper function for simple usage
func Load(ctx context.Context, baseURL, scope string, etag *string) (yaml string, newETag string, status int, err error) {
	client := New(baseURL)
	result, err := client.Load(ctx, scope, etag)
	if err != nil {
		return "", "", 0, err
	}

	return result.YAML, result.ETag, result.Status, nil
}

// Helper function for SSE watching
func WatchSSE(ctx context.Context, sseURL string, onUpdate func(scope, etag string)) error {
	client := New(sseURL)
	return client.WatchSSE(ctx, onUpdate)
}
