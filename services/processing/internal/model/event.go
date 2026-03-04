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
	EventID        string                 `json:"event_id"`
	OrganizationID string                 `json:"organization_id"`
	DataSourceID   string                 `json:"data_source_id"`
	AgentID        string                 `json:"agent_id"`
	TenantID       string                 `json:"tenant_id"`
	Type           string                 `json:"type"`
	Timestamp      time.Time              `json:"timestamp"`
	Kind           EventKind              `json:"kind"`
	Source         interface{}            `json:"source"` // Can be string or map
	Payload        map[string]interface{} `json:"payload"`
	Attributes     map[string]interface{} `json:"attributes"`
	IngestedAt     time.Time              `json:"ingested_at"`
}

// Clone creates a deep copy of the event
func (e *Event) Clone() *Event {
	clone := &Event{
		EventID:        e.EventID,
		OrganizationID: e.OrganizationID,
		DataSourceID:   e.DataSourceID,
		AgentID:        e.AgentID,
		TenantID:       e.TenantID,
		Type:           e.Type,
		Timestamp:      e.Timestamp,
		Kind:           e.Kind,
		Source:         e.Source, // Copy as-is since it can be string or map
		Payload:        make(map[string]interface{}),
		Attributes:     make(map[string]interface{}),
		IngestedAt:     e.IngestedAt,
	}

	for k, v := range e.Payload {
		clone.Payload[k] = v
	}
	for k, v := range e.Attributes {
		clone.Attributes[k] = v
	}

	return clone
}
