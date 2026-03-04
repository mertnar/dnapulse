package sender

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/dnasol/dna-platform/agents/dnapulse-agent/pkg/config"
)

// Sender handles communication with the ingestion service
type Sender struct {
	config    *config.Config
	client    *http.Client
	jwtToken  string
	agentID   string
	dsID      string
	mu        sync.RWMutex

	eventBuffer []map[string]interface{}
	bufferMu    sync.Mutex
	stopCh      chan struct{}
}

// RegisterResponse represents the registration response
type RegisterResponse struct {
	AgentID       string                 `json:"agent_id"`
	AgentTypeID   string                 `json:"agent_type_id"`
	DataSourceID  string                 `json:"data_source_id"`
	JWTToken      string                 `json:"jwt_token"`
	ExpiresIn     int                    `json:"expires_in"`
	Config        map[string]interface{} `json:"config"`
	ConfigVersion int                    `json:"config_version"`
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Acknowledged bool `json:"acknowledged"`
	NextCheckIn  int  `json:"next_check_in"`
}

// PulseResponse represents the pulse response
type PulseResponse struct {
	Accepted int      `json:"accepted"`
	Rejected int      `json:"rejected"`
	Errors   []string `json:"errors,omitempty"`
}

// NewSender creates a new sender instance
func NewSender(cfg *config.Config) *Sender {
	return &Sender{
		config: cfg,
		client: &http.Client{
			Timeout: cfg.Ingestion.Timeout,
		},
		eventBuffer: make([]map[string]interface{}, 0, cfg.Ingestion.BatchSize),
		stopCh:      make(chan struct{}),
	}
}

// Register registers the agent with the ingestion service
// Returns the RegisterResponse which includes config and configVersion
// Note: Schema discovery will happen automatically when agent sends first data via Pulse
func (s *Sender) Register(ctx context.Context) (*RegisterResponse, error) {
	reqBody := map[string]interface{}{
		"api_key":       s.config.Ingestion.APIKey,
		"agent_name":    s.config.Agent.Name,
		"agent_type":    s.config.Agent.Type,
		"agent_type_id": s.config.Agent.TypeID,
		"version":       s.config.Agent.Version,
		"platform":      s.config.Agent.Platform,
		"hostname":      s.config.Agent.Hostname,
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := s.config.Ingestion.URL + "/api/v1/register"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", s.config.Ingestion.APIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registration failed: %s - %s", resp.Status, string(body))
	}

	var regResp RegisterResponse
	if err := json.Unmarshal(body, &regResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	s.mu.Lock()
	s.jwtToken = regResp.JWTToken
	s.agentID = regResp.AgentID
	s.dsID = regResp.DataSourceID
	s.mu.Unlock()

	// Update config with IDs
	s.config.Metadata.DataSourceID = regResp.DataSourceID

	log.Printf("Agent registered successfully: AgentID=%s, DataSourceID=%s, ConfigVersion=%d",
		regResp.AgentID, regResp.DataSourceID, regResp.ConfigVersion)

	return &regResp, nil
}

// SendHealthCheck sends a health check to the ingestion service
func (s *Sender) SendHealthCheck(ctx context.Context) error {
	s.mu.RLock()
	token := s.jwtToken
	s.mu.RUnlock()

	if token == "" {
		return fmt.Errorf("not registered - no JWT token")
	}

	reqBody := map[string]interface{}{
		"status": "online",
		"metrics": map[string]interface{}{
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		},
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	url := s.config.Ingestion.URL + "/api/v1/agent/health"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("health check failed: %s - %s", resp.Status, string(body))
	}

	return nil
}

// BufferEvent adds an event to the buffer
func (s *Sender) BufferEvent(event map[string]interface{}) {
	s.bufferMu.Lock()
	defer s.bufferMu.Unlock()

	// Add metadata to event
	if s.config.Metadata.Tags != nil {
		for k, v := range s.config.Metadata.Tags {
			event[k] = v
		}
	}
	if s.config.Metadata.CustomFields != nil {
		for k, v := range s.config.Metadata.CustomFields {
			event[k] = v
		}
	}
	event["agent_environment"] = s.config.Metadata.Environment
	event["agent_region"] = s.config.Metadata.Region

	s.eventBuffer = append(s.eventBuffer, event)

	// Auto-flush if batch size reached
	if len(s.eventBuffer) >= s.config.Ingestion.BatchSize {
		go s.Flush(context.Background())
	}
}

// Flush sends buffered events to the ingestion service
func (s *Sender) Flush(ctx context.Context) error {
	s.bufferMu.Lock()
	if len(s.eventBuffer) == 0 {
		s.bufferMu.Unlock()
		return nil
	}

	events := make([]map[string]interface{}, len(s.eventBuffer))
	copy(events, s.eventBuffer)
	s.eventBuffer = s.eventBuffer[:0]
	s.bufferMu.Unlock()

	s.mu.RLock()
	token := s.jwtToken
	s.mu.RUnlock()

	if token == "" {
		return fmt.Errorf("not registered - no JWT token")
	}

	reqBody := map[string]interface{}{
		"events": events,
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	url := s.config.Ingestion.URL + "/api/v1/pulse"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("pulse failed: %s - %s", resp.Status, string(body))
	}

	var pulseResp PulseResponse
	if err := json.Unmarshal(body, &pulseResp); err != nil {
		log.Printf("Warning: failed to parse pulse response: %v", err)
	} else {
		log.Printf("Pulse sent: %d accepted, %d rejected", pulseResp.Accepted, pulseResp.Rejected)
		if len(pulseResp.Errors) > 0 {
			log.Printf("Pulse errors: %v", pulseResp.Errors)
		}
	}

	return nil
}

// Start starts the periodic flush
func (s *Sender) Start() {
	go func() {
		ticker := time.NewTicker(s.config.Ingestion.FlushInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if err := s.Flush(context.Background()); err != nil {
					log.Printf("Error flushing events: %v", err)
				}
			case <-s.stopCh:
				// Final flush
				if err := s.Flush(context.Background()); err != nil {
					log.Printf("Error in final flush: %v", err)
				}
				return
			}
		}
	}()
}

// Stop stops the sender
func (s *Sender) Stop() {
	close(s.stopCh)
}

// GetAgentID returns the agent ID
func (s *Sender) GetAgentID() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.agentID
}

// GetDataSourceID returns the data source ID
func (s *Sender) GetDataSourceID() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.dsID
}

// GetJWTToken returns the JWT token
func (s *Sender) GetJWTToken() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.jwtToken
}

// SetJWTToken sets the JWT token
func (s *Sender) SetJWTToken(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jwtToken = token
}

// SetAgentID sets the agent ID
func (s *Sender) SetAgentID(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.agentID = id
}

// SetDataSourceID sets the data source ID
func (s *Sender) SetDataSourceID(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dsID = id
}
