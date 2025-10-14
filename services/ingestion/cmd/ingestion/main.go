package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/dnasol/dna-platform/services/ingestion/pkg/config"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/ratelimit"
	"github.com/golang-jwt/jwt/v5"
	"github.com/segmentio/kafka-go"
)

type IngestRequest struct {
	Metric string  `json:"metric"`
	Value  float64 `json:"value"`
	Source string  `json:"source"`
}

var (
	kafkaWriter   *kafka.Writer
	configManager *config.ConfigManager
	rateLimiter   *ratelimit.TokenBucket
)

func main() {
	// Configuration from environment
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	kafkaTopic := getEnv("KAFKA_TOPIC", "ingestion.raw.v1")
	httpPort := getEnv("HTTP_PORT", "8080")

	// Initialize configuration manager
	configManager = config.NewConfigManager()
	log.Printf("Config manager initialized")

	// Load initial configuration
	ctx := context.Background()
	if err := configManager.LoadConfig(ctx); err != nil {
		log.Printf("Warning: Failed to load initial config: %v", err)
		log.Printf("Using default configuration")
	}

	// Initialize rate limiter with config
	rateLimitRPS := configManager.GetRateLimitRPS()
	rateLimiter = ratelimit.NewTokenBucket(int64(rateLimitRPS*2), int64(rateLimitRPS)) // 2x capacity, refill at RPS rate

	// Initialize Kafka writer
	kafkaWriter = &kafka.Writer{
		Addr:         kafka.TCP(kafkaBrokers),
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
	log.Printf("JWT validation: %s", getEnv("JWT_ISSUER", "disabled"))
	log.Printf("Rate limit: %d RPS", rateLimitRPS)

	// HTTP server setup
	mux := http.NewServeMux()
	mux.HandleFunc("/ingest", jwtMiddleware(handleIngest))
	mux.HandleFunc("/health", handleHealth)

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

	// Start hot reload in background
	go func() {
		log.Printf("Starting config hot reload...")
		if err := configManager.StartHotReload(ctx); err != nil {
			log.Printf("Config hot reload error: %v", err)
		}
	}()

	// Start HTTP server
	go func() {
		log.Printf("HTTP server listening on :%s", httpPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
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

	log.Printf("Event ingested (protobuf): %s - %s=%.2f from %s", eventID, req.Metric, req.Value, req.Source)

	// Send response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{
		"event_id": eventID,
		"status":   "accepted",
		"format":   "json",
	})
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
