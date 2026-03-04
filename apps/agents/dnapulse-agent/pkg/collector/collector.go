package collector

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/dnasol/dna-platform/agents/dnapulse-agent/pkg/config"
)

// Collector handles data collection from various sources
type Collector struct {
	config        *config.Config
	stopCh        chan struct{}
	wg            sync.WaitGroup
	eventCh       chan<- map[string]interface{}
	lastPositions map[string]int64 // Track file read positions
	mu            sync.Mutex
}

// NewCollector creates a new collector instance
func NewCollector(cfg *config.Config, eventCh chan<- map[string]interface{}) *Collector {
	return &Collector{
		config:        cfg,
		stopCh:        make(chan struct{}),
		eventCh:       eventCh,
		lastPositions: make(map[string]int64),
	}
}

// Start starts the data collection
func (c *Collector) Start() {
	if !c.config.Collection.Enabled {
		log.Println("Data collection is disabled")
		return
	}

	log.Printf("Starting data collection with %d sources", len(c.config.Collection.Sources))

	// Start collectors for each source
	for _, source := range c.config.Collection.Sources {
		if !source.Enabled {
			continue
		}

		c.wg.Add(1)
		go c.collectFromSource(source)
	}

	log.Println("Data collection started")
}

// Stop stops the data collection
func (c *Collector) Stop() {
	log.Println("Stopping data collection...")
	close(c.stopCh)
	c.wg.Wait()
	log.Println("Data collection stopped")
}

// collectFromSource collects data from a specific source
func (c *Collector) collectFromSource(source config.SourceConfig) {
	defer c.wg.Done()

	ticker := time.NewTicker(c.config.Collection.Interval)
	defer ticker.Stop()

	log.Printf("Starting collection from %s source: %s", source.Type, c.getSourceIdentifier(source))

	for {
		select {
		case <-ticker.C:
			if err := c.collect(source); err != nil {
				log.Printf("Error collecting from %s: %v", c.getSourceIdentifier(source), err)
			}
		case <-c.stopCh:
			return
		}
	}
}

// collect performs the actual data collection
func (c *Collector) collect(source config.SourceConfig) error {
	switch source.Type {
	case "file":
		return c.collectFromFile(source)
	case "command":
		return c.collectFromCommand(source)
	case "api":
		return c.collectFromAPI(source)
	case "system_resources", "system_metrics":
		return c.collectSystemResources(source)
	default:
		return fmt.Errorf("unsupported source type: %s", source.Type)
	}
}

// collectFromFile reads new lines from a file
func (c *Collector) collectFromFile(source config.SourceConfig) error {
	if source.Path == "" {
		return fmt.Errorf("file path is required")
	}

	file, err := os.Open(source.Path)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	// Get file info
	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat file: %w", err)
	}

	// Check last position
	c.mu.Lock()
	lastPos := c.lastPositions[source.Path]
	c.mu.Unlock()

	// If file was rotated (smaller than last position), start from beginning
	if fileInfo.Size() < lastPos {
		lastPos = 0
	}

	// Seek to last position
	if _, err := file.Seek(lastPos, 0); err != nil {
		return fmt.Errorf("failed to seek file: %w", err)
	}

	// Read new lines
	scanner := bufio.NewScanner(file)
	count := 0
	maxLines := 1000 // Limit lines per collection cycle

	for scanner.Scan() && count < maxLines {
		line := scanner.Text()
		if line == "" {
			continue
		}

		// Apply filter if specified
		if source.Filter != "" && !strings.Contains(line, source.Filter) {
			continue
		}

		// Create event
		event := map[string]interface{}{
			"timestamp":   time.Now().UTC().Format(time.RFC3339),
			"source_type": "file",
			"source_path": source.Path,
			"message":     line,
		}

		// Add source fields
		for k, v := range source.Fields {
			event[k] = v
		}

		// Try to parse as JSON if it looks like JSON
		if strings.HasPrefix(line, "{") {
			var jsonData map[string]interface{}
			if err := json.Unmarshal([]byte(line), &jsonData); err == nil {
				for k, v := range jsonData {
					event[k] = v
				}
			}
		}

		// Send event
		select {
		case c.eventCh <- event:
			count++
		case <-c.stopCh:
			return nil
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading file: %w", err)
	}

	// Update last position
	newPos, _ := file.Seek(0, 1) // Get current position
	c.mu.Lock()
	c.lastPositions[source.Path] = newPos
	c.mu.Unlock()

	if count > 0 {
		log.Printf("Collected %d events from %s", count, source.Path)
	}

	return nil
}

// collectFromCommand executes a command and collects output
func (c *Collector) collectFromCommand(source config.SourceConfig) error {
	if source.Command == "" {
		return fmt.Errorf("command is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Split command into parts
	parts := strings.Fields(source.Command)
	if len(parts) == 0 {
		return fmt.Errorf("invalid command")
	}

	cmd := exec.CommandContext(ctx, parts[0], parts[1:]...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("command failed: %w", err)
	}

	// Create event
	event := map[string]interface{}{
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"source_type": "command",
		"command":     source.Command,
		"output":      string(output),
		"exit_code":   0,
	}

	// Add source fields
	for k, v := range source.Fields {
		event[k] = v
	}

	// Send event
	select {
	case c.eventCh <- event:
		log.Printf("Collected command output from: %s", source.Command)
	case <-c.stopCh:
		return nil
	}

	return nil
}

// collectFromAPI collects data from an API endpoint
func (c *Collector) collectFromAPI(source config.SourceConfig) error {
	// TODO: Implement API collection
	return fmt.Errorf("API collection not yet implemented")
}

// getSourceIdentifier returns a human-readable identifier for the source
func (c *Collector) getSourceIdentifier(source config.SourceConfig) string {
	switch source.Type {
	case "file":
		return source.Path
	case "command":
		return source.Command
	case "api":
		return source.Path
	default:
		return source.Type
	}
}

// GenerateSampleData generates sample data for registration
func GenerateSampleData(cfg *config.Config) []map[string]interface{} {
	samples := make([]map[string]interface{}, 0, 5)

	// Generate sample events based on agent type
	switch cfg.Agent.Type {
	case "syslog":
		samples = append(samples,
			map[string]interface{}{
				"timestamp": time.Now().UTC().Format(time.RFC3339),
				"level":     "info",
				"message":   "System started",
				"hostname":  cfg.Agent.Hostname,
				"service":   "system",
			},
			map[string]interface{}{
				"timestamp": time.Now().UTC().Format(time.RFC3339),
				"level":     "warn",
				"message":   "Disk space low",
				"hostname":  cfg.Agent.Hostname,
				"service":   "system",
				"disk":      "/dev/sda1",
			},
		)
	case "windows-event":
		samples = append(samples,
			map[string]interface{}{
				"timestamp": time.Now().UTC().Format(time.RFC3339),
				"event_id":  4624,
				"level":     "Information",
				"source":    "Security",
				"message":   "An account was successfully logged on",
			},
		)
	default:
		samples = append(samples,
			map[string]interface{}{
				"timestamp": time.Now().UTC().Format(time.RFC3339),
				"message":   "Sample event",
				"hostname":  cfg.Agent.Hostname,
			},
		)
	}

	// Add metadata to samples
	for _, sample := range samples {
		if cfg.Metadata.Tags != nil {
			for k, v := range cfg.Metadata.Tags {
				sample[k] = v
			}
		}
		sample["agent_type"] = cfg.Agent.Type
		sample["agent_version"] = cfg.Agent.Version
	}

	return samples
}

// collectSystemResources collects system metrics
func (c *Collector) collectSystemResources(source config.SourceConfig) error {
	metrics, err := CollectSystemMetrics()
	if err != nil {
		return fmt.Errorf("failed to collect system metrics: %w", err)
	}

	// Convert to event format
	event := map[string]interface{}{
		"event_type":     "system_metrics",
		"message":        fmt.Sprintf("System metrics: CPU=%.1f%%, Memory=%.1f%%, Disk count=%d", metrics.CPU.UsagePercent, metrics.Memory.UsagePercent, len(metrics.Disk)),
		"timestamp":      metrics.Timestamp.Format(time.RFC3339),
		"agent_type":     c.config.Agent.Type,
		"agent_version":  c.config.Agent.Version,
		"hostname":       c.config.Agent.Hostname,
		"cpu":            metrics.CPU,
		"memory":         metrics.Memory,
		"disk":           metrics.Disk,
		"load_average":   metrics.LoadAverage,
		"uptime_seconds": metrics.Uptime,
		"boot_time":      metrics.BootTime.Format(time.RFC3339),
		"top_processes":  metrics.TopProcesses,
	}

	if metrics.GPU != nil && metrics.GPU.Available {
		event["gpu"] = metrics.GPU
	}

	// Add source-specific fields
	for k, v := range source.Fields {
		event[k] = v
	}

	// Send to event channel
	select {
	case c.eventCh <- event:
	default:
		log.Println("Event channel full, dropping system metrics event")
	}

	log.Printf("Collected system metrics: CPU=%.1f%%, Mem=%.1f%%, Disk=%d partitions",
		metrics.CPU.UsagePercent,
		metrics.Memory.UsagePercent,
		len(metrics.Disk))

	return nil
}
