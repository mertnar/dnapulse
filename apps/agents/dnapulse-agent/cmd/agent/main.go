package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/dnasol/dna-platform/agents/dnapulse-agent/pkg/collector"
	"github.com/dnasol/dna-platform/agents/dnapulse-agent/pkg/config"
	"github.com/dnasol/dna-platform/agents/dnapulse-agent/pkg/sender"
	"github.com/dnasol/dna-platform/agents/dnapulse-agent/pkg/sync"
)

const (
	version = "1.0.0"
)

var (
	// Default to a local agent.yaml in the current directory.
	// This makes the downloaded/sample packages work out-of-the-box:
	//   ./linux-resource-monitor-linux-amd64 -register
	// will automatically pick up ./agent.yaml next to the binary.
	configPath  = flag.String("config", "agent.yaml", "Path to configuration file")
	register    = flag.Bool("register", false, "Register agent with ingestion service")
	test        = flag.Bool("test", false, "Test configuration and exit")
	showVersion = flag.Bool("version", false, "Show version and exit")
)

func main() {
	flag.Parse()

	if *showVersion {
		fmt.Printf("DNA Pulse Agent v%s\n", version)
		os.Exit(0)
	}

	// Load configuration (allow missing config file in register mode)
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		if *register {
			// In register mode, create a minimal config if file doesn't exist
			log.Printf("Config file not found, creating minimal config for registration...")
			cfg = createMinimalConfig()
		} else {
			log.Fatalf("Failed to load config: %v", err)
		}
	}

	// Validate configuration (skip some validations in register mode)
	if !*register {
		if err := cfg.Validate(); err != nil {
			log.Fatalf("Invalid configuration: %v", err)
		}
	} else {
		// In register mode, only validate essential fields
		if cfg.Ingestion.URL == "" {
			log.Fatalf("Ingestion URL is required (set via config or INGESTION_URL env var)")
		}
		if cfg.Ingestion.APIKey == "" {
			log.Fatalf("API Key is required (set via config or API_KEY env var)")
		}
	}

	// Setup logging (non-fatal in register mode)
	if err := setupLogging(cfg); err != nil {
		if *register {
			log.Printf("Warning: failed to setup logging: %v (continuing with stdout)", err)
		} else {
			log.Fatalf("Failed to setup logging: %v", err)
		}
	}

	log.Printf("DNA Pulse Agent v%s starting...", version)
	log.Printf("Agent: %s (type: %s)", cfg.Agent.Name, cfg.Agent.Type)
	log.Printf("Platform: %s, Hostname: %s", cfg.Agent.Platform, cfg.Agent.Hostname)
	log.Printf("Ingestion URL: %s", cfg.Ingestion.URL)

	if *test {
		log.Println("Configuration is valid")
		os.Exit(0)
	}

	// Create event channel
	eventCh := make(chan map[string]interface{}, cfg.Collection.BufferSize)

	// Create sender
	snd := sender.NewSender(cfg)

	// Load existing JWT token if available
	if cfg.Metadata.JWTToken != "" {
		snd.SetJWTToken(cfg.Metadata.JWTToken)
		snd.SetAgentID(cfg.Metadata.AgentID)
		snd.SetDataSourceID(cfg.Metadata.DataSourceID)
		log.Printf("Loaded existing JWT token from config")
	}

	// Register or load existing registration
	if *register || cfg.Metadata.DataSourceID == "" {
		log.Println("Registering agent...")
		log.Println("Note: Schema will be automatically discovered when agent sends first data")

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		regResp, err := snd.Register(ctx)
		if err != nil {
			log.Fatalf("Failed to register agent: %v", err)
		}

		// Save agent ID and JWT token to config
		cfg.Metadata.AgentID = regResp.AgentID
		cfg.Metadata.JWTToken = regResp.JWTToken
		cfg.Metadata.DataSourceID = regResp.DataSourceID

		// Save the received config to the default location
		if len(regResp.Config) > 0 {
			log.Printf("Received config from server (version %d)", regResp.ConfigVersion)

			// Merge server config with local config (server config takes precedence for default values)
			if err := mergeServerConfig(cfg, regResp.Config, regResp.ConfigVersion); err != nil {
				log.Printf("Warning: failed to merge config: %v", err)
			}
		}

		// Try to save config to default system location first, fallback to home directory
		defaultConfigPath := "/etc/dnapulse-agent/agent.yaml"
		homeDir, _ := os.UserHomeDir()
		homeConfigPath := filepath.Join(homeDir, ".dnapulse", "agent.yaml")

		savedConfigPath := ""

		// Try system location first
		configDir := filepath.Dir(defaultConfigPath)
		if err := os.MkdirAll(configDir, 0755); err == nil {
			if err := config.SaveConfig(cfg, defaultConfigPath); err == nil {
				savedConfigPath = defaultConfigPath
				log.Printf("Config saved to %s", defaultConfigPath)
			}
		}

		// If system location failed, use home directory
		if savedConfigPath == "" && homeDir != "" {
			homeConfigDir := filepath.Dir(homeConfigPath)
			if err := os.MkdirAll(homeConfigDir, 0755); err == nil {
				if err := config.SaveConfig(cfg, homeConfigPath); err == nil {
					savedConfigPath = homeConfigPath
					log.Printf("Config saved to %s", homeConfigPath)
				}
			}
		}

		if savedConfigPath == "" {
			log.Printf("Warning: could not save config file to any location")
		}

		log.Println("Agent registered successfully")

		// If only registering, exit
		if *register {
			log.Printf("Agent ID: %s", snd.GetAgentID())
			log.Printf("Data Source ID: %s", snd.GetDataSourceID())
			log.Printf("Config Version: %d", regResp.ConfigVersion)
			if savedConfigPath != "" {
				log.Printf("Config file: %s", savedConfigPath)
				log.Printf("\nTo run the agent, use:")
				log.Printf("  %s -config %s", os.Args[0], savedConfigPath)
			} else {
				log.Printf("Warning: Config was not saved to disk. You may need to run with sudo or provide a writable config path.")
			}
			os.Exit(0)
		}
	} else {
		log.Printf("Using existing registration: DataSource=%s", cfg.Metadata.DataSourceID)
	}

	// Create collector
	coll := collector.NewCollector(cfg, eventCh)

	// Create config syncer with JWT token from sender
	syncer := sync.NewSyncer(cfg, snd.GetJWTToken(), *configPath)

	// Setup signal handling
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Start sender
	snd.Start()

	// Start collector
	coll.Start()

	// Start config syncer
	syncer.Start()

	// Start health check loop
	go startHealthCheckLoop(snd, cfg)

	// Start event forwarding loop
	go func() {
		for event := range eventCh {
			snd.BufferEvent(event)
		}
	}()

	log.Println("Agent is running. Press Ctrl+C to stop.")

	// Wait for shutdown signal
	sig := <-sigCh
	log.Printf("Received signal: %v. Shutting down...", sig)

	// Graceful shutdown
	coll.Stop()
	syncer.Stop()
	snd.Stop()
	close(eventCh)

	log.Println("Agent stopped")
}

// setupLogging configures logging based on the configuration
func setupLogging(cfg *config.Config) error {
	if cfg.Agent.LogFile != "" {
		// Create log directory if needed
		logDir := filepath.Dir(cfg.Agent.LogFile)
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return fmt.Errorf("failed to create log directory: %w", err)
		}

		// Open log file
		f, err := os.OpenFile(cfg.Agent.LogFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return fmt.Errorf("failed to open log file: %w", err)
		}

		log.SetOutput(f)
	}

	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	return nil
}

// createMinimalConfig creates a minimal config from environment variables for registration
func createMinimalConfig() *config.Config {
	hostname, _ := os.Hostname()
	homeDir, _ := os.UserHomeDir()

	// Get config from environment variables
	ingestionURL := os.Getenv("INGESTION_URL")
	if ingestionURL == "" {
		ingestionURL = "http://localhost:19071"
	}

	apiKey := os.Getenv("API_KEY")
	agentName := os.Getenv("AGENT_NAME")
	if agentName == "" {
		agentName = "linux-resource-monitor"
	}

	agentType := os.Getenv("AGENT_TYPE")
	if agentType == "" {
		agentType = "linux-resource-monitor"
	}

	// Use home directory for log file if /var/log is not accessible
	logFile := "/var/log/dnapulse/agent.log"
	if homeDir != "" {
		logFile = filepath.Join(homeDir, ".dnapulse", "agent.log")
	}

	return &config.Config{
		Agent: config.AgentConfig{
			Name:        agentName,
			Type:        agentType,
			Version:     version,
			Description: "Auto-registered agent",
			Platform:    "linux",
			Hostname:    hostname,
			LogLevel:    "info",
			LogFile:     logFile,
		},
		Ingestion: config.IngestionConfig{
			URL:           ingestionURL,
			APIKey:        apiKey,
			Timeout:       30 * time.Second,
			RetryAttempts: 3,
			RetryDelay:    5 * time.Second,
			BatchSize:     100,
			FlushInterval: 10 * time.Second,
		},
		Collection: config.CollectionConfig{
			Enabled:      true,
			Interval:     10 * time.Second,
			MaxBatchSize: 1000,
			BufferSize:   10000,
			Sources:      []config.SourceConfig{},
		},
		Metadata: config.MetadataConfig{
			Environment:  "production",
			Region:       "default",
			Tags:         make(map[string]string),
			CustomFields: make(map[string]string),
		},
		Sync: config.SyncConfig{
			Enabled:       true,
			Interval:      5 * time.Minute,
			AutoApply:     true,
			BackupConfigs: true,
		},
	}
}

// mergeServerConfig merges server-provided config with local config
func mergeServerConfig(localCfg *config.Config, serverCfg map[string]interface{}, configVersion int) error {
	// Server config provides defaults but doesn't override explicit local settings

	if collection, ok := serverCfg["collection"].(map[string]interface{}); ok {
		// Update collection enabled flag
		if enabled, ok := collection["enabled"].(bool); ok {
			localCfg.Collection.Enabled = enabled
		}

		// Update collection interval
		if intervalStr, ok := collection["interval"].(string); ok {
			if interval, err := time.ParseDuration(intervalStr); err == nil {
				localCfg.Collection.Interval = interval
			}
		}

		// Update sources if provided
		if sources, ok := collection["sources"].([]interface{}); ok && len(sources) > 0 {
			localCfg.Collection.Sources = make([]config.SourceConfig, 0, len(sources))
			for _, s := range sources {
				if sourceMap, ok := s.(map[string]interface{}); ok {
					source := config.SourceConfig{
						Type:    getString(sourceMap, "type"),
						Enabled: getBool(sourceMap, "enabled"),
						Fields:  make(map[string]interface{}),
					}
					// Copy all fields for this source
					for k, v := range sourceMap {
						if k != "type" && k != "enabled" {
							source.Fields[k] = v
						}
					}
					localCfg.Collection.Sources = append(localCfg.Collection.Sources, source)
				}
			}
			log.Printf("Merged %d collection sources from server config", len(localCfg.Collection.Sources))
		}
	}

	log.Printf("Merged server config version %d", configVersion)
	return nil
}

// Helper functions for type-safe map access
func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

// startHealthCheckLoop sends periodic health checks
func startHealthCheckLoop(snd *sender.Sender, cfg *config.Config) {
	// Wait a bit before first health check
	time.Sleep(10 * time.Second)

	ticker := time.NewTicker(60 * time.Second) // Health check every minute
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		if err := snd.SendHealthCheck(ctx); err != nil {
			log.Printf("Health check failed: %v", err)
		}
		cancel()
	}
}
