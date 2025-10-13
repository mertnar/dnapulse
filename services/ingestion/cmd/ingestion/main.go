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

	eventv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/event/v1"
	"github.com/golang-jwt/jwt/v5"
	"github.com/segmentio/kafka-go"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type IngestRequest struct {
	Metric string  `json:"metric"`
	Value  float64 `json:"value"`
	Source string  `json:"source"`
}

var kafkaWriter *kafka.Writer

func main() {
	// Configuration from environment
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	kafkaTopic := getEnv("KAFKA_TOPIC", "ingestion.raw.v1")
	httpPort := getEnv("HTTP_PORT", "8080")

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

	// HTTP server setup
	mux := http.NewServeMux()
	mux.HandleFunc("/ingest", jwtMiddleware(handleIngest))
	mux.HandleFunc("/health", handleHealth)

	server := &http.Server{
		Addr:         ":" + httpPort,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

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

	// Read request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Parse JSON request
	var req IngestRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Create protobuf Event
	eventID := generateEventID()
	event := &eventv1.Event{
		EventId: eventID,
		Source:  req.Source,
		Type:    eventv1.EventType_METRIC,
		Ts:      timestamppb.Now(),
		Attributes: map[string]string{
			"ingestion_ts": time.Now().Format(time.RFC3339),
		},
		Body: &eventv1.Event_Metric{
			Metric: &eventv1.MetricBody{
				Name:  req.Metric,
				Value: req.Value,
				Unit:  "",
			},
		},
	}

	// Serialize to protobuf binary
	eventBytes, err := proto.Marshal(event)
	if err != nil {
		log.Printf("Failed to marshal protobuf: %v", err)
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
		"format":   "protobuf",
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
		"format": "protobuf",
	})
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
