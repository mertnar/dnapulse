package observability

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Metrics holds all Prometheus metrics
type Metrics struct {
	EventsTotal        *prometheus.CounterVec
	RuleLatency        *prometheus.HistogramVec
	DLQTotal           prometheus.Counter
	PipelineExecutions *prometheus.HistogramVec
}

// NewMetrics creates and registers Prometheus metrics
func NewMetrics() *Metrics {
	return &Metrics{
		EventsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "dna_processing_events_total",
				Help: "Total number of events processed",
			},
			[]string{"status"}, // status: success, error, dlq
		),
		RuleLatency: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "dna_processing_rule_latency_seconds",
				Help:    "Rule execution latency in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"rule"},
		),
		DLQTotal: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "dna_processing_dlq_total",
				Help: "Total number of events sent to DLQ",
			},
		),
		PipelineExecutions: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "dna_processing_pipeline_latency_seconds",
				Help:    "Pipeline execution latency in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"status"},
		),
	}
}

// RecordEventSuccess records a successful event processing
func (m *Metrics) RecordEventSuccess() {
	m.EventsTotal.WithLabelValues("success").Inc()
}

// RecordEventError records an event processing error
func (m *Metrics) RecordEventError() {
	m.EventsTotal.WithLabelValues("error").Inc()
}

// RecordDLQ records a DLQ event
func (m *Metrics) RecordDLQ() {
	m.EventsTotal.WithLabelValues("dlq").Inc()
	m.DLQTotal.Inc()
}

// RecordRuleLatency records rule execution latency
func (m *Metrics) RecordRuleLatency(rule string, seconds float64) {
	m.RuleLatency.WithLabelValues(rule).Observe(seconds)
}

// RecordPipelineLatency records pipeline execution latency
func (m *Metrics) RecordPipelineLatency(status string, seconds float64) {
	m.PipelineExecutions.WithLabelValues(status).Observe(seconds)
}
