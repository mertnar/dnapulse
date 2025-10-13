package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	eventv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/event/v1"
	"github.com/segmentio/kafka-go"
	"google.golang.org/protobuf/proto"
)

func main() {
	// Configuration from environment
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	inputTopic := getEnv("KAFKA_INPUT_TOPIC", "ingestion.raw.v1")
	outputTopic := getEnv("KAFKA_OUTPUT_TOPIC", "processing.cleaned.v1")
	groupID := getEnv("KAFKA_GROUP_ID", "processing-service")

	log.Printf("Processing service starting...")
	log.Printf("Kafka brokers: %s", kafkaBrokers)
	log.Printf("Input topic: %s", inputTopic)
	log.Printf("Output topic: %s", outputTopic)
	log.Printf("Consumer group: %s", groupID)
	log.Printf("Format: protobuf")

	// Create Kafka reader (consumer)
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        strings.Split(kafkaBrokers, ","),
		Topic:          inputTopic,
		GroupID:        groupID,
		MinBytes:       1,
		MaxBytes:       10e6, // 10MB
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})
	defer reader.Close()

	// Create Kafka writer (producer)
	writer := &kafka.Writer{
		Addr:         kafka.TCP(kafkaBrokers),
		Topic:        outputTopic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireOne,
		Async:        false,
	}
	defer writer.Close()

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutdown signal received, stopping...")
		cancel()
	}()

	log.Println("Processing service ready, waiting for messages...")

	// Main processing loop
	for {
		select {
		case <-ctx.Done():
			log.Println("Context cancelled, exiting...")
			return
		default:
			// Read message with timeout
			readCtx, readCancel := context.WithTimeout(ctx, 5*time.Second)
			msg, err := reader.ReadMessage(readCtx)
			readCancel()

			if err != nil {
				if err == context.DeadlineExceeded || err == context.Canceled {
					continue
				}
				log.Printf("Error reading message: %v", err)
				continue
			}

			// Process the message
			if err := processMessage(ctx, msg, writer); err != nil {
				log.Printf("Error processing message: %v", err)
				continue
			}
		}
	}
}

func processMessage(ctx context.Context, msg kafka.Message, writer *kafka.Writer) error {
	// Parse protobuf event
	var rawEvent eventv1.Event
	if err := proto.Unmarshal(msg.Value, &rawEvent); err != nil {
		log.Printf("Failed to unmarshal protobuf: %v", err)
		return err
	}

	log.Printf("Processing event (protobuf): %s", rawEvent.EventId)

	// Normalize and enrich the event
	enrichedEvent := normalizeEvent(&rawEvent)

	// Serialize enriched event
	enrichedBytes, err := proto.Marshal(enrichedEvent)
	if err != nil {
		log.Printf("Failed to marshal enriched event: %v", err)
		return err
	}

	// Write to output topic
	outputMsg := kafka.Message{
		Key:   []byte(enrichedEvent.EventId),
		Value: enrichedBytes,
		Time:  time.Now(),
	}

	writeCtx, writeCancel := context.WithTimeout(ctx, 10*time.Second)
	defer writeCancel()

	if err := writer.WriteMessages(writeCtx, outputMsg); err != nil {
		log.Printf("Failed to write to Kafka: %v", err)
		return err
	}

	severity := enrichedEvent.Attributes["severity"]
	if metric := enrichedEvent.GetMetric(); metric != nil {
		log.Printf("Event processed: %s - %s=%.2f [%s]",
			enrichedEvent.EventId, metric.Name, metric.Value, severity)
	}

	return nil
}

// normalizeEvent enriches the event with severity and validation
func normalizeEvent(event *eventv1.Event) *eventv1.Event {
	// Create a copy of the event
	enriched := &eventv1.Event{
		EventId: event.EventId,
		Source:  event.Source,
		Type:    event.Type,
		Ts:      event.Ts,
		Body:    event.Body,
	}

	// Copy attributes
	if event.Attributes != nil {
		enriched.Attributes = make(map[string]string)
		for k, v := range event.Attributes {
			enriched.Attributes[k] = v
		}
	} else {
		enriched.Attributes = make(map[string]string)
	}

	// Add processing timestamp
	enriched.Attributes["processed_at"] = time.Now().Format(time.RFC3339)

	// Determine severity based on metric
	if metric := enriched.GetMetric(); metric != nil {
		enriched.Attributes["is_valid"] = "true"
		enriched.Attributes["severity"] = determineSeverity(metric.Name, metric.Value)
	} else {
		enriched.Attributes["is_valid"] = "false"
		enriched.Attributes["severity"] = "info"
	}

	return enriched
}

// determineSeverity calculates severity based on metric name and value
func determineSeverity(metricName string, value float64) string {
	nameLower := strings.ToLower(metricName)

	switch {
	case strings.Contains(nameLower, "cpu") && value > 90:
		return "critical"
	case strings.Contains(nameLower, "cpu") && value > 75:
		return "warning"
	case strings.Contains(nameLower, "memory") && value > 90:
		return "critical"
	case strings.Contains(nameLower, "memory") && value > 80:
		return "warning"
	case strings.Contains(nameLower, "disk") && value > 85:
		return "critical"
	case strings.Contains(nameLower, "disk") && value > 70:
		return "warning"
	default:
		return "info"
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
