package app

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/dnasol/dna-platform/services/processing/internal/config"
	eslogger "github.com/dnasol/dna-platform/services/processing/internal/elasticsearch"
	"github.com/dnasol/dna-platform/services/processing/internal/kafka"
	"github.com/dnasol/dna-platform/services/processing/internal/model"
	mongostore "github.com/dnasol/dna-platform/services/processing/internal/mongo"
	"github.com/dnasol/dna-platform/services/processing/internal/observability"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
	"github.com/dnasol/dna-platform/services/processing/internal/rules"
	"github.com/dnasol/dna-platform/services/processing/internal/store"
	"github.com/dnasol/dna-platform/services/processing/internal/transform"
	"github.com/elastic/go-elasticsearch/v8"
	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/zap"
)

// App holds the application state
type App struct {
	// Core components
	Registry          *pipeline.Registry
	Executor          *pipeline.Executor
	Config            *config.Client
	DataModelRegistry *model.DataModelRegistry

	// Kafka
	Consumer       *kafka.Consumer
	Producer       *kafka.Producer
	DLQPublisher   *kafka.DLQPublisher
	EventPublisher *kafka.EventPublisher

	// Storage
	MongoClient    *mongo.Client
	ESClient       *elasticsearch.Client
	MongoStore     *mongostore.Store
	ESLogger       *eslogger.Logger
	MappingManager *eslogger.MappingManager

	// Observability
	Metrics *observability.Metrics
	Health  *observability.HealthCheck
	Logger  *zap.Logger

	// Lifecycle
	shutdownTracing func(context.Context) error

	// Model-specific pipelines
	ModelPipelines map[string]*pipeline.Executor

	// Derived model transformer
	DerivedTransformer *transform.DerivedModelTransformer
}

// Config holds application configuration
type Config struct {
	// Service
	ServiceName string

	// Kafka
	KafkaBrokers     []string
	KafkaInputTopic  string
	KafkaOutputTopic string
	KafkaDLQTopic    string
	KafkaGroupID     string

	// Config Service
	ConfigURL   string
	ConfigScope string

	// MongoDB
	MongoURI      string
	MongoDatabase string

	// Elasticsearch
	ElasticAddresses []string
	ElasticUsername  string
	ElasticPassword  string
	ElasticIndex     string

	// Observability
	JaegerEndpoint string

	// Pipeline
	SchemaPath        string
	PipelineConfigPath string
}

// New creates and initializes a new application
func New(ctx context.Context, cfg Config, logger *zap.Logger) (*App, error) {
	app := &App{
		Logger:         logger,
		Metrics:        observability.NewMetrics(),
		Health:         observability.NewHealthCheck(),
		ModelPipelines: make(map[string]*pipeline.Executor),
	}

	// Initialize tracing
	shutdown, err := observability.InitTracing(cfg.ServiceName, cfg.JaegerEndpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize tracing: %w", err)
	}
	app.shutdownTracing = shutdown

	// Create registry and register rules
	app.Registry = pipeline.NewRegistry()
	if err := rules.RegisterAll(app.Registry); err != nil {
		return nil, fmt.Errorf("failed to register rules: %w", err)
	}

	// Initialize MongoDB if configured
	if cfg.MongoURI != "" {
		mongoClient, err := store.NewMongoClient(ctx, store.MongoConfig{
			URI:      cfg.MongoURI,
			Database: cfg.MongoDatabase,
		})
		if err != nil {
			logger.Warn("MongoDB not available", zap.Error(err))
		} else {
			app.MongoClient = mongoClient
			logger.Info("MongoDB connected")

			// Initialize MongoDB store for processed events
			mongoStore, err := mongostore.NewStore(cfg.MongoURI)
			if err != nil {
				logger.Warn("Failed to initialize MongoDB store", zap.Error(err))
			} else {
				app.MongoStore = mongoStore
				logger.Info("MongoDB store initialized")
			}

			// Health check
			app.Health.Register("mongo", func() error {
				return mongoClient.Ping(ctx, nil)
			})
		}
	}

	// Initialize Elasticsearch if configured
	if len(cfg.ElasticAddresses) > 0 {
		esClient, err := store.NewElasticsearchClient(store.ElasticsearchConfig{
			Addresses: cfg.ElasticAddresses,
			Username:  cfg.ElasticUsername,
			Password:  cfg.ElasticPassword,
		})
		if err != nil {
			logger.Warn("Elasticsearch not available", zap.Error(err))
		} else {
			app.ESClient = esClient
			logger.Info("Elasticsearch connected")

			// Initialize Elasticsearch logger
			esLogger := eslogger.NewLogger(cfg.ElasticAddresses[0], cfg.ElasticIndex, "processing")
			app.ESLogger = esLogger
			logger.Info("Elasticsearch logger initialized")

			// Initialize Elasticsearch mapping manager
			app.MappingManager = eslogger.NewMappingManager(esClient, logger)
			logger.Info("Elasticsearch mapping manager initialized")
		}
	}

	// Initialize DataModelRegistry if MongoDB is available
	if app.MongoClient != nil {
		app.DataModelRegistry = model.NewDataModelRegistry(app.MongoClient, logger)
		if err := app.DataModelRegistry.LoadModels(ctx); err != nil {
			logger.Warn("Failed to load data models", zap.Error(err))
		} else {
			logger.Info("Data model registry initialized")

			// Ensure Elasticsearch mappings for all models
			if app.MappingManager != nil {
				if err := app.MappingManager.EnsureAllModelMappings(ctx, app.DataModelRegistry); err != nil {
					logger.Warn("Failed to ensure Elasticsearch mappings", zap.Error(err))
				} else {
					logger.Info("Elasticsearch mappings ensured for all data models")
				}
			}
		}
	}

	// Create DLQ publisher
	app.DLQPublisher = kafka.NewDLQPublisher(cfg.KafkaBrokers, cfg.KafkaDLQTopic, logger)

	// Create event publisher for service events
	app.EventPublisher = kafka.NewEventPublisher(cfg.KafkaBrokers, "service-events")
	logger.Info("Kafka event publisher initialized")

	// Create derived model transformer
	app.DerivedTransformer = transform.NewDerivedModelTransformer(logger)
	logger.Info("Derived model transformer initialized")

	// Create executor
	app.Executor = pipeline.NewExecutor(pipeline.ExecutorConfig{
		Registry:     app.Registry,
		SchemaPath:   cfg.SchemaPath,
		Logger:       logger,
		DLQPublisher: app.DLQPublisher,
	})

	// Create config client
	app.Config = config.NewClient(config.ClientConfig{
		BaseURL: cfg.ConfigURL,
		Scope:   cfg.ConfigScope,
		Logger:  logger,
	})

	// Load initial pipeline configuration
	// Try config service first, fallback to local file
	var pipelineConfig *model.PipelineConfig
	var configErr error

	// Check if config service is available (not localhost:8084 or empty)
	if cfg.ConfigURL != "" && cfg.ConfigURL != "http://localhost:8084" {
		pipelineConfig, configErr = app.Config.LoadPipeline(ctx)
		if configErr != nil {
			logger.Warn("failed to load pipeline config from config service, trying local file", zap.Error(configErr))
		}
	} else {
		logger.Info("config service URL not set or disabled, using local file")
		configErr = fmt.Errorf("config service disabled")
	}

	// Fallback to local file if config service failed or disabled
	if pipelineConfig == nil {
		pipelineConfigPath := cfg.PipelineConfigPath
		if pipelineConfigPath == "" {
			pipelineConfigPath = "/app/dev.pipeline.json"
		}
		pipelineConfig, configErr = loadPipelineFromFile(pipelineConfigPath, logger)
		if configErr != nil {
			logger.Warn("failed to load pipeline config from local file", zap.Error(configErr))
		}
	}

	// Load pipeline if we have a config
	if pipelineConfig != nil {
		if err := app.Executor.LoadPipeline(ctx, pipelineConfig); err != nil {
			return nil, fmt.Errorf("failed to load pipeline: %w", err)
		}
		logger.Info("pipeline config loaded successfully", zap.Int("rules", len(pipelineConfig.Rules)))
	} else {
		logger.Warn("no pipeline config available, processing will use default behavior")
	}

	// Create Kafka consumer
	app.Consumer = kafka.NewConsumer(kafka.ConsumerConfig{
		Brokers: cfg.KafkaBrokers,
		Topic:   cfg.KafkaInputTopic,
		GroupID: cfg.KafkaGroupID,
		Logger:  logger,
	})

	// Create Kafka producer
	app.Producer = kafka.NewProducer(kafka.ProducerConfig{
		Brokers: cfg.KafkaBrokers,
		Topic:   cfg.KafkaOutputTopic,
		Logger:  logger,
	})

	return app, nil
}

// StartSSEWatch starts watching for config updates via SSE (only if config service is available)
func (a *App) StartSSEWatch(ctx context.Context, configURL string) {
	// Only start SSE watch if config service is available
	if configURL == "" || configURL == "http://localhost:8084" {
		a.Logger.Info("SSE watch disabled (config service not available)")
		return
	}

	go func() {
		err := a.Config.WatchSSE(ctx, func(pipelineConfig *model.PipelineConfig) {
			a.Logger.Info("reloading pipeline from SSE update")
			if err := a.Executor.LoadPipeline(ctx, pipelineConfig); err != nil {
				a.Logger.Error("failed to reload pipeline", zap.Error(err))
			}
		})
		if err != nil && err != context.Canceled {
			a.Logger.Error("SSE watch error", zap.Error(err))
		}
	}()
}

// loadPipelineFromFile loads pipeline configuration from a local JSON file
func loadPipelineFromFile(filePath string, logger *zap.Logger) (*model.PipelineConfig, error) {
	// If filePath is empty or doesn't exist, try default location
	if filePath == "" || filePath == "contracts/schemas/processing.rules.schema.json" {
		filePath = "/app/dev.pipeline.json"
	}

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		// Try alternative locations
		alternatives := []string{
			"./dev.pipeline.json",
			"dev.pipeline.json",
			"/app/dev.pipeline.json",
		}
		for _, alt := range alternatives {
			if _, err := os.Stat(alt); err == nil {
				filePath = alt
				break
			}
		}
	}

	logger.Info("loading pipeline config from file", zap.String("path", filePath))

	// Read file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read pipeline config file: %w", err)
	}

	// Parse JSON
	var config model.PipelineConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse pipeline config JSON: %w", err)
	}

	logger.Info("pipeline config loaded from file",
		zap.String("path", filePath),
		zap.Int("version", config.Version),
		zap.Int("rules", len(config.Rules)),
	)

	return &config, nil
}

// LoadModelPipelines loads model-specific pipeline configurations from the pipelines directory
func (a *App) LoadModelPipelines(ctx context.Context) error {
	pipelinesDir := os.Getenv("PIPELINES_DIR")
	if pipelinesDir == "" {
		pipelinesDir = "/app/pipelines"
	}

	// Check if directory exists
	if _, err := os.Stat(pipelinesDir); os.IsNotExist(err) {
		a.Logger.Info("pipelines directory does not exist, skipping model pipeline loading", zap.String("dir", pipelinesDir))
		return nil
	}

	// Read directory
	entries, err := os.ReadDir(pipelinesDir)
	if err != nil {
		return fmt.Errorf("failed to read pipelines directory: %w", err)
	}

	loadedCount := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		filename := entry.Name()

		// Only process model_*.json files
		if len(filename) < 11 || filename[:6] != "model_" || filename[len(filename)-5:] != ".json" {
			continue
		}

		// Extract model ID from filename (model_<id>.json)
		modelID := filename[6 : len(filename)-5]

		// Load pipeline config
		filePath := pipelinesDir + "/" + filename
		data, err := os.ReadFile(filePath)
		if err != nil {
			a.Logger.Error("failed to read model pipeline file",
				zap.String("file", filename),
				zap.Error(err))
			continue
		}

		var config model.PipelineConfig
		if err := json.Unmarshal(data, &config); err != nil {
			a.Logger.Error("failed to parse model pipeline JSON",
				zap.String("file", filename),
				zap.Error(err))
			continue
		}

		// Create executor for this model
		executor := pipeline.NewExecutor(pipeline.ExecutorConfig{
			Registry:     a.Registry,
			Logger:       a.Logger,
			DLQPublisher: a.DLQPublisher,
		})

		// Load pipeline
		if err := executor.LoadPipeline(ctx, &config); err != nil {
			a.Logger.Error("failed to load model pipeline",
				zap.String("model_id", modelID),
				zap.String("file", filename),
				zap.Error(err))
			continue
		}

		// Store executor
		a.ModelPipelines[modelID] = executor
		loadedCount++

		a.Logger.Info("loaded model pipeline",
			zap.String("model_id", modelID),
			zap.Int("rules", len(config.Rules)))
	}

	a.Logger.Info("model pipelines loaded",
		zap.Int("count", loadedCount),
		zap.String("dir", pipelinesDir))

	return nil
}

// Shutdown gracefully shuts down the application
func (a *App) Shutdown(ctx context.Context) error {
	a.Logger.Info("shutting down application")

	if a.Consumer != nil {
		a.Consumer.Close()
	}

	if a.Producer != nil {
		a.Producer.Close()
	}

	if a.DLQPublisher != nil {
		a.DLQPublisher.Close()
	}

	if a.MongoClient != nil {
		a.MongoClient.Disconnect(ctx)
	}

	if a.shutdownTracing != nil {
		a.shutdownTracing(ctx)
	}

	return nil
}
