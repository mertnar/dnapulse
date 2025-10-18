# DNA Platform Categorization Service

Production-grade TypeScript microservice that labels processed items using pluggable labelers and JSON-Schema driven configuration.

## Features

- **Pluggable Labelers**: Rule-based, external DB, ML, and user labelers
- **Cardinality Support**: one_to_one, one_to_many, many_to_one, many_to_many
- **Hot-reload Configuration**: SSE-based config updates from Config Service
- **REST API**: Full CRUD for labels and assignment operations
- **Observability**: OpenTelemetry tracing, Prometheus metrics, structured logging
- **Storage**: MongoDB for persistence, optional Elasticsearch for search
- **Authentication**: JWT middleware with dev bypass option

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB
- Config Service (DNA Platform)
- Optional: Elasticsearch, Jaeger

### Environment Variables

```bash
# Service Configuration
PORT=8083
HOST=0.0.0.0
LOG_LEVEL=info

# Config Service
CONFIG_URL=http://localhost:8084
CONFIG_SCOPE=categorization
CONFIG_SSE_URL=http://localhost:8084/v1/stream

# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DATABASE=categorization

# Elasticsearch (Optional)
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=categorized-items

# Observability (Optional)
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Authentication (Optional)
JWT_SECRET=your-secret-key
BYPASS_AUTH=true  # For development
```

### Local Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

### Docker

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# Or with docker-compose
docker-compose up
```

## API Endpoints

### Health & Metrics

- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /metrics` - Prometheus metrics

### Labels Management

- `POST /v1/labels` - Create/update label
- `GET /v1/labels` - List labels (with filtering)
- `GET /v1/labels/:id` - Get label by ID
- `PUT /v1/labels/:id` - Update label
- `DELETE /v1/labels/:id` - Deactivate label

### Item Assignment

- `POST /v1/assign` - Assign labels to items
- `POST /v1/assign/bulk` - Bulk assignment with custom pipeline

### Item Queries

- `GET /v1/items/:id/labels` - Get labels for item
- `GET /v1/items/search` - Search items by labels (requires ES)
- `GET /v1/labels/:labelId/items` - Get items by label
- `DELETE /v1/items/:id/labels` - Remove labels from item

## Configuration Schema

The service loads configuration from the Config Service using the `categorization` scope. Configuration must validate against the JSON schema:

```json
{
  "version": 1,
  "cardinality": "one_to_many",
  "label_kind": "category",
  "default_label": "uncategorized",
  "targets": {
    "selector": "type === 'metric' || type === 'log'",
    "item_types": ["metric", "log"]
  },
  "pipelines": [
    {
      "name": "high_cpu_detector",
      "labeler": "rule_based",
      "enabled": true,
      "priority": 10,
      "args": {
        "rules": [
          {
            "when": "payload.cpu_load > 0.9",
            "label": "high_cpu",
            "score": 0.95
          }
        ]
      }
    }
  ],
  "persistence": {
    "mongodb": {
      "enabled": true,
      "collection": "item_labels"
    },
    "elasticsearch": {
      "enabled": false,
      "index": "categorized-items"
    }
  }
}
```

## Labelers

### Rule-based Labeler

Uses expression evaluation to match conditions:

```json
{
  "labeler": "rule_based",
  "args": {
    "rules": [
      {
        "when": "payload.cpu_load > 0.9",
        "label": "high_cpu",
        "score": 0.95
      },
      {
        "when": "payload.process_name && /nginx|apache/.test(payload.process_name)",
        "label": "webserver",
        "score": 0.9
      }
    ]
  }
}
```

### External DB Labeler

Mock implementation for database lookups:

```json
{
  "labeler": "external_db",
  "args": {
    "lookup_by": "payload.process_name",
    "table": "assets"
  }
}
```

### ML Labeler

Stub implementation for ML inference:

```json
{
  "labeler": "ml",
  "args": {
    "endpoint": "http://ml-service:8080/predict",
    "model": "anomaly-detector"
  }
}
```

### User Labeler

No-op labeler for manual assignment via API.

## Cardinality Modes

### one_to_one

- Enforces single active label per item per kind
- Keeps highest scoring label when conflicts occur

### one_to_many

- Allows multiple labels per item
- Deduplicates by label name (keeps highest score)

### many_to_one

- No special constraints
- All matching labels are assigned

### many_to_many

- No special constraints
- Full flexibility for complex relationships

## Example Usage

### Assign Labels to Items

```bash
curl -X POST http://localhost:8083/v1/assign \
  -H 'Content-Type: application/json' \
  -d '{
    "items": [
      {
        "id": "evt-001",
        "tenant_id": "tenant-1",
        "type": "metric",
        "ts": "2024-01-15T10:30:00Z",
        "payload": {
          "cpu_load": 0.95,
          "process_name": "nginx"
        },
        "attributes": {
          "host": "web-server-01",
          "level": "warn"
        }
      }
    ]
  }'
```

### Create Label Definition

```bash
curl -X POST http://localhost:8083/v1/labels \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "high_cpu",
    "kind": "category",
    "name": "high_cpu",
    "description": "High CPU usage detected",
    "active": true
  }'
```

### Search Items by Labels

```bash
curl "http://localhost:8083/v1/items/search?labels=high_cpu,webserver&limit=10"
```

## Development

### Project Structure

```
src/
├── app.ts                 # Application bootstrap
├── config/                # Config service client
├── model/                 # TypeScript types and enums
├── store/                 # MongoDB and Elasticsearch clients
├── labelers/              # Pluggable labeler implementations
├── pipeline/              # Pipeline executor and cardinality logic
├── routes/                # REST API routes
├── observability/         # OTEL tracing and Prometheus metrics
└── utils/                 # Utility functions

test/                      # Unit tests
contracts/schemas/         # JSON schemas
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Run specific test
npm test -- rule_based.test.ts
```

### Linting

```bash
# Check for issues
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

## Monitoring

### Metrics

The service exposes Prometheus metrics at `/metrics`:

- `dna_categorization_items_processed_total` - Items processed counter
- `dna_categorization_labels_assigned_total` - Labels assigned counter
- `dna_categorization_pipeline_executions_total` - Pipeline executions counter
- `dna_categorization_processing_duration_seconds` - Processing latency histogram
- `dna_categorization_api_duration_seconds` - API request latency histogram

### Tracing

OpenTelemetry traces are automatically generated for:

- HTTP requests
- Database operations
- Pipeline executions
- External service calls

### Logging

Structured JSON logging with Pino:

```json
{
  "level": 30,
  "time": 1642248000000,
  "msg": "Item processed successfully",
  "itemId": "evt-001",
  "labelCount": 2,
  "processingTimeMs": 45
}
```

## Deployment

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: categorization
spec:
  replicas: 3
  selector:
    matchLabels:
      app: categorization
  template:
    metadata:
      labels:
        app: categorization
    spec:
      containers:
        - name: categorization
          image: dna-categorization:latest
          ports:
            - containerPort: 8083
          env:
            - name: CONFIG_URL
              value: 'http://config:8084'
            - name: MONGO_URI
              value: 'mongodb://mongo:27017'
          livenessProbe:
            httpGet:
              path: /health
              port: 8083
          readinessProbe:
            httpGet:
              path: /ready
              port: 8083
```

### Docker Compose

```yaml
version: '3.8'
services:
  categorization:
    build: .
    ports:
      - '8083:8083'
    environment:
      - CONFIG_URL=http://config:8084
      - MONGO_URI=mongodb://mongo:27017
      - ELASTICSEARCH_NODE=http://elasticsearch:9200
    depends_on:
      - mongo
      - elasticsearch
      - config
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## License

MIT License - see LICENSE file for details.
