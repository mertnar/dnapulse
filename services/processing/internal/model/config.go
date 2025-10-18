package model

// ErrorPolicy defines how to handle rule errors
type ErrorPolicy string

const (
	ErrorPolicySkip ErrorPolicy = "skip" // Log error and continue
	ErrorPolicyDLQ  ErrorPolicy = "dlq"  // Send to DLQ and continue
	ErrorPolicyFail ErrorPolicy = "fail" // Stop pipeline execution
)

// RuleConfig defines configuration for a single rule
type RuleConfig struct {
	Name    string                 `json:"name"`
	Type    string                 `json:"type"`
	Args    map[string]interface{} `json:"args"`
	OnError ErrorPolicy            `json:"on_error"`
}

// PersistConfig defines where to persist processed events
type PersistConfig struct {
	Mongo         *MongoPersistConfig `json:"mongo,omitempty"`
	Elasticsearch *ESPersistConfig    `json:"elasticsearch,omitempty"`
}

// MongoPersistConfig defines MongoDB persistence configuration
type MongoPersistConfig struct {
	Enabled    bool   `json:"enabled"`
	Collection string `json:"collection"`
}

// ESPersistConfig defines Elasticsearch persistence configuration
type ESPersistConfig struct {
	Enabled bool   `json:"enabled"`
	Index   string `json:"index"`
}

// PipelineConfig defines the complete pipeline configuration
type PipelineConfig struct {
	Version int            `json:"version"`
	Rules   []RuleConfig   `json:"rules"`
	Persist *PersistConfig `json:"persist,omitempty"`
}
