package config

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"go.uber.org/zap"
	"gopkg.in/yaml.v3"
)

// Client handles config service communication
type Client struct {
	baseURL string
	scope   string
	client  *http.Client
	logger  *zap.Logger
}

// ClientConfig holds config client configuration
type ClientConfig struct {
	BaseURL string
	Scope   string
	Timeout time.Duration
	Logger  *zap.Logger
}

// NewClient creates a new config service client
func NewClient(cfg ClientConfig) *Client {
	if cfg.Timeout == 0 {
		cfg.Timeout = 30 * time.Second
	}
	if cfg.Logger == nil {
		cfg.Logger = zap.NewNop()
	}

	return &Client{
		baseURL: strings.TrimSuffix(cfg.BaseURL, "/"),
		scope:   cfg.Scope,
		client: &http.Client{
			Timeout: cfg.Timeout,
		},
		logger: cfg.Logger,
	}
}

// LoadPipeline loads the pipeline configuration from config service
func (c *Client) LoadPipeline(ctx context.Context) (*model.PipelineConfig, error) {
	url := fmt.Sprintf("%s/v1/config/%s", c.baseURL, c.scope)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("config service returned %d: %s", resp.StatusCode, string(body))
	}

	// Read body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Try to parse as YAML first (config service returns YAML)
	var config model.PipelineConfig
	if err := yaml.Unmarshal(body, &config); err != nil {
		// If YAML fails, try JSON as fallback
		if err := json.Unmarshal(body, &config); err != nil {
			return nil, fmt.Errorf("failed to decode config (tried YAML and JSON): %w", err)
		}
	}

	c.logger.Info("pipeline config loaded",
		zap.Int("version", config.Version),
		zap.Int("rules", len(config.Rules)),
	)

	return &config, nil
}

// WatchSSE watches for config updates via SSE
func (c *Client) WatchSSE(ctx context.Context, onChange func(*model.PipelineConfig)) error {
	url := fmt.Sprintf("%s/v1/stream", c.baseURL)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			if err := c.connectSSE(ctx, url, onChange); err != nil {
				c.logger.Error("SSE connection error", zap.Error(err))
				// Retry after delay
				time.Sleep(5 * time.Second)
			}
		}
	}
}

func (c *Client) connectSSE(ctx context.Context, url string, onChange func(*model.PipelineConfig)) error {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create SSE request: %w", err)
	}

	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Connection", "keep-alive")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to SSE: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("SSE returned status %d", resp.StatusCode)
	}

	c.logger.Info("SSE connection established")

	scanner := bufio.NewScanner(resp.Body)
	var eventType, eventData string

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "event: ") {
			eventType = strings.TrimSpace(strings.TrimPrefix(line, "event: "))
		} else if strings.HasPrefix(line, "data: ") {
			eventData = strings.TrimSpace(strings.TrimPrefix(line, "data: "))
		} else if line == "" && eventType != "" {
			// End of event
			c.handleSSEEvent(ctx, eventType, eventData, onChange)
			eventType, eventData = "", ""
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("SSE scanner error: %w", err)
	}

	return nil
}

func (c *Client) handleSSEEvent(ctx context.Context, eventType, data string, onChange func(*model.PipelineConfig)) {
	if eventType != "config:update" {
		return
	}

	// Parse event data
	var event struct {
		Scope string `json:"scope"`
		ETag  string `json:"etag"`
	}

	if err := json.Unmarshal([]byte(data), &event); err != nil {
		c.logger.Error("failed to parse SSE event", zap.Error(err))
		return
	}

	// Check if it's for our scope
	if event.Scope != c.scope {
		return
	}

	c.logger.Info("config update detected", zap.String("scope", event.Scope), zap.String("etag", event.ETag))

	// Reload config
	config, err := c.LoadPipeline(ctx)
	if err != nil {
		c.logger.Error("failed to reload config", zap.Error(err))
		return
	}

	onChange(config)
}
