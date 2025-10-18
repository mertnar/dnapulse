package app

import (
	"context"
	"fmt"

	"github.com/dnasol/dna-platform/services/processing/internal/config"
	eslogger "github.com/dnasol/dna-platform/services/processing/internal/elasticsearch"
	"github.com/dnasol/dna-platform/services/processing/internal/kafka"
	"github.com/dnasol/dna-platform/services/processing/internal/model"
	mongostore "github.com/dnasol/dna-platform/services/processing/internal/mongo"
	"github.com/dnasol/dna-platform/services/processing/internal/observability"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
	"github.com/dnasol/dna-platform/services/processing/internal/rules"
	"github.com/dnasol/dna-platform/services/processing/internal/store"
	"github.com/elastic/go-elasticsearch/v8"
	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/zap"
)

// App holds the application state
type App struct {
	// Core components
	Registry *pipeline.Registry
	Executor *pipeline.Executor
	Config   *config.Client

	// Kafka
	Consumer       *kafka.Consumer
	Producer       *kafka.Producer
	DLQPublisher   *kafka.DLQPublisher
	EventPublisher *kafka.EventPublisher

	// Storage
	MongoClient *mongo.Client
	ESClient    *elasticsearch.Client
	MongoStore  *mongostore.Store
	ESLogger    *eslogger.Logger

	// Observability
	Metrics *observability.Metrics
	Health  *observability.HealthCheck
	Logger  *zap.Logger

	// Lifecycle
	shutdownTracing func(context.Context) error
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
	SchemaPath string
}

// New creates and initializes a new application
func New(ctx context.Context, cfg Config, logger *zap.Logger) (*App, error) {
	app := &App{
		Logger:  logger,
		Metrics: observability.NewMetrics(),
		Health:  observability.NewHealthCheck(),
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
		}
	}

	// Create DLQ publisher
	app.DLQPublisher = kafka.NewDLQPublisher(cfg.KafkaBrokers, cfg.KafkaDLQTopic, logger)

	// Create event publisher for service events
	app.EventPublisher = kafka.NewEventPublisher(cfg.KafkaBrokers, "service-events")
	logger.Info("Kafka event publisher initialized")

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
	pipelineConfig, err := app.Config.LoadPipeline(ctx)
	if err != nil {
		logger.Warn("failed to load initial pipeline config", zap.Error(err))
	} else {
		if err := app.Executor.LoadPipeline(ctx, pipelineConfig); err != nil {
			return nil, fmt.Errorf("failed to load pipeline: %w", err)
		}
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

// StartSSEWatch starts watching for config updates via SSE
func (a *App) StartSSEWatch(ctx context.Context) {
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
