package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dnasol/dna-platform/services/correlation/pkg/config"
	"github.com/dnasol/dna-platform/services/correlation/pkg/correlation"
	"github.com/dnasol/dna-platform/services/correlation/pkg/metrics"
	"github.com/segmentio/kafka-go"
	"github.com/sirupsen/logrus"
)

var (
	configManager     *config.ConfigManager
	correlationEngine *correlation.CorrelationEngine
	metricsManager    *metrics.Metrics
)

func main() {
	logrus.SetLevel(logrus.InfoLevel)
	logrus.Info("Correlation service starting...")

	// Get configuration from environment
	busBroker := getEnv("BUS_BROKER", "localhost:9092")
	inputTopic := getEnv("INPUT_TOPIC", "categorization.labeled.v1")
	outputTopic := getEnv("OUTPUT_TOPIC", "correlation.grouped.v1")
	configURL := getEnv("CONFIG_URL", "http://localhost:8083")
	configScope := getEnv("CONFIG_SCOPE", "correlation")
	_ = getEnv("CONFIG_SSE_URL", "http://localhost:8083") // Currently not used
	port := getEnv("PORT", "8082")

	logrus.Infof("Configuration:")
	logrus.Infof("  Bus Broker: %s", busBroker)
	logrus.Infof("  Input Topic: %s", inputTopic)
	logrus.Infof("  Output Topic: %s", outputTopic)
	logrus.Infof("  Config URL: %s", configURL)
	logrus.Infof("  Config Scope: %s", configScope)

	// Initialize metrics
	metricsManager = metrics.NewMetrics()
	metricsManager.Register()

	// Initialize config manager
	configManager = config.NewConfigManager(configURL, configScope)

	// Load initial configuration
	if err := configManager.LoadConfig(); err != nil {
		logrus.Fatalf("Failed to load initial configuration: %v", err)
	}

	// Initialize correlation engine with initial config
	cfg := configManager.GetConfig()
	correlationEngine = correlation.NewCorrelationEngine(cfg.WindowSeconds, cfg.GroupBy, cfg.EmitIf)

	// Start config hot reload
	configManager.StartHotReload()

	// Start HTTP server
	go startHTTPServer(port)

	// Start Kafka consumer
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		logrus.Info("Shutting down correlation service...")
		cancel()
		correlationEngine.Close()
	}()

	// Start Kafka consumer
	startKafkaConsumer(ctx, busBroker, inputTopic, outputTopic)

	logrus.Info("Correlation service stopped")
}

func startHTTPServer(port string) {
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/metrics", metricsManager.Handler().ServeHTTP)
	http.HandleFunc("/debug/stats", handleDebugStats)

	logrus.Infof("HTTP server listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		logrus.Fatalf("Failed to start HTTP server: %v", err)
	}
}

func startKafkaConsumer(ctx context.Context, broker, inputTopic, outputTopic string) {
	// Create Kafka reader
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{broker},
		Topic:       inputTopic,
		GroupID:     "correlation-service",
		StartOffset: kafka.LastOffset,
		MinBytes:    10e3, // 10KB
		MaxBytes:    10e6, // 10MB
	})

	defer reader.Close()

	// Create Kafka writer
	writer := &kafka.Writer{
		Addr:      kafka.TCP(broker),
		Topic:     outputTopic,
		Balancer:  &kafka.LeastBytes{},
		BatchSize: 1,
	}

	defer writer.Close()

	logrus.Infof("Kafka consumer started for topic: %s", inputTopic)

	for {
		select {
		case <-ctx.Done():
			logrus.Info("Context cancelled, exiting...")
			return
		default:
			// Read message
			msg, err := reader.ReadMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				logrus.Errorf("Error reading message: %v", err)
				metricsManager.RecordProcessingError()
				continue
			}

			// Process message
			if err := processMessage(ctx, msg, writer); err != nil {
				logrus.Errorf("Error processing message: %v", err)
				metricsManager.RecordProcessingError()
			}
		}
	}
}

func processMessage(ctx context.Context, msg kafka.Message, writer *kafka.Writer) error {
	start := time.Now()
	defer func() {
		metricsManager.RecordProcessingDuration(time.Since(start).Seconds())
	}()

	// Parse event
	var event correlation.Event
	if err := json.Unmarshal(msg.Value, &event); err != nil {
		return fmt.Errorf("failed to unmarshal event: %w", err)
	}

	// Process event with correlation engine
	correlationRecords, err := correlationEngine.ProcessEvent(event)
	if err != nil {
		return fmt.Errorf("failed to process event: %w", err)
	}

	metricsManager.RecordEventProcessed()

	// Emit correlation records if any
	for _, record := range correlationRecords {
		recordBytes, err := json.Marshal(record)
		if err != nil {
			logrus.Errorf("Failed to marshal correlation record: %v", err)
			continue
		}

		if err := writer.WriteMessages(ctx, kafka.Message{
			Key:   []byte(record.CorrelationID),
			Value: recordBytes,
		}); err != nil {
			logrus.Errorf("Failed to write correlation record: %v", err)
			continue
		}

		metricsManager.RecordCorrelationEmitted()
		logrus.Infof("Correlation record emitted: %s (count=%d, labels=%v)",
			record.CorrelationID, record.Count, record.Labels)
	}

	return nil
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	stats := correlationEngine.GetStats()

	response := map[string]interface{}{
		"status":    "healthy",
		"service":   "correlation",
		"timestamp": time.Now().Format(time.RFC3339),
		"stats":     stats,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func handleDebugStats(w http.ResponseWriter, r *http.Request) {
	if !configManager.GetDebugMode() {
		http.Error(w, "Debug mode not enabled", http.StatusForbidden)
		return
	}

	stats := correlationEngine.GetStats()
	config := configManager.GetConfig()

	response := map[string]interface{}{
		"engine_stats": stats,
		"config":       config,
		"timestamp":    time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
