package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// Config represents the agent configuration
type Config struct {
	Agent      AgentConfig      `yaml:"agent"`
	Ingestion  IngestionConfig  `yaml:"ingestion"`
	Collection CollectionConfig `yaml:"collection"`
	Metadata   MetadataConfig   `yaml:"metadata"`
	Sync       SyncConfig       `yaml:"sync"`
}

// AgentConfig contains agent-specific settings
type AgentConfig struct {
	Name        string `yaml:"name"`
	Type        string `yaml:"type"`    // syslog, windows-event, custom-app, etc.
	TypeID      string `yaml:"type_id"` // Agent Type ID (required for registration)
	Version     string `yaml:"version"`
	Description string `yaml:"description"`
	Platform    string `yaml:"platform"` // linux, windows, macos, docker
	Hostname    string `yaml:"hostname"` // auto-detected if empty
	IPAddress   string `yaml:"ip_address"` // auto-detected if empty
	LogLevel    string `yaml:"log_level"` // debug, info, warn, error
	LogFile     string `yaml:"log_file"`
}

// IngestionConfig contains ingestion service connection settings
type IngestionConfig struct {
	URL            string        `yaml:"url"`
	APIKey         string        `yaml:"api_key"`
	Timeout        time.Duration `yaml:"timeout"`
	RetryAttempts  int           `yaml:"retry_attempts"`
	RetryDelay     time.Duration `yaml:"retry_delay"`
	BatchSize      int           `yaml:"batch_size"`
	FlushInterval  time.Duration `yaml:"flush_interval"`
}

// CollectionConfig contains data collection settings
type CollectionConfig struct {
	Enabled       bool          `yaml:"enabled"`
	Interval      time.Duration `yaml:"interval"` // How often to collect data
	Sources       []SourceConfig `yaml:"sources"`
	MaxBatchSize  int           `yaml:"max_batch_size"`
	BufferSize    int           `yaml:"buffer_size"`
}

// SourceConfig represents a data source to collect from
type SourceConfig struct {
	Type    string                 `yaml:"type"` // file, syslog, command, api, etc.
	Enabled bool                   `yaml:"enabled"`
	Path    string                 `yaml:"path,omitempty"`
	Command string                 `yaml:"command,omitempty"`
	Filter  string                 `yaml:"filter,omitempty"`
	Fields  map[string]interface{} `yaml:"fields,omitempty"`
}

// MetadataConfig contains data source metadata
type MetadataConfig struct {
	AgentID        string            `yaml:"agent_id"`        // Agent instance ID
	DataSourceID   string            `yaml:"data_source_id"`  // Set after registration
	JWTToken       string            `yaml:"jwt_token"`       // JWT token for authentication
	OrganizationID string            `yaml:"organization_id"`
	Environment    string            `yaml:"environment"` // prod, staging, dev
	Region         string            `yaml:"region"`
	Tags           map[string]string `yaml:"tags"`
	CustomFields   map[string]string `yaml:"custom_fields"`
}

// SyncConfig contains configuration sync settings
type SyncConfig struct {
	Enabled       bool          `yaml:"enabled"`
	Interval      time.Duration `yaml:"interval"` // How often to check for config updates
	URL           string        `yaml:"url"`      // Config sync endpoint
	AutoApply     bool          `yaml:"auto_apply"` // Automatically apply config changes
	BackupConfigs bool          `yaml:"backup_configs"` // Backup configs before applying
}

// LoadConfig loads configuration from a YAML file
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Set defaults
	if cfg.Agent.LogLevel == "" {
		cfg.Agent.LogLevel = "info"
	}
	if cfg.Agent.Platform == "" {
		cfg.Agent.Platform = detectPlatform()
	}
	if cfg.Agent.Hostname == "" {
		cfg.Agent.Hostname, _ = os.Hostname()
	}
	if cfg.Ingestion.Timeout == 0 {
		cfg.Ingestion.Timeout = 30 * time.Second
	}
	if cfg.Ingestion.RetryAttempts == 0 {
		cfg.Ingestion.RetryAttempts = 3
	}
	if cfg.Ingestion.RetryDelay == 0 {
		cfg.Ingestion.RetryDelay = 5 * time.Second
	}
	if cfg.Ingestion.BatchSize == 0 {
		cfg.Ingestion.BatchSize = 100
	}
	if cfg.Ingestion.FlushInterval == 0 {
		cfg.Ingestion.FlushInterval = 10 * time.Second
	}
	if cfg.Collection.MaxBatchSize == 0 {
		cfg.Collection.MaxBatchSize = 1000
	}
	if cfg.Collection.BufferSize == 0 {
		cfg.Collection.BufferSize = 10000
	}
	if cfg.Sync.Interval == 0 {
		cfg.Sync.Interval = 5 * time.Minute
	}

	return &cfg, nil
}

// SaveConfig saves the configuration to a YAML file
func SaveConfig(cfg *Config, path string) error {
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// detectPlatform detects the current platform
func detectPlatform() string {
	switch os.Getenv("GOOS") {
	case "linux":
		return "linux"
	case "windows":
		return "windows"
	case "darwin":
		return "macos"
	default:
		return "unknown"
	}
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.Agent.Name == "" {
		return fmt.Errorf("agent.name is required")
	}
	if c.Agent.Type == "" {
		return fmt.Errorf("agent.type is required")
	}
	if c.Agent.TypeID == "" {
		return fmt.Errorf("agent.type_id is required (download agent from web UI to get correct type_id)")
	}
	if c.Ingestion.URL == "" {
		return fmt.Errorf("ingestion.url is required")
	}
	if c.Ingestion.APIKey == "" {
		return fmt.Errorf("ingestion.api_key is required")
	}
	return nil
}
