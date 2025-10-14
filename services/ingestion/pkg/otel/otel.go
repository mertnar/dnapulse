package otel

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/metric/noop"
	"go.opentelemetry.io/otel/propagation"
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
	Tracer    trace.Tracer
	Meter     metric.Meter
	Counter   metric.Int64Counter
	Histogram metric.Float64Histogram
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
	tracer, err := initTracer(ctx, res, cfg.JaegerEndpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize tracer: %w", err)
	}

	// Initialize meter
	meter, err := initMeter(ctx, res, cfg.PrometheusPort)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize meter: %w", err)
	}

	// Create metrics
	counter, err := meter.Int64Counter(
		"requests_total",
		metric.WithDescription("Total number of requests"),
		metric.WithUnit("1"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create counter: %w", err)
	}

	histogram, err := meter.Float64Histogram(
		"request_duration_seconds",
		metric.WithDescription("Request duration in seconds"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create histogram: %w", err)
	}

	return &Telemetry{
		Tracer:    tracer,
		Meter:     meter,
		Counter:   counter,
		Histogram: histogram,
	}, nil
}

func initTracer(ctx context.Context, res *resource.Resource, jaegerEndpoint string) (trace.Tracer, error) {
	// Create Jaeger exporter
	var exp sdktrace.SpanExporter
	var err error

	if jaegerEndpoint != "" {
		exp, err = jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(jaegerEndpoint)))
		if err != nil {
			return nil, fmt.Errorf("failed to create Jaeger exporter: %w", err)
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

	return tp.Tracer("dna-platform"), nil
}

func initMeter(ctx context.Context, res *resource.Resource, prometheusPort string) (metric.Meter, error) {
	if prometheusPort == "" {
		// Use noop meter for development
		return noop.NewMeterProvider().Meter("dna-platform"), nil
	}

	// Create Prometheus exporter
	exporter, err := prometheus.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus exporter: %w", err)
	}

	// Start Prometheus metrics server
	go func() {
		mux := http.NewServeMux()
		mux.Handle("/metrics", exporter)

		server := &http.Server{
			Addr:    ":" + prometheusPort,
			Handler: mux,
		}

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Failed to start metrics server: %v\n", err)
		}
	}()

	return exporter.MeterProvider().Meter("dna-platform"), nil
}

func (t *Telemetry) HTTPMiddleware(next http.Handler) http.Handler {
	return otelhttp.NewHandler(next, "http-server",
		otelhttp.WithTracerProvider(t.Tracer.(*sdktrace.TracerProvider)),
	)
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
