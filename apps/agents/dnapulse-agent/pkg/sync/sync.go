package sync

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/dnasol/dna-platform/agents/dnapulse-agent/pkg/config"
)

// Syncer handles configuration synchronization with the server
type Syncer struct {
	config     *config.Config
	client     *http.Client
	jwtToken   string
	configPath string
	stopCh     chan struct{}
}

// ConfigUpdate represents a configuration update from the server
type ConfigUpdate struct {
	Version    int                    `json:"version"`
	UpdatedAt  string                 `json:"updated_at"`
	UpdatedBy  string                 `json:"updated_by"`
	Changes    map[string]interface{} `json:"changes"`
	FullConfig *config.Config         `json:"full_config,omitempty"`
}

// NewSyncer creates a new configuration syncer
func NewSyncer(cfg *config.Config, jwtToken, configPath string) *Syncer {
	// Build sync URL from ingestion URL if not provided
	syncURL := cfg.Sync.URL
	if syncURL == "" && cfg.Ingestion.URL != "" {
		syncURL = cfg.Ingestion.URL + "/api/v1/agent/config"
	}

	return &Syncer{
		config:     cfg,
		jwtToken:   jwtToken,
		configPath: configPath,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		stopCh: make(chan struct{}),
	}
}

// Start starts the periodic config sync
func (s *Syncer) Start() {
	if !s.config.Sync.Enabled {
		log.Println("Config sync is disabled")
		return
	}

	log.Printf("Starting config sync (interval: %v)", s.config.Sync.Interval)

	go func() {
		// Check immediately on start
		if err := s.CheckForUpdates(); err != nil {
			log.Printf("Error checking for config updates: %v", err)
		}

		ticker := time.NewTicker(s.config.Sync.Interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if err := s.CheckForUpdates(); err != nil {
					log.Printf("Error checking for config updates: %v", err)
				}
			case <-s.stopCh:
				return
			}
		}
	}()
}

// Stop stops the config sync
func (s *Syncer) Stop() {
	close(s.stopCh)
}

// CheckForUpdates checks for configuration updates from the server
func (s *Syncer) CheckForUpdates() error {
	// Build sync URL from ingestion URL if not provided
	syncURL := s.config.Sync.URL
	if syncURL == "" && s.config.Ingestion.URL != "" {
		syncURL = s.config.Ingestion.URL + "/api/v1/agent/config"
	}

	if syncURL == "" {
		return nil // No sync URL configured
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", syncURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	if s.jwtToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.jwtToken)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotModified {
		// No updates available
		return nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("config sync failed: %s - %s", resp.Status, string(body))
	}

	var update ConfigUpdate
	if err := json.NewDecoder(resp.Body).Decode(&update); err != nil {
		return fmt.Errorf("failed to parse update: %w", err)
	}

	log.Printf("Config update available (version: %d, updated: %s)", update.Version, update.UpdatedAt)

	// Apply update
	if err := s.ApplyUpdate(&update); err != nil {
		return fmt.Errorf("failed to apply update: %w", err)
	}

	return nil
}

// ApplyUpdate applies a configuration update
func (s *Syncer) ApplyUpdate(update *ConfigUpdate) error {
	if !s.config.Sync.AutoApply {
		log.Printf("Config update available but auto-apply is disabled. Manual restart required.")
		// Save the update for manual review
		return s.saveUpdateForReview(update)
	}

	// Backup current config
	if s.config.Sync.BackupConfigs {
		if err := s.backupConfig(); err != nil {
			log.Printf("Warning: failed to backup config: %v", err)
		}
	}

	// Apply changes
	if update.FullConfig != nil {
		// Full config replacement
		if err := config.SaveConfig(update.FullConfig, s.configPath); err != nil {
			return fmt.Errorf("failed to save new config: %w", err)
		}
		log.Println("Full config updated. Restart required to apply changes.")
	} else if update.Changes != nil {
		// Partial update
		if err := s.applyPartialUpdate(update.Changes); err != nil {
			return fmt.Errorf("failed to apply partial update: %w", err)
		}
		log.Println("Config updated. Restart required to apply changes.")
	}

	return nil
}

// applyPartialUpdate applies partial configuration changes
func (s *Syncer) applyPartialUpdate(changes map[string]interface{}) error {
	// Apply changes to current config
	// This is a simplified implementation - in production you'd want more sophisticated merging

	// For now, just save the changes to a pending file
	pendingPath := s.configPath + ".pending"

	// Load current config
	currentConfig, err := config.LoadConfig(s.configPath)
	if err != nil {
		return fmt.Errorf("failed to load current config: %w", err)
	}

	// Apply changes (simplified)
	if val, ok := changes["collection.enabled"]; ok {
		if enabled, ok := val.(bool); ok {
			currentConfig.Collection.Enabled = enabled
		}
	}
	if val, ok := changes["collection.interval"]; ok {
		if interval, ok := val.(string); ok {
			if duration, err := time.ParseDuration(interval); err == nil {
				currentConfig.Collection.Interval = duration
			}
		}
	}
	if val, ok := changes["log_level"]; ok {
		if level, ok := val.(string); ok {
			currentConfig.Agent.LogLevel = level
		}
	}

	// Save updated config
	if err := config.SaveConfig(currentConfig, pendingPath); err != nil {
		return fmt.Errorf("failed to save pending config: %w", err)
	}

	// Replace current config with pending
	if err := os.Rename(pendingPath, s.configPath); err != nil {
		return fmt.Errorf("failed to replace config: %w", err)
	}

	return nil
}

// backupConfig creates a backup of the current configuration
func (s *Syncer) backupConfig() error {
	timestamp := time.Now().Format("20060102-150405")
	backupDir := filepath.Dir(s.configPath) + "/backups"

	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return fmt.Errorf("failed to create backup directory: %w", err)
	}

	backupPath := filepath.Join(backupDir, fmt.Sprintf("agent.%s.yaml", timestamp))

	input, err := os.ReadFile(s.configPath)
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	if err := os.WriteFile(backupPath, input, 0644); err != nil {
		return fmt.Errorf("failed to write backup: %w", err)
	}

	log.Printf("Config backed up to: %s", backupPath)

	// Clean old backups (keep last 10)
	s.cleanOldBackups(backupDir, 10)

	return nil
}

// cleanOldBackups removes old backup files
func (s *Syncer) cleanOldBackups(dir string, keep int) {
	files, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	if len(files) <= keep {
		return
	}

	// Remove oldest files
	for i := 0; i < len(files)-keep; i++ {
		path := filepath.Join(dir, files[i].Name())
		os.Remove(path)
	}
}

// saveUpdateForReview saves an update for manual review
func (s *Syncer) saveUpdateForReview(update *ConfigUpdate) error {
	reviewPath := s.configPath + ".review"

	data, err := json.MarshalIndent(update, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal update: %w", err)
	}

	if err := os.WriteFile(reviewPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write review file: %w", err)
	}

	log.Printf("Config update saved for review: %s", reviewPath)
	return nil
}

// UpdateToken updates the JWT token
func (s *Syncer) UpdateToken(token string) {
	s.jwtToken = token
}
