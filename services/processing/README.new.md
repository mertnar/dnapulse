# DNA Platform - Processing Service

Production-grade event processing microservice with rule-based pipeline, JSON-Schema driven configuration, and hot-reload capabilities.

## 🎯 Features

- **Rule-Based Pipeline**: Strategy + Chain of Responsibility pattern
- **JSON Schema Validation**: Config validation with `gojsonschema`
- **Hot Reload**: SSE-based configuration updates from Config Service
- **Multi-Source Input**: Kafka (Redpanda) consumer + HTTP dev endpoint
- **DLQ Support**: Dead Letter Queue for failed events
- **Persistence**: MongoDB and Elasticsearch support
- **Observability**: OpenTelemetry tracing, Prometheus metrics, health checks
- **9 Built-in Rules**: Parse JSON, normalize, convert units, redact, deduplicate, enrich GeoIP, validate schema, persist

## 📋 Architecture

```
┌─────────────┐
│   Kafka     │◄────── Input Topic
│  Consumer   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Pipeline Executor               │
│  ┌────────────────────────────────┐ │
│  │  Rule 1: Parse JSON            │ │
│  │  Rule 2: Normalize Fields      │ │
│  │  Rule 3: Unit Convert          │ │
│  │  Rule 4: Redact/Mask           │ │
│  │  Rule 5: Deduplicate           │ │
│  │  Rule 6: Enrich GeoIP          │ │
│  │  Rule 7: Validate Schema       │ │
│  │  Rule 8: Persist MongoDB       │ │
│  │  Rule 9: Persist Elasticsearch │ │
│  └────────────────────────────────┘ │
└──────┬──────────────────┬───────────┘
       │                  │
       ▼                  ▼
┌─────────────┐    ┌──────────┐
│   Kafka     │    │   DLQ    │
│  Producer   │    │  Topic   │
└─────────────┘    └──────────┘
```

## 🚀 Quick Start

### Local Development (HTTP Mode)

```bash
# Install dependencies
make deps

# Run in dev mode
make run-dev

# Test dev endpoint
curl -X POST http://localhost:8080/v1/process \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "test-123",
    "tenant_id": "tenant-1",
    "ts": "2024-01-01T00:00:00Z",
    "kind": "log",
    "payload": {"message": "test"},
    "attributes": {"raw": "{\"level\":\"info\"}"}
  }'
```

### Kafka Mode

```bash
# Set environment variables
export KAFKA_BROKERS=localhost:9092
export KAFKA_INPUT_TOPIC=ingestion.raw.v1
export KAFKA_OUTPUT_TOPIC=processing.cleaned.v1
export CONFIG_URL=http://localhost:8084
export CONFIG_SCOPE=processing

# Run
make run
```

### Docker

```bash
# Build image
make docker-build

# Run container
make docker-run
```

## ⚙️ Configuration

### Environment Variables

| Variable             | Description                              | Default                                          |
| -------------------- | ---------------------------------------- | ------------------------------------------------ |
| `SERVICE_NAME`       | Service name for tracing                 | `processing`                                     |
| `KAFKA_BROKERS`      | Kafka broker addresses (comma-separated) | `localhost:9092`                                 |
| `KAFKA_INPUT_TOPIC`  | Input topic name                         | `ingestion.raw.v1`                               |
| `KAFKA_OUTPUT_TOPIC` | Output topic name                        | `processing.cleaned.v1`                          |
| `KAFKA_DLQ_TOPIC`    | Dead letter queue topic                  | `processing.dlq`                                 |
| `KAFKA_GROUP_ID`     | Consumer group ID                        | `processing-service`                             |
| `CONFIG_URL`         | Config service base URL                  | `http://localhost:8084`                          |
| `CONFIG_SCOPE`       | Config scope                             | `processing`                                     |
| `MONGO_URI`          | MongoDB connection URI                   | `""` (optional)                                  |
| `MONGO_DATABASE`     | MongoDB database name                    | `dna`                                            |
| `ELASTIC_ADDRESSES`  | Elasticsearch addresses                  | `""` (optional)                                  |
| `ELASTIC_USERNAME`   | Elasticsearch username                   | `""`                                             |
| `ELASTIC_PASSWORD`   | Elasticsearch password                   | `""`                                             |
| `JAEGER_ENDPOINT`    | Jaeger collector endpoint                | `""` (optional)                                  |
| `HTTP_PORT`          | HTTP server port                         | `8080`                                           |
| `SCHEMA_PATH`        | Pipeline schema JSON path                | `contracts/schemas/processing.rules.schema.json` |

### Pipeline Configuration

The pipeline is configured via the Config Service. Example (`dev.pipeline.json`):

```json
{
  "version": 1,
  "rules": [
    {
      "name": "parse_raw_json",
      "type": "parse_json",
      "args": {
        "source_field": "raw"
      },
      "on_error": "skip"
    },
    {
      "name": "normalize_fields",
      "type": "normalize_fields",
      "args": {
        "mappings": {
          "timestamp": "ts",
          "log_level": "level"
        }
      },
      "on_error": "skip"
    },
    {
      "name": "redact_pii",
      "type": "redact_mask",
      "args": {
        "fields": ["email", "credit_card"],
        "strategy": "partial"
      },
      "on_error": "skip"
    }
  ],
  "persist": {
    "mongo": {
      "enabled": true,
      "collection": "events"
    },
    "elasticsearch": {
      "enabled": true,
      "index": "dna-events"
    }
  }
}
```

## 📚 Rule Reference

### 1. parse_json

Parses JSON from a specified field into the event payload.

**Args:**

- `source_field` (string): Field name containing JSON string (default: `raw`)

**Example:**

```json
{
  "name": "parse_json_data",
  "type": "parse_json",
  "args": {
    "source_field": "raw_data"
  },
  "on_error": "skip"
}
```

### 2. normalize_fields

Renames and normalizes fields with type coercion.

**Args:**

- `mappings` (object): Map of old field names to new field names

**Example:**

```json
{
  "name": "normalize",
  "type": "normalize_fields",
  "args": {
    "mappings": {
      "old_name": "new_name",
      "lvl": "level"
    }
  }
}
```

### 3. unit_convert

Converts units for numeric fields.

**Args:**

- `conversions` (array): List of conversion specs
  - `field` (string): Field name
  - `from` (string): Source unit
  - `to` (string): Target unit

**Supported conversions:**

- Percent: `percent` ↔ `decimal`
- Bytes: `bytes` → `KB`, `MB`, `GB`
- Temperature: `celsius` ↔ `fahrenheit`

**Example:**

```json
{
  "name": "convert_units",
  "type": "unit_convert",
  "args": {
    "conversions": [
      { "field": "cpu_usage", "from": "percent", "to": "decimal" },
      { "field": "memory", "from": "bytes", "to": "MB" }
    ]
  }
}
```

### 4. redact_mask

Masks sensitive data fields.

**Args:**

- `fields` (array): List of field names to mask
- `strategy` (string): `partial` or `full`

**Example:**

```json
{
  "name": "mask_pii",
  "type": "redact_mask",
  "args": {
    "fields": ["email", "credit_card", "ssn"],
    "strategy": "partial"
  }
}
```

### 5. deduplicate

Deduplicates events based on field hashing with TTL cache.

**Args:**

- `fields` (array): Fields to use for hash computation
- `ttl_seconds` (number): Cache TTL in seconds

**Example:**

```json
{
  "name": "dedupe",
  "type": "deduplicate",
  "args": {
    "fields": ["event_id", "source"],
    "ttl_seconds": 300
  }
}
```

### 6. enrich_geoip

Enriches events with GeoIP data (uses stub provider).

**Args:**

- `src_field` (string): IP address field name
- `cache_ttl_sec` (number): Cache TTL

**Example:**

```json
{
  "name": "geo_enrich",
  "type": "enrich_geoip",
  "args": {
    "src_field": "ip_address",
    "cache_ttl_sec": 3600
  }
}
```

### 7. validate_schema

Validates payload against a JSON schema.

**Args:**

- `schema_url` (string): Schema URL or file path

**Example:**

```json
{
  "name": "validate",
  "type": "validate_schema",
  "args": {
    "schema_url": "https://example.com/schema.json"
  }
}
```

### 8. persist_mongo

Persists events to MongoDB.

**Example:**

```json
{
  "name": "save_mongo",
  "type": "persist_mongo",
  "args": {}
}
```

### 9. persist_es

Persists events to Elasticsearch.

**Example:**

```json
{
  "name": "save_es",
  "type": "persist_es",
  "args": {}
}
```

## 📊 Observability

### Health Endpoints

- `GET /health` - Health check (JSON response)
- `GET /ready` - Readiness check (plain text)

### Metrics (Prometheus)

- `GET /metrics` - Prometheus metrics endpoint

**Available Metrics:**

- `dna_processing_events_total{status}` - Total events processed
- `dna_processing_rule_latency_seconds{rule}` - Rule execution latency
- `dna_processing_dlq_total` - Events sent to DLQ
- `dna_processing_pipeline_latency_seconds{status}` - Pipeline execution latency

### Tracing (OpenTelemetry)

Set `JAEGER_ENDPOINT` to enable distributed tracing:

```bash
export JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

## 🧪 Testing

```bash
# Run all tests
make test

# Run short tests
make test-short

# Run linters
make lint
```

## 🏗️ Project Structure

```
services/processing/
├── cmd/
│   └── processing/
│       └── main.go              # Main entry point
├── internal/
│   ├── app/
│   │   └── app.go               # Application bootstrap
│   ├── config/
│   │   └── client.go            # Config service client + SSE
│   ├── kafka/
│   │   ├── consumer.go          # Kafka consumer
│   │   ├── producer.go          # Kafka producer
│   │   └── dlq.go               # DLQ publisher
│   ├── model/
│   │   ├── event.go             # Event model
│   │   └── config.go            # Config models
│   ├── observability/
│   │   ├── health.go            # Health checks
│   │   ├── metrics.go           # Prometheus metrics
│   │   └── tracing.go           # OpenTelemetry setup
│   ├── pipeline/
│   │   ├── rule.go              # Rule interface
│   │   ├── registry.go          # Rule registry
│   │   └── executor.go          # Pipeline executor
│   ├── rules/
│   │   ├── parse_json.go        # Parse JSON rule
│   │   ├── normalize_fields.go  # Normalize fields rule
│   │   ├── unit_convert.go      # Unit conversion rule
│   │   ├── redact_mask.go       # Redaction rule
│   │   ├── deduplicate.go       # Deduplication rule
│   │   ├── enrich_geoip.go      # GeoIP enrichment
│   │   ├── validate_schema.go   # Schema validation
│   │   ├── persist_mongo.go     # MongoDB persistence
│   │   └── persist_es.go        # Elasticsearch persistence
│   └── store/
│       ├── mongo.go             # MongoDB client
│       └── elasticsearch.go     # Elasticsearch client
├── contracts/
│   └── schemas/
│       └── processing.rules.schema.json
├── dev.pipeline.json            # Dev config
├── Dockerfile.new               # Production Dockerfile
├── Makefile.new                 # Build automation
├── go.mod
└── README.new.md                # This file
```

## 🔧 Development

### Adding a New Rule

1. Implement the `pipeline.Rule` interface:

```go
type MyRule struct {}

func NewMyRule(args map[string]interface{}) (pipeline.Rule, error) {
    // Parse args and validate
    return &MyRule{}, nil
}

func (r *MyRule) Name() string { return "my_rule" }
func (r *MyRule) Type() string { return "my_rule" }

func (r *MyRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
    // Process event
    return event, nil
}
```

2. Register in `internal/rules/registry.go`:

```go
"my_rule": NewMyRule,
```

3. Add to JSON schema in `contracts/schemas/processing.rules.schema.json`

## 📝 License

Copyright © 2025 DNA Platform

---

**Built with ❤️ using Go 1.22+**
