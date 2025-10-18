package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// EventLog represents a log event to be sent to Elasticsearch
type EventLog struct {
	Timestamp  time.Time              `json:"@timestamp"`
	Service    string                 `json:"service"`
	EventType  string                 `json:"event_type"`
	EventID    string                 `json:"event_id"`
	Level      string                 `json:"level"`
	Message    string                 `json:"message"`
	Source     interface{}            `json:"source,omitempty"`
	Payload    map[string]interface{} `json:"payload,omitempty"`
	Attributes map[string]interface{} `json:"attributes,omitempty"`
	Duration   int64                  `json:"duration_ms,omitempty"`
	Status     string                 `json:"status,omitempty"`
	Error      string                 `json:"error,omitempty"`
}

// Logger handles Elasticsearch logging for ingestion service
type Logger struct {
	client      *http.Client
	baseURL     string
	index       string
	serviceName string
}

// NewLogger creates a new Elasticsearch logger
func NewLogger(elasticsearchURL, index, serviceName string) *Logger {
	return &Logger{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		baseURL:     elasticsearchURL,
		index:       index,
		serviceName: serviceName,
	}
}

// LogEvent sends an event log to Elasticsearch
func (l *Logger) LogEvent(ctx context.Context, event *EventLog) error {
	event.Timestamp = time.Now()
	event.Service = l.serviceName

	// Create the document
	doc := map[string]interface{}{
		"@timestamp": event.Timestamp,
		"service":    event.Service,
		"event_type": event.EventType,
		"event_id":   event.EventID,
		"level":      event.Level,
		"message":    event.Message,
	}

	if event.Source != nil {
		doc["source"] = event.Source
	}
	if event.Payload != nil {
		doc["payload"] = event.Payload
	}
	if event.Attributes != nil {
		doc["attributes"] = event.Attributes
	}
	if event.Duration > 0 {
		doc["duration_ms"] = event.Duration
	}
	if event.Status != "" {
		doc["status"] = event.Status
	}
	if event.Error != "" {
		doc["error"] = event.Error
	}

	// Marshal to JSON
	jsonData, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Send to Elasticsearch
	url := fmt.Sprintf("%s/%s/_doc", l.baseURL, l.index)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := l.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("elasticsearch returned status %d", resp.StatusCode)
	}

	return nil
}

// LogIngestionEvent logs an ingestion event
func (l *Logger) LogIngestionEvent(ctx context.Context, eventID, source string, payload map[string]interface{}, status string, duration int64, err error) error {
	event := &EventLog{
		EventType: "ingestion",
		EventID:   eventID,
		Level:     "info",
		Message:   fmt.Sprintf("Event ingested: %s", eventID),
		Source:    source,
		Payload:   payload,
		Status:    status,
		Duration:  duration,
	}

	if err != nil {
		event.Level = "error"
		event.Message = fmt.Sprintf("Failed to ingest event %s: %v", eventID, err)
		event.Error = err.Error()
		event.Status = "error"
	}

	return l.LogEvent(ctx, event)
}

// LogConfigUpdate logs a configuration update event
func (l *Logger) LogConfigUpdate(ctx context.Context, scope, etag string) error {
	event := &EventLog{
		EventType: "config_update",
		EventID:   fmt.Sprintf("config_%s_%s", scope, etag),
		Level:     "info",
		Message:   fmt.Sprintf("Configuration updated for scope: %s", scope),
		Attributes: map[string]interface{}{
			"scope": scope,
			"etag":  etag,
		},
		Status: "success",
	}

	return l.LogEvent(ctx, event)
}

// LogHealthCheck logs a health check event
func (l *Logger) LogHealthCheck(ctx context.Context, status string, duration int64) error {
	event := &EventLog{
		EventType: "health_check",
		EventID:   fmt.Sprintf("health_%d", time.Now().Unix()),
		Level:     "info",
		Message:   fmt.Sprintf("Health check: %s", status),
		Status:    status,
		Duration:  duration,
	}

	return l.LogEvent(ctx, event)
}
