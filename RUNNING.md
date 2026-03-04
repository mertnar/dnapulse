# DNA Pulse - Running the System Locally

## Infrastructure Services (Docker)

### Start Kafka and Elasticsearch

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dnapulse
docker compose -f docker-compose.dev.yml up -d
```

### Check Services Status

```bash
docker compose -f docker-compose.dev.yml ps
```

### Services:

- **Kafka (Redpanda)**: localhost:9092
- **Elasticsearch**: localhost:9200
- **Kibana**: localhost:5601

### Stop Services

```bash
docker compose -f docker-compose.dev.yml down
```

## Application Services

### 1. MongoDB (Local)

- Running on: `localhost:27017`
- Database: `dna-pulse`

### 2. Ingestion Service (Terminal 3)

Start with proper environment variables:

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dnapulse/services/ingestion

export KAFKA_BROKERS=localhost:9092
export KAFKA_TOPIC=ingestion.raw.v1
export HTTP_PORT=19071
export GRPC_PORT=9090
export MONGO_URL=mongodb://localhost:27017/dna-pulse
export ELASTICSEARCH_URL=http://localhost:9200
export ELASTICSEARCH_INDEX=ingestion-events
export METRICS_PORT=9091
export JWT_SECRET=your-secret-key-change-in-production
export DISABLE_JWT_VALIDATION=true
export RATE_LIMIT=100

go run cmd/ingestion/main.go
```

**Or use the startup script:**

```bash
/home/mert/Documents/workspace/dnasol-workspace/dnapulse/scripts/start-ingestion-local.sh
```

### 3. Backend (Terminal 1)

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dnapulse/apps/webapp/backend
npm run dev
```

- Running on: `localhost:3001`

### 4. Frontend (Terminal 2)

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dnapulse/apps/webapp/frontend
npm run dev
```

- Running on: `localhost:5173`

### 5. Agent (Terminal 5)

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dnapulse/apps/agents/samples
./linux-resource-monitor-linux-amd64 -config ~/.dnapulse/agent.yaml
```

## Verification

### Check Kafka Topic

```bash
docker exec dnapulse-kafka rpk topic list
```

### Check Elasticsearch Index

```bash
curl localhost:9200/_cat/indices?v
```

### Check Events in Kafka

```bash
docker exec dnapulse-kafka rpk topic consume ingestion.raw.v1 --num 5
```

### Check Events in Elasticsearch

```bash
curl "localhost:9200/ingestion-events/_search?pretty&size=5"
```

### Check Events in MongoDB

```bash
mongosh dna-pulse --eval "db.events.countDocuments({})"
```

## Monitoring

### Service Health Checks

```bash
# Ingestion Service
curl localhost:19071/health

# Backend
curl localhost:3001/api/health

# Elasticsearch
curl localhost:9200/_cluster/health

# Kafka
docker exec dnapulse-kafka rpk cluster health
```

### View Logs

```bash
# Ingestion logs (Terminal 3 output)
# Backend logs (Terminal 1 output)
# Frontend logs (Terminal 2 output)
# Agent logs
tail -f ~/.dnapulse/agent.log

# Docker services logs
docker compose -f docker-compose.dev.yml logs -f kafka
docker compose -f docker-compose.dev.yml logs -f elasticsearch
```

## Troubleshooting

### Kafka Connection Issues

- Make sure Kafka is running: `docker ps | grep kafka`
- Check if topic exists: `docker exec dnapulse-kafka rpk topic list`
- Verify broker address: should be `localhost:9092`

### Elasticsearch Connection Issues

- Make sure Elasticsearch is healthy: `curl localhost:9200/_cluster/health`
- Check index exists: `curl localhost:9200/_cat/indices`
- Verify index mapping: `curl localhost:9200/ingestion-events/_mapping`

### Agent Issues

- Check config file: `cat ~/.dnapulse/agent.yaml`
- Check logs: `tail -f ~/.dnapulse/agent.log`
- Verify agent is registered: Check MongoDB `agents` collection

## System Architecture

```
┌─────────────┐
│   Agent     │ ──┐
└─────────────┘   │
                  ▼
            ┌──────────────┐
            │  Ingestion   │
            │   Service    │
            └──────────────┘
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
  ┌─────────┐ ┌──────┐ ┌───────────────┐
  │ MongoDB │ │Kafka │ │Elasticsearch  │
  └─────────┘ └──────┘ └───────────────┘
      ▲                       ▲
      │                       │
  ┌─────────┐            ┌────────┐
  │ Backend │            │ Kibana │
  └─────────┘            └────────┘
      ▲
      │
  ┌──────────┐
  │ Frontend │
  └──────────┘
```

## Current Status

✅ Infrastructure Services (Kafka, Elasticsearch) - Running
✅ MongoDB - Running
✅ Backend - Running (Terminal 1)
✅ Frontend - Running (Terminal 2)
⚠️ Ingestion Service - Needs restart with new env vars (Terminal 3)
✅ Agent - Running (Terminal 5)

### Next Steps:

1. **Terminal 3**: Restart ingestion service with the script:

   ```bash
   /home/mert/Documents/workspace/dnasol-workspace/dnapulse/scripts/start-ingestion-local.sh
   ```

2. Wait ~10 seconds for services to connect

3. Verify no more errors:

   ```bash
   # Check ingestion service logs (should see "Pulse processed" without warnings)
   # Check agent logs
   tail -f ~/.dnapulse/agent.log
   ```

4. Verify data flow:

   ```bash
   # Check events in Kafka
   docker exec dnapulse-kafka rpk topic consume ingestion.raw.v1 --num 1

   # Check events in Elasticsearch
   curl "localhost:9200/ingestion-events/_search?size=1&pretty"
   ```
