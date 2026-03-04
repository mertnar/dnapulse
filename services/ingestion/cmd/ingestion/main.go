package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	ingestionv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/dna/ingestion/v1"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/auth"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/config"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/elasticsearch"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/grpc"
	kafkapkg "github.com/dnasol/dna-platform/services/ingestion/pkg/kafka"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/middleware"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/mongo"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/otel"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/ratelimit"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/schema"
	"github.com/golang-jwt/jwt/v5"
	"github.com/segmentio/kafka-go"
	"go.mongodb.org/mongo-driver/bson/primitive"
	grpclib "google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type IngestRequest struct {
	Metric string  `json:"metric"`
	Value  float64 `json:"value"`
	Source string  `json:"source"`
}

var (
	kafkaWriter    *kafka.Writer
	configManager  *config.ConfigManager
	rateLimiter    *ratelimit.TokenBucket
	mongoStore     *mongo.Store
	elasticLogger  *elasticsearch.Logger
	eventPublisher *kafkapkg.EventPublisher
	telemetry      *otel.Telemetry
)

func main() {
	// Configuration from environment
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	kafkaTopic := getEnv("KAFKA_TOPIC", "ingestion.raw.v1")
	httpPort := getEnv("HTTP_PORT", "19071")
	grpcPort := getEnv("GRPC_PORT", "9090")

	// Initialize configuration manager (disabled for now - TODO: Enable config service integration)
	enableConfigService := getEnv("ENABLE_CONFIG_SERVICE", "false") == "true"
	if enableConfigService {
		configManager = config.NewConfigManager()
		log.Printf("Config manager initialized")

		// Load initial configuration
		ctx := context.Background()
		if err := configManager.LoadConfig(ctx); err != nil {
			log.Printf("Warning: Failed to load initial config: %v", err)
			log.Printf("Using default configuration")
		}
	} else {
		// Use default config manager with default values
		configManager = config.NewConfigManager()
		log.Printf("Config service disabled - using default configuration")
	}

	// Initialize MongoDB store
	mongoURL := getEnv("MONGO_URL", "mongodb://localhost:27017/dna-pulse")
	var err error

	// Retry MongoDB connection with exponential backoff
	maxRetries := 5
	retryDelay := 2 * time.Second

	for i := 0; i < maxRetries; i++ {
		mongoStore, err = mongo.NewStore(mongoURL)
		if err == nil {
			log.Printf("MongoDB store initialized successfully")
			break
		}

		if i < maxRetries-1 {
			log.Printf("Failed to connect to MongoDB (attempt %d/%d): %v", i+1, maxRetries, err)
			log.Printf("Retrying in %v...", retryDelay)
			time.Sleep(retryDelay)
			retryDelay *= 2 // Exponential backoff
		} else {
			log.Fatalf("FATAL: Failed to connect to MongoDB after %d attempts: %v", maxRetries, err)
		}
	}

	// Initialize Elasticsearch logger
	elasticURL := getEnv("ELASTICSEARCH_URL", "http://localhost:9200")
	elasticIndex := getEnv("ELASTICSEARCH_INDEX", "ingestion-events")
	elasticLogger = elasticsearch.NewLogger(elasticURL, elasticIndex, "ingestion")
	log.Printf("Elasticsearch logger initialized")

	// Initialize Kafka event publisher
	eventPublisher = kafkapkg.NewEventPublisher(strings.Split(kafkaBrokers, ","), "service-events")
	log.Printf("Kafka event publisher initialized")

	// Initialize telemetry
	metricsPort := getEnv("METRICS_PORT", "9091")
	telemetry, err = otel.InitTelemetry(otel.Config{
		ServiceName:    "ingestion-service",
		ServiceVersion: "1.0.0",
		JaegerEndpoint: getEnv("JAEGER_ENDPOINT", ""),
		PrometheusPort: metricsPort,
	})
	if err != nil {
		log.Printf("Warning: Failed to initialize telemetry: %v", err)
	} else {
		log.Printf("Telemetry initialized on port %s", metricsPort)
	}

	// Initialize rate limiter with config
	rateLimitRPS := configManager.GetRateLimitRPS()
	rateLimiter = ratelimit.NewTokenBucket(int64(rateLimitRPS*2), int64(rateLimitRPS)) // 2x capacity, refill at RPS rate

	// Initialize Kafka writer
	// Split brokers string by comma to support multiple brokers
	brokerList := strings.Split(kafkaBrokers, ",")
	for i, broker := range brokerList {
		brokerList[i] = strings.TrimSpace(broker)
	}
	kafkaWriter = &kafka.Writer{
		Addr:         kafka.TCP(brokerList...),
		Topic:        kafkaTopic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireOne,
		Async:        false,
	}
	defer kafkaWriter.Close()

	log.Printf("Ingestion service starting...")
	log.Printf("Kafka brokers: %s", kafkaBrokers)
	log.Printf("Kafka topic: %s", kafkaTopic)
	log.Printf("HTTP port: %s", httpPort)
	log.Printf("gRPC port: %s", grpcPort)
	log.Printf("JWT validation: %s", getEnv("JWT_ISSUER", "disabled"))
	log.Printf("Rate limit: %d RPS", rateLimitRPS)

	// HTTP server setup
	mux := http.NewServeMux()
	mux.HandleFunc("/ingest", jwtMiddleware(handleIngest))
	mux.HandleFunc("/health", handleHealth)

	// Agent management endpoints
	mux.Handle("/api/v1/register", middleware.APIKeyMiddleware(mongoStore)(http.HandlerFunc(handleRegister)))
	mux.Handle("/api/v1/agent/health", middleware.JWTMiddleware()(http.HandlerFunc(handleAgentHealth)))
	mux.Handle("/api/v1/pulse", middleware.JWTMiddleware()(http.HandlerFunc(handlePulse)))
	mux.Handle("/api/v1/agent/config", middleware.JWTMiddleware()(http.HandlerFunc(handleAgentConfig)))

	// Add config debug endpoint if debug mode is enabled
	if configManager.GetDebugMode() {
		mux.HandleFunc("/config/debug", handleConfigDebug)
		log.Printf("Debug mode enabled - /config/debug endpoint available")
	}

	server := &http.Server{
		Addr:         ":" + httpPort,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start hot reload in background (only if config service is enabled)
	if enableConfigService {
		go func() {
			log.Printf("Starting config hot reload...")
			if err := configManager.StartHotReload(ctx); err != nil {
				log.Printf("Config hot reload error: %v", err)
			}
		}()
	}

	// Start HTTP server
	go func() {
		log.Printf("HTTP server listening on :%s", httpPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Start gRPC server
	go func() {
		lis, err := net.Listen("tcp", ":"+grpcPort)
		if err != nil {
			log.Fatalf("Failed to listen on gRPC port %s: %v", grpcPort, err)
		}

		grpcServer := grpclib.NewServer()
		ingestionServer := grpc.NewIngestionServer(kafkaWriter, configManager, rateLimiter)

		// Register the ingestion service
		ingestionv1.RegisterIngestionServiceServer(grpcServer, ingestionServer)

		// Enable reflection for grpcurl
		reflection.Register(grpcServer)

		log.Printf("gRPC server listening on :%s", grpcPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("gRPC server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	log.Println("Shutting down gracefully...")
	shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped")
}

// jwtMiddleware validates JWT tokens if JWT_ISSUER is set
func jwtMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		jwtIssuer := os.Getenv("JWT_ISSUER")
		jwtAudience := os.Getenv("JWT_AUD")

		// Skip JWT validation if not configured
		if jwtIssuer == "" {
			next(w, r)
			return
		}

		// Extract token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]

		// Parse and validate token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Verify signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			// Return the secret key (in production, load from secure storage)
			secret := getEnv("JWT_SECRET", "dev-secret-key")
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			log.Printf("JWT validation failed: %v", err)
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Validate claims
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			if iss, ok := claims["iss"].(string); !ok || iss != jwtIssuer {
				http.Error(w, "Invalid issuer", http.StatusUnauthorized)
				return
			}
			if jwtAudience != "" {
				if aud, ok := claims["aud"].(string); !ok || aud != jwtAudience {
					http.Error(w, "Invalid audience", http.StatusUnauthorized)
					return
				}
			}
		}

		log.Printf("JWT validation successful for request")
		next(w, r)
	}
}

func handleIngest(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Rate limiting
	if !rateLimiter.Allow() {
		http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	// Read request body with size limit
	maxBodySize := configManager.GetMaxBodySize()
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodySize))
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Check if body was truncated
	if len(body) == int(maxBodySize) {
		// Try to read one more byte to see if there's more data
		var extra [1]byte
		if _, err := r.Body.Read(extra[:]); err == nil {
			http.Error(w, "Request body too large", http.StatusRequestEntityTooLarge)
			return
		}
	}

	// Parse JSON request
	var req IngestRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Check if source is allowed
	if !configManager.IsSourceAllowed(req.Source) {
		http.Error(w, "Source not allowed", http.StatusForbidden)
		return
	}

	// Create JSON event (Protobuf will be enabled after proper code generation)
	eventID := generateEventID()
	jsonEvent := map[string]interface{}{
		"event_id": eventID,
		"source":   req.Source,
		"type":     "metric",
		"ts":       time.Now().Format(time.RFC3339),
		"attributes": map[string]string{
			"ingestion_ts": time.Now().Format(time.RFC3339),
		},
		"metric": map[string]interface{}{
			"name":  req.Metric,
			"value": req.Value,
			"unit":  "",
		},
	}

	// Serialize to JSON
	eventBytes, err := json.Marshal(jsonEvent)
	if err != nil {
		log.Printf("Failed to marshal JSON: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Send to Kafka
	msg := kafka.Message{
		Key:   []byte(eventID),
		Value: eventBytes,
		Time:  time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := kafkaWriter.WriteMessages(ctx, msg); err != nil {
		log.Printf("Failed to write to Kafka: %v", err)
		http.Error(w, "Failed to process event", http.StatusInternalServerError)
		return
	}

	// Store in MongoDB
	if mongoStore != nil {
		ingestedEvent := &mongo.IngestedEvent{
			EventID:    eventID,
			TenantID:   "", // TODO: Extract from JWT or request
			Type:       "metric",
			Source:     req.Source,
			Payload:    map[string]interface{}{"metric": req.Metric, "value": req.Value},
			Attributes: map[string]interface{}{"ingestion_ts": time.Now().Format(time.RFC3339)},
		}

		if err := mongoStore.StoreEvent(ctx, ingestedEvent); err != nil {
			log.Printf("Warning: Failed to store event in MongoDB: %v", err)
		}
	}

	// Log to Elasticsearch
	if elasticLogger != nil {
		duration := time.Since(startTime).Milliseconds()
		if err := elasticLogger.LogIngestionEvent(ctx, eventID, req.Source,
			map[string]interface{}{"metric": req.Metric, "value": req.Value},
			"success", duration, nil); err != nil {
			log.Printf("Warning: Failed to log to Elasticsearch: %v", err)
		}
	}

	// Publish service event to Kafka
	if eventPublisher != nil {
		duration := time.Since(startTime).Milliseconds()
		if err := eventPublisher.PublishIngestionEvent(ctx, eventID, req.Source,
			map[string]interface{}{"metric": req.Metric, "value": req.Value},
			"success", duration, nil); err != nil {
			log.Printf("Warning: Failed to publish service event: %v", err)
		}
	}

	// Record metrics
	if telemetry != nil {
		duration := time.Since(startTime).Seconds()
		telemetry.Counter.Add(ctx, 1)
		telemetry.Histogram.Record(ctx, duration)
	}

	log.Printf("Event ingested: %s - %s=%.2f from %s", eventID, req.Metric, req.Value, req.Source)

	// Send response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{
		"event_id": eventID,
		"status":   "accepted",
		"format":   "json",
	})
}

// normalizeEvent adds canonical fields for Live Monitor
func normalizeEvent(event map[string]interface{}) {
	// 1. Add @ts field (use timestamp if exists, otherwise use current time)
	if tsVal, ok := event["timestamp"]; ok {
		event["@ts"] = tsVal
	} else {
		event["@ts"] = time.Now().Format(time.RFC3339Nano)
	}

	// 2. Add severity field (default: info)
	if _, ok := event["severity"]; !ok {
		// Try to infer severity from level, priority, etc.
		severity := "info"
		if level, ok := event["level"].(string); ok {
			switch strings.ToLower(level) {
			case "critical", "emerg", "alert", "fatal":
				severity = "critical"
			case "high", "err", "error":
				severity = "high"
			case "medium", "warn", "warning":
				severity = "medium"
			case "low", "notice":
				severity = "low"
			case "debug", "trace":
				severity = "debug"
			}
		} else if priority, ok := event["priority"].(string); ok {
			switch strings.ToLower(priority) {
			case "critical", "emerg", "alert":
				severity = "critical"
			case "high", "err", "error":
				severity = "high"
			case "medium", "warn", "warning":
				severity = "medium"
			case "low", "notice":
				severity = "low"
			}
		}
		event["severity"] = severity
	}

	// 3. Extract common fields: event_type, host, user, service (if they exist)
	// These are already in the payload, just ensure they're accessible
	// No need to duplicate them

	// 4. Create flattened object for hot fields (optional for ingestion, can be done later)
	// For now, we'll just ensure the event has the basic normalized fields
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
		"format": "json",
	})
}

func handleConfigDebug(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Only allow in debug mode
	if !configManager.GetDebugMode() {
		http.Error(w, "Debug endpoint not available", http.StatusNotFound)
		return
	}

	config := configManager.GetConfig()
	tokens, capacity, rate := rateLimiter.Stats()

	debugInfo := map[string]interface{}{
		"config": map[string]interface{}{
			"allowed_sources": config.AllowedSources,
			"max_body_kb":     config.MaxBodyKB,
			"rate_limit_rps":  config.RateLimitRPS,
		},
		"rate_limiter": map[string]interface{}{
			"tokens":      tokens,
			"capacity":    capacity,
			"refill_rate": rate,
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(debugInfo)
}

func generateEventID() string {
	return fmt.Sprintf("evt_%d", time.Now().UnixNano())
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ============== Agent Management Handlers ==============

// RegisterRequest represents the agent registration request
type RegisterRequest struct {
	APIKey      string                   `json:"api_key"`
	AgentName   string                   `json:"agent_name"`
	AgentType   string                   `json:"agent_type"`
	AgentTypeID string                   `json:"agent_type_id"` // Agent Type ID (required)
	Version     string                   `json:"version"`
	Platform    string                   `json:"platform"`
	Hostname    string                   `json:"hostname"`
	SampleData  []map[string]interface{} `json:"sample_data"`
}

// RegisterResponse represents the agent registration response
type RegisterResponse struct {
	AgentID       string                 `json:"agent_id"`
	AgentTypeID   string                 `json:"agent_type_id"`
	DataSourceID  string                 `json:"data_source_id"`
	JWTToken      string                 `json:"jwt_token"`
	ExpiresIn     int                    `json:"expires_in"`
	Config        map[string]interface{} `json:"config"`         // Agent type config
	ConfigVersion int                    `json:"config_version"` // Config version number
}

// handleRegister handles agent registration
func handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	// Get organization ID from context (set by API key middleware)
	orgIDHex, ok := ctx.Value(middleware.ContextKeyOrgID).(string)
	if !ok {
		http.Error(w, "Invalid context", http.StatusInternalServerError)
		return
	}

	// Parse request
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.AgentName == "" || req.AgentType == "" || req.Version == "" || req.Platform == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	orgID, err := primitive.ObjectIDFromHex(orgIDHex)
	if err != nil {
		http.Error(w, "Invalid organization ID", http.StatusInternalServerError)
		return
	}

	// Validate agent type ID is provided
	if req.AgentTypeID == "" {
		log.Printf("Agent type ID missing in registration request")
		http.Error(w, "Agent type ID is required. Please download the agent package from the web UI which includes the correct agent type ID.", http.StatusBadRequest)
		return
	}

	// Parse and validate agent type ID
	agentTypeID, err := primitive.ObjectIDFromHex(req.AgentTypeID)
	if err != nil {
		log.Printf("Invalid agent type ID format: %s", req.AgentTypeID)
		http.Error(w, "Invalid agent type ID format", http.StatusBadRequest)
		return
	}

	// Get agent type info (for config and versioning)
	agentType, err := mongoStore.GetAgentTypeByID(ctx, agentTypeID)
	if err != nil || agentType == nil {
		log.Printf("Agent type not found with ID: %s", req.AgentTypeID)
		http.Error(w, fmt.Sprintf("Agent type with ID '%s' not found. Please ensure you downloaded the agent from the web UI.", req.AgentTypeID), http.StatusBadRequest)
		return
	}

	configVersion := agentType.ConfigVersion
	defaultConfig := make(map[string]interface{})

	if agentType.DefaultConfig != nil {
		defaultConfig = agentType.DefaultConfig
	}

	log.Printf("Using agent type: %s (ID: %s)", agentType.Name, agentType.ID.Hex())

	// Check if data source exists for this agent type
	// Data source is created per agent type, not per agent instance
	dataSource, err := mongoStore.GetDataSourceByAgentType(ctx, orgID, req.AgentType)
	if err != nil {
		// Data source doesn't exist, create it WITHOUT schema
		// Schema will be discovered when agent sends first real data
		log.Printf("Creating new data source for agent type: %s", req.AgentType)

		dataSource = &mongo.DataSource{
			OrganizationID: orgID,
			Name:           schema.GenerateSchemaName(req.AgentType),
			Type:           "agent-based",
			AgentType:      req.AgentType,
			Status:         "active",
			Throughput:     0,
			AgentCount:     0,
		}

		if err := mongoStore.CreateDataSource(ctx, dataSource); err != nil {
			log.Printf("Failed to create data source: %v", err)
			http.Error(w, "Failed to create data source", http.StatusInternalServerError)
			return
		}

		log.Printf("Created new data source: %s (type: %s, ID: %s)", dataSource.Name, req.AgentType, dataSource.ID.Hex())
		log.Printf("Schema will be discovered when agent sends first data via /api/v1/pulse")

		// Create root data model for this data source
		rootModel := &mongo.DataModel{
			OrganizationID: orgID,
			Name:           fmt.Sprintf("%s - Root Model", dataSource.Name),
			DataIndex:      req.AgentType, // source.type from agent config
			Type:           "root",
			Version:        1,
			Status:         "active",
			Source: mongo.DataModelSource{
				DataSourceIDs: []primitive.ObjectID{dataSource.ID},
				AgentType:     req.AgentType,
				SourceType:    req.AgentType,
			},
			Schema: mongo.DataModelSchema{
				Fields: []mongo.SchemaField{}, // Will be populated by schema discovery
			},
			ELK: mongo.ELKConfig{
				IndexName: fmt.Sprintf("org_%s__%s__v1", orgID.Hex(), req.AgentType),
			},
			CreatedBy: "system",
		}

		if err := mongoStore.CreateDataModel(ctx, rootModel); err != nil {
			log.Printf("Failed to create root data model: %v", err)
			// Don't fail registration, just log the error
		} else {
			log.Printf("Created root data model: %s (ID: %s)", rootModel.Name, rootModel.ID.Hex())
		}
	}

	// Create agent record
	now := time.Now()
	agent := &mongo.Agent{
		OrganizationID:       orgID,
		AgentTypeID:          agentTypeID,
		DataSourceID:         dataSource.ID,
		Name:                 req.AgentName,
		Version:              req.Version,
		Platform:             req.Platform,
		Status:               "online",
		IPAddress:            r.RemoteAddr,
		Hostname:             req.Hostname,
		Config:               make(map[string]interface{}),
		CurrentConfigVersion: configVersion,
		ConfigLastSyncedAt:   &now,
	}

	if err := mongoStore.CreateAgent(ctx, agent); err != nil {
		log.Printf("Failed to create agent: %v", err)
		http.Error(w, "Failed to create agent", http.StatusInternalServerError)
		return
	}

	// Increment data source agent count
	if err := mongoStore.IncrementDataSourceAgentCount(ctx, dataSource.ID); err != nil {
		log.Printf("Warning: Failed to increment agent count: %v", err)
	}

	// Generate JWT token
	jwtExpiry := 24 * time.Hour
	token, err := auth.GenerateJWT(
		agent.ID.Hex(),
		orgID.Hex(),
		dataSource.ID.Hex(),
		jwtExpiry,
	)
	if err != nil {
		log.Printf("Failed to generate JWT: %v", err)
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Publish agent.registered event
	if eventPublisher != nil {
		eventData := map[string]interface{}{
			"agent_id":        agent.ID.Hex(),
			"agent_name":      req.AgentName,
			"agent_type":      req.AgentType,
			"data_source_id":  dataSource.ID.Hex(),
			"organization_id": orgIDHex,
		}
		if err := eventPublisher.PublishIngestionEvent(ctx, agent.ID.Hex(), "agent.registered", eventData, "success", 0, nil); err != nil {
			log.Printf("Warning: Failed to publish agent.registered event: %v", err)
		}
	}

	// Log to Elasticsearch
	if elasticLogger != nil {
		eventData := map[string]interface{}{
			"agent_id":   agent.ID.Hex(),
			"agent_name": req.AgentName,
			"agent_type": req.AgentType,
		}
		if err := elasticLogger.LogIngestionEvent(ctx, agent.ID.Hex(), "agent.registered", eventData, "success", 0, nil); err != nil {
			log.Printf("Warning: Failed to log to Elasticsearch: %v", err)
		}
	}

	log.Printf("Agent registered: %s (ID: %s, Type: %s)", req.AgentName, agent.ID.Hex(), req.AgentType)

	// Prepare response
	response := RegisterResponse{
		AgentID:       agent.ID.Hex(),
		DataSourceID:  dataSource.ID.Hex(),
		JWTToken:      token,
		ExpiresIn:     int(jwtExpiry.Seconds()),
		Config:        defaultConfig,
		ConfigVersion: configVersion,
	}

	// Add agent type ID if available
	if !agentTypeID.IsZero() {
		response.AgentTypeID = agentTypeID.Hex()
	}

	// Send response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// AgentHealthRequest represents the agent health check request
type AgentHealthRequest struct {
	Status  string                 `json:"status"`
	Metrics map[string]interface{} `json:"metrics"`
}

// AgentHealthResponse represents the agent health check response
type AgentHealthResponse struct {
	Acknowledged bool `json:"acknowledged"`
	NextCheckIn  int  `json:"next_check_in"`
}

// handleAgentHealth handles agent health checks
func handleAgentHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	// Get agent ID from context (set by JWT middleware)
	agentIDHex, ok := ctx.Value(middleware.ContextKeyAgentID).(string)
	if !ok {
		http.Error(w, "Invalid context", http.StatusInternalServerError)
		return
	}

	agentID, err := primitive.ObjectIDFromHex(agentIDHex)
	if err != nil {
		http.Error(w, "Invalid agent ID", http.StatusInternalServerError)
		return
	}

	// Parse request
	var req AgentHealthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Empty body is okay for health check
		req.Status = "online"
	}

	// Update agent heartbeat
	status := req.Status
	if status == "" {
		status = "online"
	}

	if err := mongoStore.UpdateAgentHeartbeat(ctx, agentID, status); err != nil {
		log.Printf("Failed to update agent heartbeat: %v", err)
		http.Error(w, "Failed to update heartbeat", http.StatusInternalServerError)
		return
	}

	// Send response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AgentHealthResponse{
		Acknowledged: true,
		NextCheckIn:  60, // 60 seconds
	})
}

// PulseRequest represents the pulse data request
type PulseRequest struct {
	Events []map[string]interface{} `json:"events"`
}

// PulseResponse represents the pulse data response
type PulseResponse struct {
	Accepted int      `json:"accepted"`
	Rejected int      `json:"rejected"`
	Errors   []string `json:"errors,omitempty"`
}

// handlePulse handles event pulse data from agents
func handlePulse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	// Get claims from context (set by JWT middleware)
	agentIDHex, _ := ctx.Value(middleware.ContextKeyAgentID).(string)
	orgIDHex, _ := ctx.Value(middleware.ContextKeyOrgID).(string)
	dataSourceIDHex, _ := ctx.Value(middleware.ContextKeyDataSourceID).(string)

	agentID, _ := primitive.ObjectIDFromHex(agentIDHex)
	orgID, _ := primitive.ObjectIDFromHex(orgIDHex)
	dataSourceID, _ := primitive.ObjectIDFromHex(dataSourceIDHex)

	// Parse request
	var req PulseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Events) == 0 {
		http.Error(w, "No events provided", http.StatusBadRequest)
		return
	}

	// Get data source schema
	var discoveredSchema *mongo.DiscoveredSchema
	var needsSchemaDiscovery bool

	if mongoStore != nil {
		var err error
		discoveredSchema, err = mongoStore.GetLatestSchemaByDataSource(ctx, dataSourceID)
		if err != nil {
			log.Printf("Schema not found for data source %s: %v - will perform schema discovery", dataSourceIDHex, err)
			needsSchemaDiscovery = true
		}
	} else {
		log.Printf("Warning: MongoDB store not available, skipping schema validation")
	}

	// If schema doesn't exist, perform discovery from incoming events
	if needsSchemaDiscovery && mongoStore != nil {
		log.Printf("Performing schema discovery for data source %s with %d sample events", dataSourceIDHex, len(req.Events))

		newSchema, err := schema.DiscoverSchema(req.Events)
		if err != nil {
			log.Printf("Schema discovery error: %v", err)
			// Continue without schema - we'll accept the events anyway
		} else {
			// Save discovered schema
			newSchema.DataSourceID = dataSourceID
			if err := mongoStore.CreateDiscoveredSchema(ctx, newSchema); err != nil {
				log.Printf("Failed to save discovered schema: %v", err)
			} else {
				log.Printf("Successfully discovered and saved schema (ID: %s) with %d fields", newSchema.ID.Hex(), len(newSchema.Fields))

				// Update data source with schema ID
				dataSource, err := mongoStore.GetDataSourceByID(ctx, dataSourceID)
				if err == nil && dataSource != nil {
					dataSource.SchemaID = newSchema.ID
					if err := mongoStore.UpdateDataSource(ctx, dataSource); err != nil {
						log.Printf("Warning: Failed to update data source with schema ID: %v", err)
					}

					// Find root data model for this data source and create attributes
					rootModel, err := mongoStore.GetDataModelByDataIndex(ctx, orgID, dataSource.AgentType)
					if err == nil && rootModel != nil {
						log.Printf("Found root model %s for data source, creating attributes from schema", rootModel.ID.Hex())
						if err := mongoStore.CreateDataModelAttributesFromSchema(ctx, rootModel.ID, newSchema.Fields, "system"); err != nil {
							log.Printf("Warning: Failed to create data model attributes: %v", err)
						} else {
							log.Printf("Successfully created %d attributes for data model %s", len(newSchema.Fields), rootModel.ID.Hex())
						}
					} else {
						log.Printf("Warning: Could not find root model for data source %s: %v", dataSource.AgentType, err)
					}
				}

				// Use the newly discovered schema for validation
				discoveredSchema = newSchema
			}
		}
	}

	// Validate and store events
	accepted := 0
	rejected := 0
	var errors []string
	var ingestedEvents []*mongo.IngestedEvent

	for i, event := range req.Events {
		// Validate against schema
		if discoveredSchema != nil {
			if err := schema.ValidateAgainstSchema(event, discoveredSchema); err != nil {
				rejected++
				errors = append(errors, fmt.Sprintf("Event %d: %v", i, err))
				continue
			}
		}

		// Normalize event - add canonical fields for Live Monitor
		normalizeEvent(event)

		// Create ingested event
		eventID := generateEventID()
		ingestedEvent := &mongo.IngestedEvent{
			EventID:        eventID,
			OrganizationID: orgID,
			DataSourceID:   dataSourceID,
			AgentID:        agentID,
			TenantID:       orgIDHex,
			Type:           "agent-event",
			Source:         agentIDHex,
			Payload:        event,
			Attributes:     make(map[string]interface{}),
		}

		ingestedEvents = append(ingestedEvents, ingestedEvent)
		accepted++
	}

	// Bulk insert to MongoDB
	if len(ingestedEvents) > 0 {
		if mongoStore != nil {
			if err := mongoStore.StoreEventsBatch(ctx, ingestedEvents); err != nil {
				log.Printf("Failed to store events: %v", err)
				// Don't fail the request if MongoDB is unavailable
			}
		} else {
			log.Printf("Warning: MongoDB store not available, events not persisted to database")
		}

		// Publish to Kafka with full event metadata
		for _, evt := range ingestedEvents {
			// Extract timestamp from payload (try ts, @ts, timestamp)
			var eventTimestamp time.Time
			if ts, ok := evt.Payload["ts"].(string); ok {
				if parsed, err := time.Parse(time.RFC3339, ts); err == nil {
					eventTimestamp = parsed
				}
			} else if ts, ok := evt.Payload["@ts"].(string); ok {
				if parsed, err := time.Parse(time.RFC3339, ts); err == nil {
					eventTimestamp = parsed
				}
			} else if ts, ok := evt.Payload["timestamp"].(string); ok {
				if parsed, err := time.Parse(time.RFC3339, ts); err == nil {
					eventTimestamp = parsed
				}
			}

			// Fallback to ingested_at if no valid timestamp found
			if eventTimestamp.IsZero() {
				eventTimestamp = evt.IngestedAt
			}

			// Include organization_id and data_source_id in Kafka message
			kafkaEvent := map[string]interface{}{
				"event_id":        evt.EventID,
				"organization_id": evt.OrganizationID.Hex(),
				"data_source_id":  evt.DataSourceID.Hex(),
				"agent_id":        evt.AgentID.Hex(),
				"tenant_id":       evt.TenantID,
				"type":            evt.Type,
				"source":          evt.Source,
				"payload":         evt.Payload,
				"attributes":      evt.Attributes,
				"ingested_at":     evt.IngestedAt,
				"timestamp":       eventTimestamp,
			}

			eventBytes, _ := json.Marshal(kafkaEvent)
			msg := kafka.Message{
				Key:   []byte(evt.EventID),
				Value: eventBytes,
				Time:  time.Now(),
			}

			if err := kafkaWriter.WriteMessages(ctx, msg); err != nil {
				log.Printf("Warning: Failed to write event to Kafka: %v", err)
			}
		}

		// Log to Elasticsearch
		if elasticLogger != nil {
			for _, evt := range ingestedEvents {
				source := fmt.Sprintf("%v", evt.Source)
				if err := elasticLogger.LogIngestionEvent(ctx, evt.EventID, source, evt.Payload, "success", 0, nil); err != nil {
					log.Printf("Warning: Failed to log to Elasticsearch: %v", err)
				}
			}
		}

		// Update agent status to online (agent is actively sending data)
		if mongoStore != nil && !agentID.IsZero() {
			if err := mongoStore.UpdateAgentStatus(ctx, agentID, "online"); err != nil {
				log.Printf("Warning: Failed to update agent status: %v", err)
			}
		}

		// Update data source throughput
		if mongoStore != nil {
			throughput := len(ingestedEvents)
			if err := mongoStore.UpdateDataSourceThroughput(ctx, dataSourceID, throughput); err != nil {
				log.Printf("Warning: Failed to update throughput: %v", err)
			}
		}
	}

	log.Printf("Pulse processed: %d accepted, %d rejected from agent %s", accepted, rejected, agentIDHex)

	// Send response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PulseResponse{
		Accepted: accepted,
		Rejected: rejected,
		Errors:   errors,
	})
}

// AgentConfigResponse represents the agent config response
type AgentConfigResponse struct {
	Version    int                    `json:"version"`
	UpdatedAt  string                 `json:"updated_at"`
	UpdatedBy  string                 `json:"updated_by"`
	Changes    map[string]interface{} `json:"changes,omitempty"`
	FullConfig map[string]interface{} `json:"full_config,omitempty"`
}

// handleAgentConfig handles agent configuration sync
func handleAgentConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	// Get agent ID from context (set by JWT middleware)
	agentIDHex, ok := ctx.Value(middleware.ContextKeyAgentID).(string)
	if !ok {
		http.Error(w, "Invalid context", http.StatusInternalServerError)
		return
	}

	agentID, err := primitive.ObjectIDFromHex(agentIDHex)
	if err != nil {
		http.Error(w, "Invalid agent ID", http.StatusInternalServerError)
		return
	}

	// Get agent from database
	agent, err := mongoStore.GetAgentByID(ctx, agentID)
	if err != nil {
		http.Error(w, "Agent not found", http.StatusNotFound)
		return
	}

	// Get agent type to check for config updates
	var agentType *mongo.AgentType
	if !agent.AgentTypeID.IsZero() {
		agentType, err = mongoStore.GetAgentTypeByID(ctx, agent.AgentTypeID)
		if err != nil {
			log.Printf("Warning: Failed to get agent type: %v", err)
		}
	}

	// Check if agent type config is newer than agent's current config
	if agentType != nil {
		currentVersion := agent.CurrentConfigVersion
		latestVersion := agentType.ConfigVersion

		// If agent has older version or no version, return new config
		if latestVersion > currentVersion {
			var updatedAt string
			if agentType.ConfigUpdatedAt != nil {
				updatedAt = agentType.ConfigUpdatedAt.UTC().Format(time.RFC3339)
			} else {
				updatedAt = time.Now().UTC().Format(time.RFC3339)
			}

			resp := AgentConfigResponse{
				Version:    latestVersion,
				UpdatedAt:  updatedAt,
				UpdatedBy:  agentType.ConfigUpdatedBy,
				FullConfig: agentType.DefaultConfig,
			}

			// Update agent's config version
			now := time.Now()
			agent.CurrentConfigVersion = latestVersion
			agent.ConfigLastSyncedAt = &now
			if err := mongoStore.UpdateAgent(ctx, agent); err != nil {
				log.Printf("Warning: Failed to update agent config version: %v", err)
			}

			log.Printf("Sending config update to agent %s: version %d -> %d", agentIDHex, currentVersion, latestVersion)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
	}

	// No updates
	w.WriteHeader(http.StatusNotModified)
}
