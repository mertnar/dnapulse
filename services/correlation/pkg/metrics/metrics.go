package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds all the Prometheus metrics for the correlation service
type Metrics struct {
	EventsProcessed     prometheus.Counter
	CorrelationsEmitted prometheus.Counter
	ProcessingDuration  prometheus.Histogram
	ActiveBuckets       prometheus.Gauge
	WindowEvictions     prometheus.Counter
	ConfigReloads       prometheus.Counter
	ProcessingErrors    prometheus.Counter
}

// NewMetrics creates a new Metrics instance
func NewMetrics() *Metrics {
	return &Metrics{
		EventsProcessed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "correlation_events_processed_total",
			Help: "Total number of events processed by correlation service",
		}),
		CorrelationsEmitted: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "correlation_correlations_emitted_total",
			Help: "Total number of correlation records emitted",
		}),
		ProcessingDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "correlation_processing_duration_seconds",
			Help:    "Time spent processing events",
			Buckets: prometheus.DefBuckets,
		}),
		ActiveBuckets: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "correlation_active_buckets",
			Help: "Number of active correlation buckets",
		}),
		WindowEvictions: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "correlation_window_evictions_total",
			Help: "Total number of window evictions performed",
		}),
		ConfigReloads: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "correlation_config_reloads_total",
			Help: "Total number of configuration reloads",
		}),
		ProcessingErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "correlation_processing_errors_total",
			Help: "Total number of processing errors",
		}),
	}
}

// Register registers all metrics with the default registry
func (m *Metrics) Register() {
	prometheus.MustRegister(
		m.EventsProcessed,
		m.CorrelationsEmitted,
		m.ProcessingDuration,
		m.ActiveBuckets,
		m.WindowEvictions,
		m.ConfigReloads,
		m.ProcessingErrors,
	)
}

// Handler returns the HTTP handler for metrics endpoint
func (m *Metrics) Handler() http.Handler {
	return promhttp.Handler()
}

// RecordEventProcessed increments the events processed counter
func (m *Metrics) RecordEventProcessed() {
	m.EventsProcessed.Inc()
}

// RecordCorrelationEmitted increments the correlations emitted counter
func (m *Metrics) RecordCorrelationEmitted() {
	m.CorrelationsEmitted.Inc()
}

// RecordProcessingDuration records the processing duration
func (m *Metrics) RecordProcessingDuration(duration float64) {
	m.ProcessingDuration.Observe(duration)
}

// SetActiveBuckets sets the number of active buckets
func (m *Metrics) SetActiveBuckets(count float64) {
	m.ActiveBuckets.Set(count)
}

// RecordWindowEviction increments the window evictions counter
func (m *Metrics) RecordWindowEviction() {
	m.WindowEvictions.Inc()
}

// RecordConfigReload increments the config reloads counter
func (m *Metrics) RecordConfigReload() {
	m.ConfigReloads.Inc()
}

// RecordProcessingError increments the processing errors counter
func (m *Metrics) RecordProcessingError() {
	m.ProcessingErrors.Inc()
}
