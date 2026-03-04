package mongo

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Organization represents a tenant organization
type Organization struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	Name      string             `bson:"name"`
	CreatedAt time.Time          `bson:"created_at"`
}

// User represents a platform user
type User struct {
	ID             primitive.ObjectID `bson:"_id,omitempty"`
	Email          string             `bson:"email"`
	FullName       string             `bson:"full_name"`
	OrganizationID primitive.ObjectID `bson:"organization_id"`
	Role           string             `bson:"role"` // admin, user, viewer
	CreatedAt      time.Time          `bson:"created_at"`
}

// APIKey represents an API key for agent authentication
type APIKey struct {
	ID             primitive.ObjectID `bson:"_id,omitempty"`
	OrganizationID primitive.ObjectID `bson:"organization_id"`
	Key            string             `bson:"key"` // bcrypt hashed
	Name           string             `bson:"name"`
	Permissions    []string           `bson:"permissions"` // register, ingest, read
	ExpiresAt      *time.Time         `bson:"expires_at,omitempty"`
	LastUsed       *time.Time         `bson:"last_used,omitempty"`
	CreatedBy      primitive.ObjectID `bson:"created_by"`
	CreatedAt      time.Time          `bson:"created_at"`
}

// AgentType represents an agent blueprint/template
type AgentType struct {
	ID              primitive.ObjectID     `bson:"_id,omitempty"`
	OrganizationID  primitive.ObjectID     `bson:"organization_id"`
	Name            string                 `bson:"name"` // linux-resource-monitor, syslog, etc.
	DisplayName     string                 `bson:"display_name"`
	Description     string                 `bson:"description"`
	Version         string                 `bson:"version"`
	Icon            string                 `bson:"icon"` // emoji or icon name
	Category        string                 `bson:"category"` // system, security, application
	BinaryURL       string                 `bson:"binary_url"` // Download URL template
	InstallScript   string                 `bson:"install_script"`
	DefaultConfig   map[string]interface{} `bson:"default_config"`
	ConfigVersion   int                    `bson:"config_version"` // Configuration version
	ConfigUpdatedAt *time.Time             `bson:"config_updated_at,omitempty"`
	ConfigUpdatedBy string                 `bson:"config_updated_by,omitempty"`
	DataSourceID    primitive.ObjectID     `bson:"data_source_id"` // Associated data source
	Status          string                 `bson:"status"` // active, deprecated, beta
	CreatedAt       time.Time              `bson:"created_at"`
	UpdatedAt       time.Time              `bson:"updated_at"`
}

// Agent represents a deployed agent instance (running on a specific server)
type Agent struct {
	ID                   primitive.ObjectID     `bson:"_id,omitempty"`
	OrganizationID       primitive.ObjectID     `bson:"organization_id"`
	AgentTypeID          primitive.ObjectID     `bson:"agent_type_id"` // Link to AgentType
	DataSourceID         primitive.ObjectID     `bson:"data_source_id"`
	InstanceName         string                 `bson:"instance_name"` // server-prod-01
	Name                 string                 `bson:"name"` // Keeping for backward compatibility
	Version              string                 `bson:"version"`
	Platform             string                 `bson:"platform"` // linux, windows, macos, docker
	Status               string                 `bson:"status"`   // online, offline, error, suspended
	IPAddress            string                 `bson:"ip_address"`
	Hostname             string                 `bson:"hostname"`
	LastHeartbeat        time.Time              `bson:"last_heartbeat"`
	RegisteredAt         time.Time              `bson:"registered_at"`
	LastSeenAt           time.Time              `bson:"last_seen_at"`
	Config               map[string]interface{} `bson:"config"`
	CurrentConfigVersion int                    `bson:"current_config_version"` // Current config version on agent
	ConfigLastSyncedAt   *time.Time             `bson:"config_last_synced_at,omitempty"`
	Metrics              map[string]interface{} `bson:"metrics"` // Latest metrics snapshot
}

// DataSource represents a source of telemetry data
type DataSource struct {
	ID             primitive.ObjectID `bson:"_id,omitempty"`
	OrganizationID primitive.ObjectID `bson:"organization_id"`
	Name           string             `bson:"name"`
	Type           string             `bson:"type"`       // agent-based, elk, webhook, sdk
	AgentType      string             `bson:"agent_type"` // syslog, windows-event, custom-app, etc.
	Status         string             `bson:"status"`     // active, inactive, error
	SchemaID       primitive.ObjectID `bson:"schema_id"`
	Throughput     int                `bson:"throughput"` // events/sec
	LastSeen       time.Time          `bson:"last_seen"`
	AgentCount     int                `bson:"agent_count"`
	CreatedAt      time.Time          `bson:"created_at"`
}

// DiscoveredSchema represents the schema discovered from sample data
type DiscoveredSchema struct {
	ID           primitive.ObjectID `bson:"_id,omitempty"`
	DataSourceID primitive.ObjectID `bson:"data_source_id"`
	Version      int                `bson:"version"`
	Fields       []SchemaField      `bson:"fields"`
	SampleData   interface{}        `bson:"sample_data"`
	DiscoveredAt time.Time          `bson:"discovered_at"`
}

// SchemaField represents a field in the discovered schema
type SchemaField struct {
	Name        string      `bson:"name"`
	Type        string      `bson:"type"` // string, number, boolean, object, array
	Required    bool        `bson:"required"`
	Indexed     bool        `bson:"indexed"`
	Description string      `bson:"description"`
	Example     interface{} `bson:"example"`
}

// DataModel represents a data model (root, derived, composite, vector)
type DataModel struct {
	ID             primitive.ObjectID `bson:"_id,omitempty"`
	OrganizationID primitive.ObjectID `bson:"organization_id"`
	Name           string             `bson:"name"`
	DataIndex      string             `bson:"data_index"` // unique per org
	Type           string             `bson:"type"`       // root, derived, composite, vector
	Version        int                `bson:"version"`
	Status         string             `bson:"status"` // draft, active, archived
	Source         DataModelSource    `bson:"source"`
	Schema         DataModelSchema    `bson:"schema"`
	Processing     *DataModelPipeline `bson:"processing,omitempty"`
	Composite      *CompositeConfig   `bson:"composite,omitempty"`
	ELK            ELKConfig          `bson:"elk"`
	CreatedAt      time.Time          `bson:"created_at"`
	UpdatedAt      time.Time          `bson:"updated_at"`
	CreatedBy      string             `bson:"created_by"`
}

type DataModelSource struct {
	DataSourceIDs []primitive.ObjectID `bson:"data_source_ids"`
	AgentType     string               `bson:"agent_type,omitempty"`
	SourceType    string               `bson:"source_type,omitempty"`
}

type DataModelSchema struct {
	Fields []SchemaField `bson:"fields"`
}

type DataModelPipeline struct {
	Pipeline []PipelineStep `bson:"pipeline"`
}

type PipelineStep struct {
	ID        string                 `bson:"id"`
	Operation string                 `bson:"operation"`
	When      string                 `bson:"when,omitempty"`
	Inputs    []PipelineField        `bson:"inputs"`
	Params    map[string]interface{} `bson:"params,omitempty"`
	Outputs   []PipelineField        `bson:"outputs"`
}

type PipelineField struct {
	Field string `bson:"field"`
	Type  string `bson:"type,omitempty"`
}

type CompositeConfig struct {
	JoinType      string    `bson:"join_type"` // inner, left, full
	TimeWindowSec int       `bson:"time_window_sec"`
	JoinKeys      []JoinKey `bson:"join_keys"`
}

type JoinKey struct {
	LeftModelID  primitive.ObjectID `bson:"left_model_id"`
	LeftField    string             `bson:"left_field"`
	RightModelID primitive.ObjectID `bson:"right_model_id"`
	RightField   string             `bson:"right_field"`
}

type ELKConfig struct {
	IndexName    string     `bson:"index_name"`
	TemplateName string     `bson:"template_name,omitempty"`
	MappingHash  string     `bson:"mapping_hash,omitempty"`
	LastWriteAt  *time.Time `bson:"last_write_at,omitempty"`
}

// DataModelAttribute represents an attribute/field in a data model
type DataModelAttribute struct {
	ID            primitive.ObjectID `bson:"_id,omitempty"`
	DataModelID   primitive.ObjectID `bson:"data_model_id"`
	Path          string             `bson:"path"` // "hostname", "user.name", "cpu.usage"
	Type          string             `bson:"type"` // "string", "number", "date", "ip", "bool", "object", "array", "vector"
	Source        string             `bson:"source"` // "discovered", "derived", "user-added"
	Required      bool               `bson:"required"`
	Indexed       bool               `bson:"indexed"`
	Description   string             `bson:"description"`
	Example       interface{}        `bson:"example,omitempty"`
	Status        string             `bson:"status"` // "normal", "deprecated", "undefined"
	Order         int                `bson:"order"`
	Derivation    *AttributeDerivation `bson:"derivation,omitempty"`
	CreatedAt     time.Time          `bson:"created_at"`
	UpdatedAt     time.Time          `bson:"updated_at"`
	CreatedBy     string             `bson:"created_by"`
	UpdatedBy     string             `bson:"updated_by,omitempty"`
}

// AttributeDerivation represents how a derived attribute is calculated
type AttributeDerivation struct {
	Operation        string   `bson:"operation"` // "concat", "math", "conditional", "vectorize"
	Expression       string   `bson:"expression"`
	SourceAttributes []string `bson:"source_attributes"`
}
