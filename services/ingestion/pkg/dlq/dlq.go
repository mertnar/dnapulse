package dlq

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type DLQProducer struct {
	writer *kafka.Writer
	tracer trace.Tracer
}

type DLQMessage struct {
	OriginalTopic     string    `json:"original_topic"`
	OriginalPartition int       `json:"original_partition"`
	OriginalOffset    int64     `json:"original_offset"`
	OriginalMessage   []byte    `json:"original_message"`
	Error             string    `json:"error"`
	Service           string    `json:"service"`
	Timestamp         time.Time `json:"timestamp"`
	TraceID           string    `json:"trace_id,omitempty"`
	SpanID            string    `json:"span_id,omitempty"`
}

func NewDLQProducer(brokers []string, serviceName string) (*DLQProducer, error) {
	writer := &kafka.Writer{
		Addr:      kafka.TCP(brokers...),
		Topic:     fmt.Sprintf("%s.deadletter.v1", serviceName),
		Balancer:  &kafka.LeastBytes{},
		BatchSize: 1, // Send immediately
	}

	return &DLQProducer{
		writer: writer,
		tracer: otel.Tracer("dlq-producer"),
	}, nil
}

func (p *DLQProducer) SendToDLQ(ctx context.Context, originalMsg kafka.Message, err error, serviceName string) error {
	ctx, span := p.tracer.Start(ctx, "dlq.send")
	defer span.End()

	// Extract trace context
	spanCtx := span.SpanContext()
	traceID := ""
	spanID := ""
	if spanCtx.IsValid() {
		traceID = spanCtx.TraceID().String()
		spanID = spanCtx.SpanID().String()
	}

	dlqMsg := DLQMessage{
		OriginalTopic:     originalMsg.Topic,
		OriginalPartition: originalMsg.Partition,
		OriginalOffset:    originalMsg.Offset,
		OriginalMessage:   originalMsg.Value,
		Error:             err.Error(),
		Service:           serviceName,
		Timestamp:         time.Now(),
		TraceID:           traceID,
		SpanID:            spanID,
	}

	// Serialize DLQ message as JSON
	dlqBytes, marshalErr := json.Marshal(dlqMsg)
	if marshalErr != nil {
		span.RecordError(marshalErr)
		span.SetStatus(codes.Error, "Failed to marshal DLQ message")
		return fmt.Errorf("failed to marshal DLQ message: %w", marshalErr)
	}

	// Send to DLQ topic
	kafkaMsg := kafka.Message{
		Key:   []byte(fmt.Sprintf("%s-%d-%d", originalMsg.Topic, originalMsg.Partition, originalMsg.Offset)),
		Value: dlqBytes,
		Time:  time.Now(),
		Headers: []kafka.Header{
			{Key: "original-topic", Value: []byte(originalMsg.Topic)},
			{Key: "service", Value: []byte(serviceName)},
			{Key: "error-type", Value: []byte("processing-failure")},
		},
	}

	if err := p.writer.WriteMessages(ctx, kafkaMsg); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to write DLQ message")
		return fmt.Errorf("failed to write DLQ message: %w", err)
	}

	span.SetAttributes(
		attribute.String("dlq.topic", p.writer.Topic),
		attribute.String("dlq.original_topic", originalMsg.Topic),
		attribute.String("dlq.service", serviceName),
		attribute.String("dlq.error", err.Error()),
	)
	span.SetStatus(codes.Ok, "DLQ message sent successfully")

	return nil
}

func (p *DLQProducer) Close() error {
	return p.writer.Close()
}

// DLQ Consumer for inspection
type DLQConsumer struct {
	reader *kafka.Reader
	tracer trace.Tracer
}

func NewDLQConsumer(brokers []string, topic string, groupID string) (*DLQConsumer, error) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokers,
		Topic:    topic,
		GroupID:  groupID,
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})

	return &DLQConsumer{
		reader: reader,
		tracer: otel.Tracer("dlq-consumer"),
	}, nil
}

func (c *DLQConsumer) ReadMessage(ctx context.Context) (*DLQMessage, kafka.Message, error) {
	ctx, span := c.tracer.Start(ctx, "dlq.read")
	defer span.End()

	msg, err := c.reader.ReadMessage(ctx)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to read DLQ message")
		return nil, kafka.Message{}, err
	}

	var dlqMsg DLQMessage
	if err := json.Unmarshal(msg.Value, &dlqMsg); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to unmarshal DLQ message")
		return nil, msg, fmt.Errorf("failed to unmarshal DLQ message: %w", err)
	}

	span.SetAttributes(
		attribute.String("dlq.topic", msg.Topic),
		attribute.String("dlq.original_topic", dlqMsg.OriginalTopic),
		attribute.String("dlq.service", dlqMsg.Service),
		attribute.String("dlq.error", dlqMsg.Error),
	)
	span.SetStatus(codes.Ok, "DLQ message read successfully")

	return &dlqMsg, msg, nil
}

func (c *DLQConsumer) Close() error {
	return c.reader.Close()
}
