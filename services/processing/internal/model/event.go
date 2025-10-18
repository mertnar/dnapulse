package model

import (
	"time"
)

// EventKind defines the type of event
type EventKind string

const (
	EventKindMetric EventKind = "metric"
	EventKindLog    EventKind = "log"
	EventKindTrace  EventKind = "trace"
	EventKindAlert  EventKind = "alert"
)

// Event represents a processing event
type Event struct {
	EventID    string                 `json:"event_id"`
	TenantID   string                 `json:"tenant_id"`
	Timestamp  time.Time              `json:"ts"`
	Kind       EventKind              `json:"kind"`
	Source     interface{}            `json:"source"` // Can be string or map
	Payload    map[string]interface{} `json:"payload"`
	Attributes map[string]interface{} `json:"attributes"`
}

// Clone creates a deep copy of the event
func (e *Event) Clone() *Event {
	clone := &Event{
		EventID:    e.EventID,
		TenantID:   e.TenantID,
		Timestamp:  e.Timestamp,
		Kind:       e.Kind,
		Source:     e.Source, // Copy as-is since it can be string or map
		Payload:    make(map[string]interface{}),
		Attributes: make(map[string]interface{}),
	}

	for k, v := range e.Payload {
		clone.Payload[k] = v
	}
	for k, v := range e.Attributes {
		clone.Attributes[k] = v
	}

	return clone
}
