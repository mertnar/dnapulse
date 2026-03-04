# Agent & Data Source Implementation Guide

## Overview

This document describes the complete implementation of the Agent registration, authentication, and data ingestion system for DNA Pulse platform.

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Agent     │         │  Ingestion       │         │   MongoDB    │
│  (Linux/    │◄────────┤  Service         │◄────────┤  (Unified    │
│   Win/Mac)  │  JWT    │  (REST + gRPC)   │  Query  │   Database)  │
└─────────────┘         └──────────────────┘         └──────────────┘
      │                          │                           │
      │ 1. Register              │ 5. Kafka Publish          │
      │    (API-Key)             ├───────────────────────────┤
      │                          │                           │
      │ 2. JWT Response          │ 6. Elasticsearch Log      │
      │                          ├───────────────────────────┤
      │ 3. Health Check          │                           │
      │    (JWT Bearer)          │ 7. Schema Discovery       │
      │                          ├───────────────────────────┤
      │ 4. Pulse Data            │                           │
      │    (JWT Bearer)          │ 8. Event Storage          │
      └──────────────────────────┴───────────────────────────┘
```

## Implementation Components

### 1. MongoDB Collections

**Collections Created:**

- `organizations` - Multi-tenant organizations
- `users` - Platform users
- `api_keys` - API keys for authentication (hashed with bcrypt)
- `agents` - Registered agent instances
- `data_sources` - Data source definitions with schemas
- `discovered_schemas` - Dynamically discovered schemas
- `events` - Ingested event data

**Key Indexes:**

- `api_keys.key` (unique, for fast lookup)
- `agents.organization_id + data_source_id`
- `data_sources.organization_id + agent_type` (unique)
- `events.ingested_at` (for time-based queries)
- `discovered_schemas.data_source_id + version`

### 2. Authentication Flow

#### API-Key Authentication

1. Agent sends API-key in `X-API-Key` header
2. Ingestion service validates against MongoDB
3. Returns organization context for agent

#### JWT Exchange

1. During registration, agent receives JWT token
2. JWT contains: agent_id, org_id, data_source_id
3. Token valid for 24 hours (configurable)
4. All subsequent requests use JWT in `Authorization: Bearer` header

### 3. REST API Endpoints

#### POST /api/v1/register

Agent registration with dynamic schema discovery.

**Request:**

```json
{
  "api_key": "dna_xxxxxxxxxxxxx",
  "agent_name": "Production Server",
  "agent_type": "syslog",
  "version": "1.0.0",
  "platform": "linux",
  "hostname": "web-server-01",
  "sample_data": [
    {
      "timestamp": "2026-01-26T10:00:00Z",
      "level": "info",
      "message": "System started",
      "host": "web-server-01"
    }
  ]
}
```

**Response:**

```json
{
  "agent_id": "679f0a1b2c3d4e5f6a7b8c9d",
  "data_source_id": "679f0a1b2c3d4e5f6a7b8c9e",
  "jwt_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

#### POST /api/v1/agent/health

Agent heartbeat to update status.

**Request:**

```json
{
  "status": "online",
  "metrics": {
    "cpu_usage": 45.2,
    "memory_usage": 60.1
  }
}
```

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "acknowledged": true,
  "next_check_in": 60
}
```

#### POST /api/v1/pulse

Bulk event ingestion.

**Request:**

```json
{
  "events": [
    {
      "timestamp": "2026-01-26T10:00:00Z",
      "level": "info",
      "message": "Request processed",
      "response_time": 125
    }
  ]
}
```

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "accepted": 1,
  "rejected": 0,
  "errors": []
}
```

### 4. Dynamic Schema Discovery

**Algorithm:**

1. Analyze sample data from agent registration
2. Identify all fields across all samples
3. Infer types: string, number, boolean, object, array
4. Determine if field is required (present in all samples)
5. Store example values
6. Create `discovered_schema` record
7. Link to `data_source`

**Type Inference Rules:**

- All values numeric → `number`
- All values boolean → `boolean`
- Mix of types → `string` (fallback)
- Nested object → `object`
- Array → `array`

**Schema Validation:**

- Required fields must be present
- Type compatibility check (lenient)
- New fields allowed (flexible schema)

### 5. Webapp Backend Integration

**MongoDB Connection:**

```typescript
import { connectDB, getCollection, Collections } from './lib/mongodb';

// Initialize at startup
await connectDB();

// Use in services
const agentsCollection = await getCollection(Collections.AGENTS);
const agents = await agentsCollection.find({ organization_id }).toArray();
```

**Services Migrated:**

- `agentsService.ts` - Agent CRUD operations
- `dataSourcesService.ts` - Data source and schema management
- `alertsService.ts` - Alert management
- `dashboardService.ts` - Dashboard stats and metrics

### 6. Frontend UI Components

**API Key Management Page:**

- Create new API keys
- View all keys (with masked values)
- Copy generated keys
- Revoke keys
- Track last usage

**Agents Page Enhancements:**

- Real-time agent status display
- Last heartbeat timestamps
- Link to associated data sources
- Agent configuration viewer

**Data Sources Detail Page:**

- Connected agents list
- Schema viewer with discovered fields
- Sample events display
- Pipeline configuration

## Testing

### Integration Tests

Run integration tests:

```bash
cd services/ingestion
go test -v ./test/...
```

**Test Scenarios:**

1. Complete agent registration flow
2. Schema discovery with various data types
3. Invalid API-key rejection
4. JWT expiration handling
5. Schema validation (valid/invalid data)
6. Concurrent agent registrations
7. Schema evolution and versioning

### Load Testing

```bash
# 100 agents registering simultaneously
go test -bench=BenchmarkJWTGeneration -benchtime=100x

# Schema discovery performance
go test -bench=BenchmarkSchemaDiscovery -benchtime=1000x
```

## Deployment

### Environment Variables

**Ingestion Service:**

```bash
MONGO_URL=mongodb://mongo:27017/dna-pulse
JWT_SECRET=your-production-secret-key
JWT_EXPIRY=24h
KAFKA_BROKERS=kafka:9092
ELASTICSEARCH_URL=http://elasticsearch:9200
```

**Webapp Backend:**

```bash
MONGO_URL=mongodb://mongo:27017/dna-pulse
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Database Initialization

```bash
cd scripts
node init-mongodb.js
```

### Docker Compose

```bash
cd deploy/compose
docker-compose -f docker-compose.services.yml up -d
```

## Agent SDK Example

### Python Agent

```python
import requests
import time

class DNAPulseAgent:
    def __init__(self, api_key, ingestion_url):
        self.api_key = api_key
        self.ingestion_url = ingestion_url
        self.jwt_token = None

    def register(self, agent_name, agent_type, sample_data):
        response = requests.post(
            f"{self.ingestion_url}/api/v1/register",
            headers={"X-API-Key": self.api_key},
            json={
                "agent_name": agent_name,
                "agent_type": agent_type,
                "version": "1.0.0",
                "platform": "linux",
                "hostname": "my-server",
                "sample_data": sample_data
            }
        )
        data = response.json()
        self.jwt_token = data["jwt_token"]
        return data

    def send_pulse(self, events):
        response = requests.post(
            f"{self.ingestion_url}/api/v1/pulse",
            headers={"Authorization": f"Bearer {self.jwt_token}"},
            json={"events": events}
        )
        return response.json()

    def health_check(self):
        response = requests.post(
            f"{self.ingestion_url}/api/v1/agent/health",
            headers={"Authorization": f"Bearer {self.jwt_token}"},
            json={"status": "online"}
        )
        return response.json()

# Usage
agent = DNAPulseAgent("dna_xxxxx", "http://localhost:8080")

# Register
sample = [{"metric": "cpu", "value": 50}]
result = agent.register("My Agent", "custom", sample)
print(f"Registered: {result['agent_id']}")

# Send data
while True:
    events = [{"metric": "cpu", "value": 75.5, "timestamp": time.time()}]
    agent.send_pulse(events)
    agent.health_check()
    time.sleep(60)
```

## Security Considerations

1. **API Key Storage**: Stored as bcrypt hash in MongoDB
2. **JWT Secret**: Must be changed in production
3. **HTTPS**: Use TLS for all agent communication
4. **Key Rotation**: Implement periodic API key rotation
5. **Rate Limiting**: Already implemented in ingestion service
6. **Audit Logs**: Track all registration and authentication events

## Monitoring

**Metrics Exposed:**

- Agent registration count
- Active agents by organization
- Event ingestion rate
- Schema validation errors
- Authentication failures

**Dashboards:**

- Grafana dashboard for agent metrics
- Elasticsearch for event logs
- Prometheus for system metrics

## Next Steps

1. Implement agent SDK for multiple languages (Go, Python, Node.js)
2. Add agent auto-discovery for cloud environments
3. Implement schema migration tools
4. Add agent configuration hot-reload
5. Create agent deployment automation scripts
6. Add multi-region agent support

## Support

For issues or questions:

- Check logs: `docker logs dna-ingestion`
- Run health check: `curl http://localhost:8080/health`
- View metrics: `curl http://localhost:9091/metrics`
