package config

import (
	"context"
	"fmt"
	"os"
	"sync"

	"github.com/dnasol/dna-platform/sdks/go-sdk/configclient"
	"gopkg.in/yaml.v3"
)

// IngestionConfig represents the configuration for the ingestion service
type IngestionConfig struct {
	AllowedSources []string `yaml:"allowed_sources" json:"allowed_sources"`
	MaxBodyKB      int      `yaml:"max_body_kb" json:"max_body_kb"`
	RateLimitRPS   int      `yaml:"rate_limit_rps" json:"rate_limit_rps"`
}

// DefaultConfig returns the default configuration
func DefaultConfig() *IngestionConfig {
	return &IngestionConfig{
		AllowedSources: []string{"*"}, // Allow all sources by default
		MaxBodyKB:      1024,          // 1MB default
		RateLimitRPS:   100,           // 100 requests per second
	}
}

// ConfigManager manages dynamic configuration for the ingestion service
type ConfigManager struct {
	config      *IngestionConfig
	configMu    sync.RWMutex
	client      *configclient.ConfigClient
	configURL   string
	configScope string
	debug       bool
}

// NewConfigManager creates a new configuration manager
func NewConfigManager() *ConfigManager {
	configURL := getEnv("CONFIG_URL", "http://config:8080")
	configScope := getEnv("CONFIG_SCOPE", "ingestion")
	debug := getEnv("DEBUG", "0") == "1"

	client := configclient.New(configURL)

	return &ConfigManager{
		config:      DefaultConfig(),
		client:      client,
		configURL:   configURL,
		configScope: configScope,
		debug:       debug,
	}
}

// LoadConfig loads configuration from the Config Service
func (cm *ConfigManager) LoadConfig(ctx context.Context) error {
	result, err := cm.client.Load(ctx, cm.configScope, nil)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	if result.Status == 200 {
		var newConfig IngestionConfig
		if err := yaml.Unmarshal([]byte(result.YAML), &newConfig); err != nil {
			return fmt.Errorf("failed to parse config YAML: %w", err)
		}

		// Validate config
		if err := cm.validateConfig(&newConfig); err != nil {
			return fmt.Errorf("invalid config: %w", err)
		}

		cm.configMu.Lock()
		cm.config = &newConfig
		cm.configMu.Unlock()

		if cm.debug {
			fmt.Printf("Config loaded successfully: %+v\n", cm.config)
		}
	}

	return nil
}

// StartHotReload starts watching for configuration updates via SSE
func (cm *ConfigManager) StartHotReload(ctx context.Context) error {
	return cm.client.WatchSSE(ctx, func(scope, etag string) {
		if scope == cm.configScope {
			if cm.debug {
				fmt.Printf("Config update detected for scope: %s, etag: %s\n", scope, etag)
			}

			// Reload config
			if err := cm.LoadConfig(ctx); err != nil {
				fmt.Printf("Failed to reload config: %v\n", err)
			} else {
				fmt.Printf("Config reloaded successfully for scope: %s\n", scope)
			}
		}
	})
}

// GetConfig returns a copy of the current configuration
func (cm *ConfigManager) GetConfig() *IngestionConfig {
	cm.configMu.RLock()
	defer cm.configMu.RUnlock()

	// Return a copy to prevent race conditions
	configCopy := &IngestionConfig{
		AllowedSources: make([]string, len(cm.config.AllowedSources)),
		MaxBodyKB:      cm.config.MaxBodyKB,
		RateLimitRPS:   cm.config.RateLimitRPS,
	}
	copy(configCopy.AllowedSources, cm.config.AllowedSources)

	return configCopy
}

// IsSourceAllowed checks if a source is allowed
func (cm *ConfigManager) IsSourceAllowed(source string) bool {
	cm.configMu.RLock()
	defer cm.configMu.RUnlock()

	// Check for wildcard
	for _, allowed := range cm.config.AllowedSources {
		if allowed == "*" || allowed == source {
			return true
		}
	}
	return false
}

// GetMaxBodySize returns the maximum body size in bytes
func (cm *ConfigManager) GetMaxBodySize() int64 {
	cm.configMu.RLock()
	defer cm.configMu.RUnlock()

	return int64(cm.config.MaxBodyKB * 1024)
}

// GetRateLimitRPS returns the rate limit in requests per second
func (cm *ConfigManager) GetRateLimitRPS() int {
	cm.configMu.RLock()
	defer cm.configMu.RUnlock()

	return cm.config.RateLimitRPS
}

// GetDebugMode returns whether debug mode is enabled
func (cm *ConfigManager) GetDebugMode() bool {
	return cm.debug
}

// validateConfig validates the configuration
func (cm *ConfigManager) validateConfig(config *IngestionConfig) error {
	if len(config.AllowedSources) == 0 {
		return fmt.Errorf("allowed_sources cannot be empty")
	}

	if config.MaxBodyKB <= 0 {
		return fmt.Errorf("max_body_kb must be positive")
	}

	if config.RateLimitRPS <= 0 {
		return fmt.Errorf("rate_limit_rps must be positive")
	}

	return nil
}

// Helper function to get environment variables
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
