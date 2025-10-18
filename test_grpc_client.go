package main

import (
	"context"
	"fmt"
	"log"
	"time"

	ingestionv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/dna/ingestion/v1"
	eventv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/event/v1"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func main() {
	// Connect to gRPC server
	conn, err := grpc.Dial("localhost:9090", grpc.WithInsecure())
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	// Create client
	client := ingestionv1.NewIngestionServiceClient(conn)

	// Create test event
	event := &eventv1.Event{
		EventId: "test-event-123",
		Source:  "test-agent",
		Type:    eventv1.EventType_EVENT_TYPE_METRIC,
		Ts:      timestamppb.New(time.Now()),
		Attributes: map[string]string{
			"tenant_id": "test-tenant",
		},
		Body: &eventv1.Event_Metric{
			Metric: &eventv1.MetricBody{
				Name:  "cpu_usage",
				Value: 75.5,
				Unit:  "percent",
			},
		},
	}

	// Create ingest request
	req := &ingestionv1.IngestRequest{
		RequestId:  "req-123",
		TenantId:   "test-tenant",
		Event:      event,
		Metadata:   map[string]string{"test": "true"},
		ReceivedAt: timestamppb.New(time.Now()),
	}

	// Call gRPC method
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := client.Ingest(ctx, req)
	if err != nil {
		log.Fatalf("gRPC call failed: %v", err)
	}

	fmt.Printf("Response: %+v\n", resp)
}
