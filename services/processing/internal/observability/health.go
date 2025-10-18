package observability

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

// HealthStatus represents service health status
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusDegraded  HealthStatus = "degraded"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
)

// HealthCheck manages service health
type HealthCheck struct {
	mu          sync.RWMutex
	status      HealthStatus
	checks      map[string]CheckFunc
	lastChecked time.Time
}

// CheckFunc is a health check function
type CheckFunc func() error

// NewHealthCheck creates a new health check manager
func NewHealthCheck() *HealthCheck {
	return &HealthCheck{
		status:      HealthStatusHealthy,
		checks:      make(map[string]CheckFunc),
		lastChecked: time.Now(),
	}
}

// Register registers a health check
func (h *HealthCheck) Register(name string, check CheckFunc) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.checks[name] = check
}

// Check runs all health checks and updates status
func (h *HealthCheck) Check() {
	h.mu.Lock()
	defer h.mu.Unlock()

	healthy := true
	for _, check := range h.checks {
		if err := check(); err != nil {
			healthy = false
			break
		}
	}

	if healthy {
		h.status = HealthStatusHealthy
	} else {
		h.status = HealthStatusUnhealthy
	}

	h.lastChecked = time.Now()
}

// Status returns the current health status
func (h *HealthCheck) Status() HealthStatus {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.status
}

// HealthHandler returns an HTTP handler for health checks
func (h *HealthCheck) HealthHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h.Check()

		status := h.Status()
		statusCode := http.StatusOK
		if status == HealthStatusUnhealthy {
			statusCode = http.StatusServiceUnavailable
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":       status,
			"last_checked": h.lastChecked,
		})
	}
}

// ReadyHandler returns an HTTP handler for readiness checks
func (h *HealthCheck) ReadyHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := h.Status()

		if status == HealthStatusHealthy {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("ready"))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("not ready"))
		}
	}
}
