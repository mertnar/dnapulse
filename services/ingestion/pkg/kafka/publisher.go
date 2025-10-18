package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/segmentio/kafka-go"
)

// EventPublisher handles publishing events to Kafka
type EventPublisher struct {
	writer *kafka.Writer
}

// NewEventPublisher creates a new Kafka event publisher
func NewEventPublisher(brokers []string, topic string) *EventPublisher {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
		BatchSize:    100,
	}

	return &EventPublisher{
		writer: writer,
	}
}

// ServiceEvent represents a service event to be published
type ServiceEvent struct {
	EventID    string                 `json:"event_id"`
	Service    string                 `json:"service"`
	EventType  string                 `json:"event_type"`
	Timestamp  time.Time              `json:"timestamp"`
	Source     interface{}            `json:"source,omitempty"`
	Payload    map[string]interface{} `json:"payload,omitempty"`
	Attributes map[string]interface{} `json:"attributes,omitempty"`
	Status     string                 `json:"status"`
	Duration   int64                  `json:"duration_ms,omitempty"`
	Error      string                 `json:"error,omitempty"`
}

// PublishEvent publishes a service event to Kafka
func (p *EventPublisher) PublishEvent(ctx context.Context, event *ServiceEvent) error {
	event.Timestamp = time.Now()

	// Marshal to JSON
	jsonData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Create Kafka message
	message := kafka.Message{
		Key:   []byte(event.EventID),
		Value: jsonData,
		Time:  time.Now(),
	}

	// Send message
	err = p.writer.WriteMessages(ctx, message)
	if err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	return nil
}

// PublishIngestionEvent publishes an ingestion event
func (p *EventPublisher) PublishIngestionEvent(ctx context.Context, eventID, source string, payload map[string]interface{}, status string, duration int64, err error) error {
	event := &ServiceEvent{
		EventID:   eventID,
		Service:   "ingestion",
		EventType: "ingestion",
		Source:    source,
		Payload:   payload,
		Status:    status,
		Duration:  duration,
	}

	if err != nil {
		event.Status = "error"
		event.Error = err.Error()
	}

	return p.PublishEvent(ctx, event)
}

// PublishConfigUpdateEvent publishes a configuration update event
func (p *EventPublisher) PublishConfigUpdateEvent(ctx context.Context, scope, etag string) error {
	event := &ServiceEvent{
		EventID:   fmt.Sprintf("config_%s_%s", scope, etag),
		Service:   "ingestion",
		EventType: "config_update",
		Attributes: map[string]interface{}{
			"scope": scope,
			"etag":  etag,
		},
		Status: "success",
	}

	return p.PublishEvent(ctx, event)
}

// PublishHealthCheckEvent publishes a health check event
func (p *EventPublisher) PublishHealthCheckEvent(ctx context.Context, status string, duration int64) error {
	event := &ServiceEvent{
		EventID:   fmt.Sprintf("health_%d", time.Now().Unix()),
		Service:   "ingestion",
		EventType: "health_check",
		Status:    status,
		Duration:  duration,
	}

	return p.PublishEvent(ctx, event)
}

// Close closes the Kafka writer
func (p *EventPublisher) Close() error {
	return p.writer.Close()
}
