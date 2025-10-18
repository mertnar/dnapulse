package otel

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

type Config struct {
	ServiceName    string
	ServiceVersion string
	JaegerEndpoint string
	PrometheusPort string
}

type Telemetry struct {
	Tracer         trace.Tracer
	TracerProvider trace.TracerProvider
	Meter          metric.Meter
	Counter        metric.Int64Counter
	Histogram      metric.Float64Histogram
	PrometheusMux  *http.ServeMux
}

func InitTelemetry(cfg Config) (*Telemetry, error) {
	ctx := context.Background()

	// Create resource
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(cfg.ServiceName),
			semconv.ServiceVersionKey.String(cfg.ServiceVersion),
			semconv.DeploymentEnvironmentKey.String(getEnv("ENVIRONMENT", "development")),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Initialize tracer
	tracer, tp, err := initTracer(ctx, res, cfg.JaegerEndpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize tracer: %w", err)
	}

	// Initialize meter with Prometheus
	meter, prometheusMux, err := initMeter(ctx, res, cfg.PrometheusPort)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize meter: %w", err)
	}

	// Create metrics
	counter, err := meter.Int64Counter(
		"dna_ingestion_events_total",
		metric.WithDescription("Total number of ingested events"),
		metric.WithUnit("1"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create counter: %w", err)
	}

	histogram, err := meter.Float64Histogram(
		"dna_ingestion_duration_seconds",
		metric.WithDescription("Duration of ingestion operations"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create histogram: %w", err)
	}

	return &Telemetry{
		Tracer:         tracer,
		TracerProvider: tp,
		Meter:          meter,
		Counter:        counter,
		Histogram:      histogram,
		PrometheusMux:  prometheusMux,
	}, nil
}

func initTracer(ctx context.Context, res *resource.Resource, jaegerEndpoint string) (trace.Tracer, trace.TracerProvider, error) {
	// Create Jaeger exporter
	var exp sdktrace.SpanExporter
	var err error

	if jaegerEndpoint != "" {
		exp, err = jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(jaegerEndpoint)))
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create Jaeger exporter: %w", err)
		}
	} else {
		// Use noop exporter for development
		exp = &noopSpanExporter{}
	}

	// Create trace provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.TraceIDRatioBased(0.1)), // 10% sampling
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return tp.Tracer("dna-platform"), tp, nil
}

func initMeter(ctx context.Context, res *resource.Resource, prometheusPort string) (metric.Meter, *http.ServeMux, error) {
	// Create Prometheus exporter
	exporter, err := prometheus.New()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create prometheus exporter: %w", err)
	}

	// Create meter provider with Prometheus exporter
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(exporter),
	)

	// Set global meter provider
	otel.SetMeterProvider(meterProvider)

	// Create HTTP mux for metrics endpoint
	mux := http.NewServeMux()
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		// Simple metrics endpoint - in production, use proper Prometheus exporter
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("# Prometheus metrics endpoint\n# This is a placeholder - implement proper metrics collection\n"))
	})

	// Start metrics server in background
	go func() {
		server := &http.Server{
			Addr:    ":" + prometheusPort,
			Handler: mux,
		}
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Failed to start metrics server: %v\n", err)
		}
	}()

	return meterProvider.Meter("dna-platform"), mux, nil
}

func (t *Telemetry) HTTPMiddleware(next interface{}) interface{} {
	// Simplified middleware for now
	return next
}

func (t *Telemetry) RecordRequest(method, path string, statusCode int, duration float64) {
	attrs := []attribute.KeyValue{
		attribute.String("method", method),
		attribute.String("path", path),
		attribute.Int("status_code", statusCode),
	}

	t.Counter.Add(context.Background(), 1, metric.WithAttributes(attrs...))
	t.Histogram.Record(context.Background(), duration, metric.WithAttributes(attrs...))
}

func (t *Telemetry) RecordKafkaMessage(topic string, partition int, offset int64) {
	attrs := []attribute.KeyValue{
		attribute.String("topic", topic),
		attribute.Int("partition", partition),
	}

	t.Counter.Add(context.Background(), 1, metric.WithAttributes(attrs...))
}

func (t *Telemetry) RecordProcessingError(service, operation string, err error) {
	attrs := []attribute.KeyValue{
		attribute.String("service", service),
		attribute.String("operation", operation),
		attribute.String("error", err.Error()),
	}

	t.Counter.Add(context.Background(), 1, metric.WithAttributes(attrs...))
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Noop span exporter for development
type noopSpanExporter struct{}

func (e *noopSpanExporter) ExportSpans(ctx context.Context, spans []sdktrace.ReadOnlySpan) error {
	return nil
}

func (e *noopSpanExporter) Shutdown(ctx context.Context) error {
	return nil
}
