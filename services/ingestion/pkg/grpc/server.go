package grpc

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	ingestionv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/dna/ingestion/v1"
	eventv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/event/v1"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/config"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/ratelimit"
	"github.com/segmentio/kafka-go"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// IngestionServer implements the gRPC IngestionService
type IngestionServer struct {
	ingestionv1.UnimplementedIngestionServiceServer
	kafkaWriter   *kafka.Writer
	configManager *config.ConfigManager
	rateLimiter   *ratelimit.TokenBucket
}

// NewIngestionServer creates a new gRPC ingestion server
func NewIngestionServer(
	kafkaWriter *kafka.Writer,
	configManager *config.ConfigManager,
	rateLimiter *ratelimit.TokenBucket,
) *IngestionServer {
	return &IngestionServer{
		kafkaWriter:   kafkaWriter,
		configManager: configManager,
		rateLimiter:   rateLimiter,
	}
}

// Ingest handles single event ingestion
func (s *IngestionServer) Ingest(ctx context.Context, req *ingestionv1.IngestRequest) (*ingestionv1.IngestResponse, error) {
	startTime := time.Now()

	// Rate limiting
	if !s.rateLimiter.Allow() {
		return &ingestionv1.IngestResponse{
			Status:           ingestionv1.IngestStatus_INGEST_STATUS_RATE_LIMITED,
			ErrorMessage:     "Rate limit exceeded",
			ProcessingTimeMs: time.Since(startTime).Milliseconds(),
		}, nil
	}

	// Validate request
	if err := s.validateIngestRequest(req); err != nil {
		return &ingestionv1.IngestResponse{
			Status:           ingestionv1.IngestStatus_INGEST_STATUS_INVALID,
			ErrorMessage:     err.Error(),
			ProcessingTimeMs: time.Since(startTime).Milliseconds(),
		}, nil
	}

	// Check if source is allowed
	if !s.configManager.IsSourceAllowed(req.Event.Source) {
		return &ingestionv1.IngestResponse{
			Status:           ingestionv1.IngestStatus_INGEST_STATUS_REJECTED,
			ErrorMessage:     "Source not allowed",
			ProcessingTimeMs: time.Since(startTime).Milliseconds(),
		}, nil
	}

	// Generate event ID if not provided
	eventID := req.Event.EventId
	if eventID == "" {
		eventID = generateEventID()
	}

	// Create Kafka message
	eventBytes, err := s.createKafkaMessage(req.Event, eventID)
	if err != nil {
		log.Printf("Failed to create Kafka message: %v", err)
		return &ingestionv1.IngestResponse{
			Status:           ingestionv1.IngestStatus_INGEST_STATUS_REJECTED,
			ErrorMessage:     "Failed to serialize event",
			ProcessingTimeMs: time.Since(startTime).Milliseconds(),
		}, nil
	}

	// Send to Kafka
	msg := kafka.Message{
		Key:   []byte(eventID),
		Value: eventBytes,
		Time:  time.Now(),
	}

	if err := s.kafkaWriter.WriteMessages(ctx, msg); err != nil {
		log.Printf("Failed to write to Kafka: %v", err)
		return &ingestionv1.IngestResponse{
			Status:           ingestionv1.IngestStatus_INGEST_STATUS_REJECTED,
			ErrorMessage:     "Failed to process event",
			ProcessingTimeMs: time.Since(startTime).Milliseconds(),
		}, nil
	}

	log.Printf("Event ingested (gRPC): %s from %s", eventID, req.Event.Source)

	return &ingestionv1.IngestResponse{
		Status:           ingestionv1.IngestStatus_INGEST_STATUS_ACCEPTED,
		EventId:          eventID,
		ProcessingTimeMs: time.Since(startTime).Milliseconds(),
	}, nil
}

// BatchIngest handles batch event ingestion
func (s *IngestionServer) BatchIngest(ctx context.Context, req *ingestionv1.BatchIngestRequest) (*ingestionv1.BatchIngestResponse, error) {

	// Rate limiting for batch (check per event)
	if !s.rateLimiter.Allow() {
		return &ingestionv1.BatchIngestResponse{
			Total:    int32(len(req.Events)),
			Accepted: 0,
			Rejected: int32(len(req.Events)),
			Results: []*ingestionv1.IngestResponse{{
				Status:       ingestionv1.IngestStatus_INGEST_STATUS_RATE_LIMITED,
				ErrorMessage: "Rate limit exceeded",
			}},
		}, nil
	}

	var results []*ingestionv1.IngestResponse
	var accepted, rejected int32

	// Process each event
	for _, event := range req.Events {
		eventStartTime := time.Now()

		// Validate event
		if err := s.validateEvent(event); err != nil {
			results = append(results, &ingestionv1.IngestResponse{
				Status:           ingestionv1.IngestStatus_INGEST_STATUS_INVALID,
				ErrorMessage:     err.Error(),
				ProcessingTimeMs: time.Since(eventStartTime).Milliseconds(),
			})
			rejected++
			continue
		}

		// Check if source is allowed
		if !s.configManager.IsSourceAllowed(event.Source) {
			results = append(results, &ingestionv1.IngestResponse{
				Status:           ingestionv1.IngestStatus_INGEST_STATUS_REJECTED,
				ErrorMessage:     "Source not allowed",
				ProcessingTimeMs: time.Since(eventStartTime).Milliseconds(),
			})
			rejected++
			continue
		}

		// Generate event ID if not provided
		eventID := event.EventId
		if eventID == "" {
			eventID = generateEventID()
		}

		// Create Kafka message
		eventBytes, err := s.createKafkaMessage(event, eventID)
		if err != nil {
			results = append(results, &ingestionv1.IngestResponse{
				Status:           ingestionv1.IngestStatus_INGEST_STATUS_REJECTED,
				ErrorMessage:     "Failed to serialize event",
				ProcessingTimeMs: time.Since(eventStartTime).Milliseconds(),
			})
			rejected++
			continue
		}

		// Send to Kafka
		msg := kafka.Message{
			Key:   []byte(eventID),
			Value: eventBytes,
			Time:  time.Now(),
		}

		if err := s.kafkaWriter.WriteMessages(ctx, msg); err != nil {
			log.Printf("Failed to write event %s to Kafka: %v", eventID, err)
			results = append(results, &ingestionv1.IngestResponse{
				Status:           ingestionv1.IngestStatus_INGEST_STATUS_REJECTED,
				ErrorMessage:     "Failed to process event",
				ProcessingTimeMs: time.Since(eventStartTime).Milliseconds(),
			})
			rejected++
			continue
		}

		results = append(results, &ingestionv1.IngestResponse{
			Status:           ingestionv1.IngestStatus_INGEST_STATUS_ACCEPTED,
			EventId:          eventID,
			ProcessingTimeMs: time.Since(eventStartTime).Milliseconds(),
		})
		accepted++
	}

	log.Printf("Batch ingested: %d accepted, %d rejected", accepted, rejected)

	return &ingestionv1.BatchIngestResponse{
		Total:    int32(len(req.Events)),
		Accepted: accepted,
		Rejected: rejected,
		Results:  results,
	}, nil
}

// StreamIngest handles streaming event ingestion
func (s *IngestionServer) StreamIngest(stream ingestionv1.IngestionService_StreamIngestServer) error {
	var results []*ingestionv1.IngestResponse
	var accepted, rejected int32

	for {
		req, err := stream.Recv()
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			return status.Errorf(codes.Internal, "Failed to receive stream: %v", err)
		}

		// Process single event
		resp, err := s.Ingest(stream.Context(), req)
		if err != nil {
			return status.Errorf(codes.Internal, "Failed to process event: %v", err)
		}

		results = append(results, resp)
		if resp.Status == ingestionv1.IngestStatus_INGEST_STATUS_ACCEPTED {
			accepted++
		} else {
			rejected++
		}
	}

	// Send final response
	return stream.SendAndClose(&ingestionv1.BatchIngestResponse{
		Total:    int32(len(results)),
		Accepted: accepted,
		Rejected: rejected,
		Results:  results,
	})
}

// validateIngestRequest validates the ingest request
func (s *IngestionServer) validateIngestRequest(req *ingestionv1.IngestRequest) error {
	if req == nil {
		return fmt.Errorf("request cannot be nil")
	}
	if req.Event == nil {
		return fmt.Errorf("event cannot be nil")
	}
	return s.validateEvent(req.Event)
}

// validateEvent validates an event
func (s *IngestionServer) validateEvent(event *eventv1.Event) error {
	if event == nil {
		return fmt.Errorf("event cannot be nil")
	}
	if event.Source == "" {
		return fmt.Errorf("event source cannot be empty")
	}
	if event.Type == 0 {
		return fmt.Errorf("event type cannot be empty")
	}
	return nil
}

// createKafkaMessage creates a Kafka message from an event
func (s *IngestionServer) createKafkaMessage(event *eventv1.Event, eventID string) ([]byte, error) {
	// Convert protobuf event to JSON for Kafka
	jsonEvent := map[string]interface{}{
		"event_id":   eventID,
		"source":     event.Source,
		"type":       fmt.Sprintf("EVENT_TYPE_%d", event.Type),
		"ts":         event.Ts.AsTime().Format(time.RFC3339),
		"attributes": event.Attributes,
	}

	// Add metric data if present
	if metric, ok := event.Body.(*eventv1.Event_Metric); ok {
		jsonEvent["metric"] = map[string]interface{}{
			"name":  metric.Metric.Name,
			"value": metric.Metric.Value,
			"unit":  metric.Metric.Unit,
		}
	}

	// Add log data if present
	if log, ok := event.Body.(*eventv1.Event_Log); ok {
		jsonEvent["log"] = map[string]interface{}{
			"message": log.Log.Message,
			"level":   log.Log.Level,
		}
	}

	// Add text data if present (if available)
	// Note: TextBody support will be added when proto generation is fixed

	// Serialize to JSON
	eventBytes, err := json.Marshal(jsonEvent)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal event to JSON: %w", err)
	}

	return eventBytes, nil
}

// generateEventID generates a unique event ID
func generateEventID() string {
	return fmt.Sprintf("evt_%d", time.Now().UnixNano())
}
