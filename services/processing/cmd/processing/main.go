package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/dnasol/dna-platform/services/processing/internal/app"
	"github.com/dnasol/dna-platform/services/processing/internal/model"
	mongostore "github.com/dnasol/dna-platform/services/processing/internal/mongo"
	"github.com/elastic/go-elasticsearch/v8/esapi"
	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

func main() {
	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// Load configuration from environment
	cfg := LoadConfig()

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize application
	application, err := app.New(ctx, cfg, logger)
	if err != nil {
		logger.Fatal("failed to initialize application", zap.Error(err))
	}

	// Start SSE watch for config updates (only if config service is available)
	application.StartSSEWatch(ctx, cfg.ConfigURL)

	// Load model-specific pipelines
	if err := application.LoadModelPipelines(ctx); err != nil {
		logger.Warn("failed to load model pipelines", zap.Error(err))
	}

	// Setup HTTP server
	router := chi.NewRouter()

	// Health and readiness
	router.Get("/health", application.Health.HealthHandler())
	router.Get("/ready", application.Health.ReadyHandler())

	// Metrics
	router.Get("/metrics", promhttp.Handler().ServeHTTP)

	// Dev endpoint for manual processing (bypasses Kafka)
	router.Post("/v1/process", DevProcessHandler(application, logger))

	// Reload models endpoint
	router.Post("/reload-models", ReloadModelsHandler(application, logger))

	// Start HTTP server
	httpPort := GetEnv("HTTP_PORT", "8080")
	server := &http.Server{
		Addr:    ":" + httpPort,
		Handler: router,
	}

	go func() {
		logger.Info("HTTP server starting", zap.String("port", httpPort))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("HTTP server error", zap.Error(err))
		}
	}()

	// Start Kafka consumer loop
	go func() {
		logger.Info("Kafka consumer starting")
		ConsumeLoop(ctx, application, logger)
	}()

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	logger.Info("Shutdown signal received")

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("HTTP server shutdown error", zap.Error(err))
	}

	if err := application.Shutdown(shutdownCtx); err != nil {
		logger.Error("Application shutdown error", zap.Error(err))
	}

	logger.Info("Shutdown complete")
}

func ConsumeLoop(ctx context.Context, app *app.App, logger *zap.Logger) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			event, _, err := app.Consumer.ReadEvent(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				logger.Error("failed to read event", zap.Error(err))
				continue
			}

			// Find the data model for this event's data source to get the correct index
			var targetIndex string

			if app.DataModelRegistry != nil && event.DataSourceID != "" {
				dataModel, err := app.DataModelRegistry.GetModelByDataSourceID(ctx, event.DataSourceID)
				if err != nil {
					logger.Warn("failed to find data model for event",
						zap.String("event_id", event.EventID),
						zap.String("data_source_id", event.DataSourceID),
						zap.Error(err))
					targetIndex = "dna-events-default"
				} else {
					targetIndex = dataModel.ELK.IndexName
				}
			} else {
				targetIndex = "dna-events-default"
			}

			// Set the target index for persist_es rule
			if app.ESClient != nil {
				app.Executor.SetESClientAndIndex(app.ESClient, targetIndex)
			}

		// Process event with main pipeline
		start := time.Now()
		processed, err := app.Executor.Execute(ctx, event)
		duration := time.Since(start).Milliseconds()

		// Handle processing errors
		if err != nil {
			logger.Error("failed to process event",
				zap.String("event_id", event.EventID),
				zap.Error(err))
			continue
		}

		// Process derived models if any
		logger.Info("checking for derived models - START",
			zap.String("event_id", event.EventID),
			zap.String("data_source_id", event.DataSourceID),
			zap.Bool("has_registry", app.DataModelRegistry != nil))

		if app.DataModelRegistry != nil && event.DataSourceID != "" {
			sourceModel, err := app.DataModelRegistry.GetModelByDataSourceID(ctx, event.DataSourceID)
			if err != nil {
				logger.Info("failed to get source model by data_source_id",
					zap.String("data_source_id", event.DataSourceID),
					zap.Error(err))
			} else if sourceModel != nil {
				// Find derived models that use this source
				derivedModels := app.DataModelRegistry.GetDerivedModels(sourceModel.DataIndex)

				logger.Info("found derived models",
					zap.String("source_data_index", sourceModel.DataIndex),
					zap.Int("derived_count", len(derivedModels)))

				for _, derivedModel := range derivedModels {
					logger.Info("processing event with derived model",
						zap.String("event_id", event.EventID),
						zap.String("derived_model", derivedModel.Name),
						zap.String("derived_model_id", derivedModel.ID.Hex()),
						zap.Int("attribute_count", len(derivedModel.Attributes)))

					// Transform event to include only selected attributes
					if app.DerivedTransformer != nil {
						derivedEvent, transformErr := app.DerivedTransformer.Transform(ctx, processed, derivedModel)
						if transformErr != nil {
							logger.Error("failed to transform event for derived model",
								zap.String("event_id", event.EventID),
								zap.String("derived_model", derivedModel.Name),
								zap.Error(transformErr))
							continue
						}

						// Log to Elasticsearch
						if app.ESClient != nil {
							// Convert event to document
							doc := map[string]interface{}{
								"@timestamp":      derivedEvent.Timestamp,
								"event_id":        derivedEvent.EventID,
								"organization_id": derivedEvent.OrganizationID,
								"tenant_id":       derivedEvent.TenantID,
								"data_source_id":  derivedEvent.DataSourceID,
								"agent_id":        derivedEvent.AgentID,
								"type":            derivedEvent.Kind,
								"source":          derivedEvent.Source,
								"ingested_at":     derivedEvent.IngestedAt,
								"payload":         derivedEvent.Payload,
								"attributes":      derivedEvent.Attributes,
							}

							docBytes, _ := json.Marshal(doc)
							req := esapi.IndexRequest{
								Index:      derivedModel.ELK.IndexName,
								DocumentID: derivedEvent.EventID,
								Body:       bytes.NewReader(docBytes),
								Refresh:    "false",
							}

							res, logErr := req.Do(ctx, app.ESClient)
							if logErr != nil {
								logger.Error("failed to log derived event to Elasticsearch",
									zap.String("event_id", derivedEvent.EventID),
									zap.String("derived_model", derivedModel.Name),
									zap.String("index", derivedModel.ELK.IndexName),
									zap.Error(logErr))
							} else {
								defer res.Body.Close()
								if res.IsError() {
									logger.Error("elasticsearch returned error for derived event",
										zap.String("event_id", derivedEvent.EventID),
										zap.String("status", res.Status()))
								} else {
									logger.Info("derived event logged to Elasticsearch",
										zap.String("event_id", derivedEvent.EventID),
										zap.String("derived_model", derivedModel.Name),
										zap.String("index", derivedModel.ELK.IndexName))
								}
							}
						}
					}
				}
			}
		}

		// Store processed event in MongoDB
		if app.MongoStore != nil {
			processedEvent := &mongostore.ProcessedEvent{
				EventID:  event.EventID,
				TenantID: event.TenantID,
				OriginalEvent: map[string]interface{}{
					"event_id":   event.EventID,
					"tenant_id":  event.TenantID,
					"kind":       event.Kind,
					"source":     event.Source,
					"payload":    event.Payload,
					"attributes": event.Attributes,
				},
				ProcessedEvent: map[string]interface{}{
					"event_id":   processed.EventID,
					"tenant_id":  processed.TenantID,
					"kind":       processed.Kind,
					"source":     processed.Source,
					"payload":    processed.Payload,
					"attributes": processed.Attributes,
				},
				ProcessingRules: []string{"normalization", "enrichment"}, // TODO: Get from executor
				Duration:        duration,
				Status:          "success",
			}

				if err != nil {
					processedEvent.Status = "error"
					processedEvent.Error = err.Error()
				}

				if storeErr := app.MongoStore.StoreProcessedEvent(ctx, processedEvent); storeErr != nil {
					logger.Warn("Failed to store processed event in MongoDB",
						zap.String("event_id", event.EventID),
						zap.Error(storeErr))
				}
			}

			// Log to Elasticsearch
			if app.ESLogger != nil {
				originalEventMap := map[string]interface{}{
					"event_id":   event.EventID,
					"tenant_id":  event.TenantID,
					"kind":       event.Kind,
					"source":     event.Source,
					"payload":    event.Payload,
					"attributes": event.Attributes,
				}
				processedEventMap := map[string]interface{}{
					"event_id":   processed.EventID,
					"tenant_id":  processed.TenantID,
					"kind":       processed.Kind,
					"source":     processed.Source,
					"payload":    processed.Payload,
					"attributes": processed.Attributes,
				}

				if logErr := app.ESLogger.LogProcessingEvent(ctx, event.EventID,
					originalEventMap, processedEventMap,
					[]string{"normalization", "enrichment"},
					"success", duration, err); logErr != nil {
					logger.Warn("Failed to log to Elasticsearch",
						zap.String("event_id", event.EventID),
						zap.Error(logErr))
				}
			}

			// Publish service event to Kafka
			if app.EventPublisher != nil {
				originalEventMap := map[string]interface{}{
					"event_id":   event.EventID,
					"tenant_id":  event.TenantID,
					"kind":       event.Kind,
					"source":     event.Source,
					"payload":    event.Payload,
					"attributes": event.Attributes,
				}
				processedEventMap := map[string]interface{}{
					"event_id":   processed.EventID,
					"tenant_id":  processed.TenantID,
					"kind":       processed.Kind,
					"source":     processed.Source,
					"payload":    processed.Payload,
					"attributes": processed.Attributes,
				}

				if pubErr := app.EventPublisher.PublishProcessingEvent(ctx, event.EventID,
					originalEventMap, processedEventMap,
					[]string{"normalization", "enrichment"},
					"success", duration, err); pubErr != nil {
					logger.Warn("Failed to publish service event",
						zap.String("event_id", event.EventID),
						zap.Error(pubErr))
				}
			}

			if err != nil {
				logger.Error("failed to process event",
					zap.String("event_id", event.EventID),
					zap.Error(err),
				)
				app.Metrics.RecordEventError()
				app.Metrics.RecordPipelineLatency("error", float64(duration)/1000.0)

				// Publish to DLQ if configured
				if app.DLQPublisher != nil {
					if dlqErr := app.DLQPublisher.Publish(ctx, event, err.Error()); dlqErr != nil {
						logger.Error("failed to publish to DLQ", zap.Error(dlqErr))
					}
					app.Metrics.RecordDLQ()
				}
				continue
			}

			// Publish processed event
			if err := app.Producer.PublishEvent(ctx, processed); err != nil {
				logger.Error("failed to publish processed event",
					zap.String("event_id", processed.EventID),
					zap.Error(err),
				)
				app.Metrics.RecordEventError()
				continue
			}

			app.Metrics.RecordEventSuccess()
			app.Metrics.RecordPipelineLatency("success", float64(duration)/1000.0)

			logger.Info("event processed successfully",
				zap.String("event_id", processed.EventID),
				zap.Duration("duration", time.Since(start)),
			)
		}
	}
}

func DevProcessHandler(app *app.App, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var event model.Event
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			http.Error(w, fmt.Sprintf("invalid JSON: %v", err), http.StatusBadRequest)
			return
		}

		// Process event
		start := time.Now()
		processed, err := app.Executor.Execute(r.Context(), &event)
		duration := time.Since(start)

		if err != nil {
			logger.Error("dev process failed", zap.Error(err))
			http.Error(w, fmt.Sprintf("processing failed: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Processing-Duration", duration.String())
		json.NewEncoder(w).Encode(processed)
	}
}

func ReloadModelsHandler(app *app.App, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		logger.Info("reloading data models")

		if app.DataModelRegistry == nil {
			http.Error(w, "data model registry not initialized", http.StatusServiceUnavailable)
			return
		}

		// Reload models from MongoDB
		if err := app.DataModelRegistry.Reload(r.Context()); err != nil {
			logger.Error("failed to reload models", zap.Error(err))
			http.Error(w, fmt.Sprintf("failed to reload models: %v", err), http.StatusInternalServerError)
			return
		}

		// Ensure Elasticsearch mappings for all models
		if app.MappingManager != nil {
			if err := app.MappingManager.EnsureAllModelMappings(r.Context(), app.DataModelRegistry); err != nil {
				logger.Warn("failed to ensure Elasticsearch mappings", zap.Error(err))
			}
		}

		logger.Info("data models reloaded successfully")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "success",
			"message": "data models reloaded",
		})
	}
}

func LoadConfig() app.Config {
	return app.Config{
		ServiceName: GetEnv("SERVICE_NAME", "processing"),

		// Kafka
		KafkaBrokers:     strings.Split(GetEnv("KAFKA_BROKERS", "localhost:9092"), ","),
		KafkaInputTopic:  GetEnv("KAFKA_INPUT_TOPIC", "ingestion.raw.v1"),
		KafkaOutputTopic: GetEnv("KAFKA_OUTPUT_TOPIC", "processing.cleaned.v1"),
		KafkaDLQTopic:    GetEnv("KAFKA_DLQ_TOPIC", "processing.dlq"),
		KafkaGroupID:     GetEnv("KAFKA_GROUP_ID", "processing-service"),

		// Config Service
		ConfigURL:   GetEnv("CONFIG_URL", "http://localhost:8084"),
		ConfigScope: GetEnv("CONFIG_SCOPE", "processing"),

		// MongoDB
		MongoURI:      GetEnv("MONGO_URI", ""),
		MongoDatabase: GetEnv("MONGO_DATABASE", "dna"),

		// Elasticsearch
		ElasticAddresses: strings.Split(GetEnv("ELASTIC_ADDRESSES", ""), ","),
		ElasticUsername:  GetEnv("ELASTIC_USERNAME", ""),
		ElasticPassword:  GetEnv("ELASTIC_PASSWORD", ""),
		ElasticIndex:     GetEnv("ELASTIC_INDEX", "processing-events"),

		// Observability
		JaegerEndpoint: GetEnv("JAEGER_ENDPOINT", ""),

		// Pipeline
		SchemaPath:        GetEnv("SCHEMA_PATH", "contracts/schemas/processing.rules.schema.json"),
		PipelineConfigPath: GetEnv("PIPELINE_CONFIG_PATH", "/app/dev.pipeline.json"),
	}
}

func GetEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
