package kafka

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

// ProducerConfig holds Kafka producer configuration
type ProducerConfig struct {
	Brokers []string
	Topic   string
	Logger  *zap.Logger
}

// Producer wraps kafka-go writer
type Producer struct {
	writer *kafka.Writer
	logger *zap.Logger
}

// NewProducer creates a new Kafka producer
func NewProducer(cfg ProducerConfig) *Producer {
	if cfg.Logger == nil {
		cfg.Logger = zap.NewNop()
	}

	writer := &kafka.Writer{
		Addr:         kafka.TCP(cfg.Brokers...),
		Topic:        cfg.Topic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireOne,
	}

	return &Producer{
		writer: writer,
		logger: cfg.Logger,
	}
}

// PublishEvent publishes an event to Kafka
func (p *Producer) PublishEvent(ctx context.Context, event *model.Event) error {
	// Encode event to JSON
	value, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to encode event: %w", err)
	}

	msg := kafka.Message{
		Key:   []byte(event.EventID),
		Value: value,
	}

	if err := p.writer.WriteMessages(ctx, msg); err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	return nil
}

// Close closes the producer
func (p *Producer) Close() error {
	return p.writer.Close()
}
