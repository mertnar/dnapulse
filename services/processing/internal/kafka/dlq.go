package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

// DLQMessage represents a dead letter queue message
type DLQMessage struct {
	OriginalEvent *model.Event `json:"original_event"`
	Reason        string       `json:"reason"`
	Timestamp     time.Time    `json:"timestamp"`
	Retries       int          `json:"retries"`
}

// DLQPublisher publishes failed events to dead letter queue
type DLQPublisher struct {
	writer *kafka.Writer
	logger *zap.Logger
}

// NewDLQPublisher creates a new DLQ publisher
func NewDLQPublisher(brokers []string, topic string, logger *zap.Logger) *DLQPublisher {
	if logger == nil {
		logger = zap.NewNop()
	}

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireOne,
	}

	return &DLQPublisher{
		writer: writer,
		logger: logger,
	}
}

// Publish publishes an event to the DLQ
func (d *DLQPublisher) Publish(ctx context.Context, event *model.Event, reason string) error {
	dlqMsg := DLQMessage{
		OriginalEvent: event,
		Reason:        reason,
		Timestamp:     time.Now(),
		Retries:       0,
	}

	value, err := json.Marshal(dlqMsg)
	if err != nil {
		return fmt.Errorf("failed to encode DLQ message: %w", err)
	}

	msg := kafka.Message{
		Key:   []byte(event.EventID),
		Value: value,
		Headers: []kafka.Header{
			{Key: "dlq_reason", Value: []byte(reason)},
			{Key: "dlq_timestamp", Value: []byte(time.Now().Format(time.RFC3339))},
		},
	}

	if err := d.writer.WriteMessages(ctx, msg); err != nil {
		d.logger.Error("failed to publish to DLQ",
			zap.String("event_id", event.EventID),
			zap.Error(err),
		)
		return fmt.Errorf("failed to publish to DLQ: %w", err)
	}

	d.logger.Info("published to DLQ",
		zap.String("event_id", event.EventID),
		zap.String("reason", reason),
	)

	return nil
}

// Close closes the DLQ publisher
func (d *DLQPublisher) Close() error {
	return d.writer.Close()
}
