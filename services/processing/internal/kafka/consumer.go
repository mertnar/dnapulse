package kafka

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

// ConsumerConfig holds Kafka consumer configuration
type ConsumerConfig struct {
	Brokers []string
	Topic   string
	GroupID string
	Logger  *zap.Logger
}

// Consumer wraps kafka-go reader
type Consumer struct {
	reader *kafka.Reader
	logger *zap.Logger
}

// NewConsumer creates a new Kafka consumer
func NewConsumer(cfg ConsumerConfig) *Consumer {
	if cfg.Logger == nil {
		cfg.Logger = zap.NewNop()
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  cfg.Brokers,
		Topic:    cfg.Topic,
		GroupID:  cfg.GroupID,
		MinBytes: 1,
		MaxBytes: 10e6, // 10MB
	})

	return &Consumer{
		reader: reader,
		logger: cfg.Logger,
	}
}

// ReadEvent reads and decodes an event from Kafka
func (c *Consumer) ReadEvent(ctx context.Context) (*model.Event, kafka.Message, error) {
	msg, err := c.reader.ReadMessage(ctx)
	if err != nil {
		return nil, kafka.Message{}, fmt.Errorf("failed to read message: %w", err)
	}

	// Decode event (JSON for now)
	var event model.Event
	if err := json.Unmarshal(msg.Value, &event); err != nil {
		return nil, msg, fmt.Errorf("failed to decode event: %w", err)
	}

	return &event, msg, nil
}

// Close closes the consumer
func (c *Consumer) Close() error {
	return c.reader.Close()
}
