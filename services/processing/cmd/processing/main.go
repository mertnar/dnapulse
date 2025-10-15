package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	eventv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/event/v1"
	"github.com/dnasol/dna-platform/services/processing/pkg/rules"
	"github.com/segmentio/kafka-go"
	"google.golang.org/protobuf/proto"
)

func main() {
	// Configuration from environment
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	inputTopic := getEnv("KAFKA_INPUT_TOPIC", "ingestion.raw.v1")
	outputTopic := getEnv("KAFKA_OUTPUT_TOPIC", "processing.cleaned.v1")
	groupID := getEnv("KAFKA_GROUP_ID", "processing-service")
	configURL := getEnv("CONFIG_URL", "http://config:8080")
	configScope := getEnv("CONFIG_SCOPE", "processing")
	httpPort := getEnv("HTTP_PORT", "8080")

	// Initialize rule engine
	ruleEngine := rules.NewRuleEngine(configURL, configScope)
	log.Printf("Rule engine initialized")

	// Load initial rules
	ctx := context.Background()
	if err := ruleEngine.LoadRules(ctx); err != nil {
		log.Printf("Warning: Failed to load initial rules: %v", err)
		log.Printf("Using empty rules configuration")
	}

	log.Printf("Processing service starting...")
	log.Printf("Kafka brokers: %s", kafkaBrokers)
	log.Printf("Input topic: %s", inputTopic)
	log.Printf("Output topic: %s", outputTopic)
	log.Printf("Consumer group: %s", groupID)
	log.Printf("Config URL: %s", configURL)
	log.Printf("Config scope: %s", configScope)
	log.Printf("HTTP port: %s", httpPort)
	log.Printf("Format: protobuf")

	// Start HTTP server
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("# Processing service metrics\nprocessing_events_processed_total 0\n"))
	})

	server := &http.Server{
		Addr:    ":" + httpPort,
		Handler: mux,
	}

	go func() {
		log.Printf("HTTP server starting on port %s", httpPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("HTTP server error: %v", err)
		}
	}()

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

	// Start hot reload in background
	go func() {
		log.Printf("Starting rules hot reload...")
		if err := ruleEngine.StartHotReload(ctx); err != nil {
			log.Printf("Rules hot reload error: %v", err)
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutdown signal received, stopping...")
		cancel()

		// Shutdown HTTP server
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("HTTP server shutdown error: %v", err)
		}
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
			if err := processMessage(ctx, msg, writer, ruleEngine); err != nil {
				log.Printf("Error processing message: %v", err)
				continue
			}
		}
	}
}

func processMessage(ctx context.Context, msg kafka.Message, writer *kafka.Writer, ruleEngine *rules.RuleEngine) error {
	// Parse protobuf event
	var rawEvent eventv1.Event
	if err := proto.Unmarshal(msg.Value, &rawEvent); err != nil {
		log.Printf("Failed to unmarshal protobuf: %v", err)
		return err
	}

	log.Printf("Processing event (protobuf): %s", rawEvent.EventId)

	// Apply processing rules
	processedEvent, err := ruleEngine.ProcessEvent(ctx, &rawEvent)
	if err != nil {
		log.Printf("Failed to process event with rules: %v", err)
		return err
	}

	// Apply legacy normalization (for backward compatibility)
	enrichedEvent := normalizeEvent(processedEvent)

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
