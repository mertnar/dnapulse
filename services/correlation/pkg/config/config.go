package config

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/dnasol/dna-platform/sdks/go-sdk/configclient"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

// CorrelationConfig represents the correlation service configuration
type CorrelationConfig struct {
	WindowSeconds int      `yaml:"window_seconds"`
	GroupBy       []string `yaml:"group_by"`
	EmitIf        []string `yaml:"emit_if"`
}

// ConfigManager manages configuration loading and hot-reloading
type ConfigManager struct {
	configClient *configclient.ConfigClient
	scope        string
	config       *CorrelationConfig
	mu           sync.RWMutex
	debugMode    bool
}

// NewConfigManager creates a new configuration manager
func NewConfigManager(baseURL, scope string) *ConfigManager {
	return &ConfigManager{
		configClient: configclient.New(baseURL),
		scope:        scope,
		debugMode:    getEnvBool("DEBUG", false),
	}
}

// LoadConfig loads the initial configuration
func (cm *ConfigManager) LoadConfig() error {
	ctx := context.Background()
	result, err := cm.configClient.Load(ctx, cm.scope, nil)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	if result.Status != 200 {
		return fmt.Errorf("config not found or error: status %d", result.Status)
	}

	var config CorrelationConfig
	if err := yaml.Unmarshal([]byte(result.YAML), &config); err != nil {
		return fmt.Errorf("failed to parse config YAML: %w", err)
	}

	cm.mu.Lock()
	cm.config = &config
	cm.mu.Unlock()

	return nil
}

// StartHotReload starts the hot-reload mechanism via SSE
func (cm *ConfigManager) StartHotReload() {
	go func() {
		for {
			err := cm.configClient.WatchSSE(
				context.Background(),
				func(scope, etag string) {
					if scope == cm.scope {
						if err := cm.LoadConfig(); err != nil {
							logrus.Errorf("Failed to reload config: %v", err)
						} else {
							logrus.Infof("Config reloaded successfully for scope: %s", scope)
						}
					}
				},
			)
			if err != nil {
				logrus.Errorf("SSE connection error: %v", err)
				time.Sleep(5 * time.Second) // Retry after 5 seconds
			}
		}
	}()
}

// GetWindowSeconds returns the window duration in seconds
func (cm *ConfigManager) GetWindowSeconds() int {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	if cm.config == nil {
		return 300 // Default 5 minutes
	}
	return cm.config.WindowSeconds
}

// GetGroupBy returns the group-by fields
func (cm *ConfigManager) GetGroupBy() []string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	if cm.config == nil {
		return []string{"host", "environment"}
	}
	return cm.config.GroupBy
}

// GetEmitIf returns the emit-if expressions
func (cm *ConfigManager) GetEmitIf() []string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	if cm.config == nil {
		return []string{"count >= 3"}
	}
	return cm.config.EmitIf
}

// GetDebugMode returns whether debug mode is enabled
func (cm *ConfigManager) GetDebugMode() bool {
	return cm.debugMode
}

// GetConfig returns a copy of the current configuration
func (cm *ConfigManager) GetConfig() *CorrelationConfig {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	if cm.config == nil {
		return &CorrelationConfig{
			WindowSeconds: 300,
			GroupBy:       []string{"host", "environment"},
			EmitIf:        []string{"count >= 3"},
		}
	}

	// Return a copy to prevent race conditions
	configCopy := *cm.config
	return &configCopy
}

// Helper function to get boolean environment variable
func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}
