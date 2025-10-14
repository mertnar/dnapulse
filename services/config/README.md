# DNA Platform Config Service

Centralized configuration management service for the DNA Platform microservices ecosystem.

## Features

- **RESTful API**: CRUD operations for configuration management
- **Server-Sent Events (SSE)**: Real-time configuration change notifications
- **Schema Validation**: JSON Schema validation using AJV
- **MongoDB Storage**: Persistent configuration storage
- **Metrics**: Prometheus metrics for monitoring
- **Health Checks**: Built-in health and readiness endpoints

## API Endpoints

### Configuration Management

#### GET /v1/config/:scope

Retrieve configuration for a specific scope.

**Response:**

- Content-Type: `application/x-yaml`
- Headers: `ETag: <etag>`
- Body: YAML configuration content

```bash
curl -H "Accept: application/x-yaml" http://localhost:8080/v1/config/processing
```

#### PUT /v1/config/:scope

Create or update configuration for a specific scope.

**Request:**

- Content-Type: `application/x-yaml` or `application/json`
- Body: YAML or JSON configuration content

**Response:**

```json
{
  "scope": "processing",
  "etag": "uuid-v4",
  "message": "Config updated successfully"
}
```

```bash
# Update with YAML
curl -X PUT \
  -H "Content-Type: application/x-yaml" \
  -d "rules: []" \
  http://localhost:8080/v1/config/processing

# Update with JSON (automatically converted to YAML)
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{"rules": []}' \
  http://localhost:8080/v1/config/processing

# Skip validation
curl -X PUT \
  -H "Content-Type: application/x-yaml+no-validate" \
  -d "rules: []" \
  http://localhost:8080/v1/config/processing
```

#### DELETE /v1/config/:scope

Delete configuration for a specific scope.

```bash
curl -X DELETE http://localhost:8080/v1/config/processing
```

#### GET /v1/config

List all available configuration scopes.

**Response:**

```json
{
  "scopes": ["processing", "decision", "categorization"],
  "count": 3
}
```

### Server-Sent Events

#### GET /v1/stream

Subscribe to real-time configuration change notifications.

**Events:**

- `connected`: Initial connection confirmation
- `config:update`: Configuration update notification
- `heartbeat`: Periodic heartbeat (every 30 seconds)

**Event Data:**

```json
{
  "event": "config:update",
  "data": {
    "scope": "processing",
    "etag": "uuid-v4",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

```bash
# Subscribe to config updates
curl -N -H "Accept: text/event-stream" http://localhost:8080/v1/stream
```

#### GET /v1/stream/status

Get current stream status.

**Response:**

```json
{
  "active_subscribers": 5,
  "heartbeat_interval": 30000,
  "max_clients": 100,
  "uptime": 3600.5
}
```

### Health & Metrics

#### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600.5,
  "memory": {
    "rss": 50331648,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1234567
  },
  "mongo": "connected"
}
```

#### GET /metrics

Prometheus metrics endpoint.

```bash
curl http://localhost:8080/metrics
```

**Key Metrics:**

- `config_requests_total`: Total config requests by scope and method
- `config_updates_total`: Total config updates by scope
- `config_validation_errors_total`: Validation errors by scope and type
- `config_request_duration_seconds`: Request duration histogram
- `config_active_subscribers`: Number of active SSE subscribers
- `config_cache_hit_ratio`: Cache hit ratio
- `config_size_bytes`: Configuration size histogram

## Environment Variables

| Variable                 | Default                                                       | Description                            |
| ------------------------ | ------------------------------------------------------------- | -------------------------------------- |
| `PORT`                   | `8080`                                                        | HTTP server port                       |
| `HOST`                   | `0.0.0.0`                                                     | HTTP server host                       |
| `MONGO_URL`              | `mongodb://admin:admin123@mongodb:27017/dna?authSource=admin` | MongoDB connection string              |
| `NODE_ENV`               | `development`                                                 | Node.js environment                    |
| `LOG_LEVEL`              | `info`                                                        | Logging level                          |
| `METRICS_PORT`           | `8081`                                                        | Metrics server port                    |
| `MAX_CONFIG_SIZE`        | `1048576`                                                     | Maximum config size in bytes (1MB)     |
| `CACHE_TTL`              | `300`                                                         | Cache TTL in seconds (5 minutes)       |
| `SSE_HEARTBEAT_INTERVAL` | `30000`                                                       | SSE heartbeat interval in milliseconds |
| `SSE_MAX_CLIENTS`        | `100`                                                         | Maximum SSE clients                    |
| `STRICT_VALIDATION`      | `false`                                                       | Enable strict JSON Schema validation   |
| `ALLOW_UNKNOWN_FIELDS`   | `true`                                                        | Allow unknown fields in configurations |

## Configuration Schemas

The service validates configurations against JSON schemas located in `contracts/schemas/`:

- `processing.schema.json`: Processing rules configuration
- `decision.schema.json`: Decision policies configuration
- `categorization.schema.json`: Categorization configuration

### Example Configurations

#### Processing Rules (`processing` scope)

```yaml
rules:
  - name: 'high_cpu_alert'
    condition:
      field: 'metric.name'
      operator: 'eq'
      value: 'cpu_usage'
    action:
      type: 'set_severity'
      parameters:
        severity: 'warning'
    enabled: true
    priority: 100

defaults:
  severity: 'info'
  timeout: 30000
  retry_count: 3

metadata:
  version: '1.0.0'
  updated_at: '2024-01-01T00:00:00Z'
  updated_by: 'admin'
```

#### Decision Policies (`decision` scope)

```yaml
policies:
  - id: 'critical_alert_policy'
    name: 'Critical Alert Policy'
    description: 'Handle critical alerts'
    conditions:
      - field: 'severity'
        operator: 'eq'
        value: 'critical'
    actions:
      - type: 'create_alert'
        parameters:
          alert_level: 'critical'
      - type: 'send_notification'
        parameters:
          notification_channels: ['email', 'slack']
    enabled: true
    priority: 1

settings:
  max_policies: 100
  evaluation_timeout: 10000
  batch_size: 100
  parallel_evaluation: true
```

## Integration with DNA Platform Services

### Processing Service Integration

```typescript
// Subscribe to config updates
const eventSource = new EventSource('http://config:8080/v1/stream');

eventSource.addEventListener('config:update', (event) => {
  const data = JSON.parse(event.data);
  if (data.scope === 'processing') {
    // Reload processing configuration
    await loadProcessingConfig();
  }
});

// Initial config load
async function loadProcessingConfig() {
  const response = await fetch('http://config:8080/v1/config/processing');
  const yaml = await response.text();
  const config = yaml.parse(yaml);
  // Apply configuration
}
```

### Decision Service Integration

```typescript
// Similar pattern for decision service
const eventSource = new EventSource('http://config:8080/v1/stream');

eventSource.addEventListener('config:update', (event) => {
  const data = JSON.parse(event.data);
  if (data.scope === 'decision') {
    await loadDecisionConfig();
  }
});
```

## Development

### Prerequisites

- Node.js 20+
- MongoDB 7.0+
- TypeScript 5.3+

### Setup

```bash
cd services/config
npm install
npm run build
npm start
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## Docker

### Build

```bash
docker build -f services/config/Dockerfile -t dna-config .
```

### Run

```bash
docker run -p 8080:8080 \
  -e MONGO_URL="mongodb://admin:admin123@host.docker.internal:27017/dna?authSource=admin" \
  dna-config
```

## Kubernetes

The config service is included in the DNA Platform Helm chart:

```bash
helm install dna-platform ./deploy/k8s/helm/dna-platform/ \
  --namespace dna-platform \
  --set services.config.enabled=true
```

## Security Considerations

- Configurations may contain sensitive data - ensure proper access controls
- SSE connections should be rate-limited in production
- MongoDB connection should use authentication and TLS in production
- Consider implementing API authentication for production deployments

## Monitoring

The service exposes Prometheus metrics for comprehensive monitoring:

- Request rates and latencies
- Configuration update frequencies
- Validation error rates
- SSE connection counts
- Cache performance metrics

Configure Prometheus to scrape the `/metrics` endpoint for production monitoring.
