# Live Monitor Implementation Summary

## ✅ Completed Components

### Phase 1: Processing Service

- ✅ **normalize_live_monitor.go**: Event normalization rule adding canonical fields (@ts, severity, event_type, host, user, service, flattened)
- ✅ **Registry**: Rule registered in processing service
- ✅ **Pipeline Config**: dev.pipeline.json updated with normalization rule

### Phase 2: MongoDB

- ✅ **Index Script**: create-live-monitor-indexes.js with 10 indexes for optimized querying

### Phase 3: Backend Services

- ✅ **queryParser.ts**: KQL-like parser supporting field:value, AND/OR/NOT, wildcards, time ranges, quoted values
- ✅ **liveMonitorService.ts**: Complete service with search (keyset pagination), aggregation, fields, facets, stats
- ✅ **savedViewsService.ts**: CRUD operations for saved views
- ✅ **kafkaStreamService.ts**: Placeholder for SSE streaming (ready for Kafka integration)

### Phase 4: Backend API

- ✅ **liveMonitorController.ts**: All endpoints implemented
- ✅ **routes/liveMonitor.ts**: Complete routing with auth middleware
- ✅ **Collections**: Added LIVE_MONITOR_VIEWS to mongodb.ts

## 🔄 Remaining Tasks

### Frontend Integration (TODO)

1. **Update liveMonitorService.ts** (apps/webapp/frontend/src/services/liveMonitorService.ts)

   - Replace mock Supabase calls with real fetch() calls to backend
   - Example changes:

   ```typescript
   const BACKEND_URL = 'http://localhost:3001/api/live-monitor';
   const ORG_ID = 'default-org-id'; // Get from auth context

   async getEvents() {
     const res = await fetch(`${BACKEND_URL}/search`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         organization_id: ORG_ID,
         time_range: { preset: '1h' },
         limit: 100
       })
     });
     return res.json();
   }

   async getHistogram(minutes: number) {
     const res = await fetch(`${BACKEND_URL}/agg`, {
       method: 'POST',
       body: JSON.stringify({
         organization_id: ORG_ID,
         time_range: { preset: minutesToPreset(minutes) },
         interval: 5
       })
     });
     return res.json();
   }

   async getFields() {
     const res = await fetch(`${BACKEND_URL}/fields`);
     return res.json();
   }

   createEventStream(filter: any): EventSource {
     const params = new URLSearchParams({
       organization_id: ORG_ID,
       filter: JSON.stringify(filter)
     });
     return new EventSource(`${BACKEND_URL}/stream?${params}`);
   }
   ```

2. **Update LiveMonitor.tsx** (apps/webapp/frontend/src/pages/LiveMonitor.tsx)

   - Add SSE connection for auto-refresh
   - Implement cursor-based pagination using next_cursor
   - Add saved views dropdown and apply functionality
   - Example:

   ```typescript
   // SSE connection
   useEffect(() => {
     if (autoRefresh > 0 && !isPaused) {
       const eventSource = liveMonitorService.createEventStream(currentFilter);
       eventSource.onmessage = (e) => {
         const data = JSON.parse(e.data);
         if (data.type === 'event') {
           setEvents((prev) => [data.data, ...prev]);
         }
       };
       return () => eventSource.close();
     }
   }, [autoRefresh, isPaused, currentFilter]);

   // Pagination
   const handleLoadMore = async () => {
     if (nextCursor) {
       const result = await liveMonitorService.searchEvents({
         ...searchParams,
         cursor: nextCursor,
       });
       setEvents((prev) => [...prev, ...result.events]);
       setNextCursor(result.next_cursor);
     }
   };
   ```

3. **Update FieldsPanel.tsx** (apps/webapp/frontend/src/components/live-monitor/FieldsPanel.tsx)
   - Fetch fields from `/api/live-monitor/fields?data_source_id=...`
   - On field expand, fetch facet values from `/api/live-monitor/facet`
   - Add click handlers to insert field:value into query
   ```typescript
   const fetchFacetValues = async (fieldName: string) => {
     const res = await fetch(`${BACKEND_URL}/facet`, {
       method: 'POST',
       body: JSON.stringify({
         field: fieldName,
         organization_id: ORG_ID,
         limit: 10,
       }),
     });
     return res.json();
   };
   ```

### Docker Compose (TODO)

4. **Add Processing Service** (docker-compose.dev.yml)
   ```yaml
   processing:
     build:
       context: ./services/processing
       dockerfile: Dockerfile
     container_name: dnapulse-processing
     environment:
       - SERVICE_NAME=processing
       - KAFKA_BROKERS=redpanda:9092
       - KAFKA_INPUT_TOPIC=ingestion.raw.v1
       - KAFKA_OUTPUT_TOPIC=events.normalized.v1
       - KAFKA_DLQ_TOPIC=processing.dlq
       - MONGO_URI=${MONGO_URL}
       - MONGO_DATABASE=dna-pulse
       - HTTP_PORT=8080
     depends_on:
       - redpanda
       - mongodb
     dns:
       - 8.8.8.8
       - 8.8.4.4
     networks:
       - dnapulse-network
     restart: unless-stopped
   ```

### Testing (TODO)

5. **Query Parser Tests** (apps/webapp/backend/src/services/queryParser.test.ts)

   ```typescript
   describe('parseKQLQuery', () => {
     it('parses simple field match', () => {
       const filter = parseKQLQuery('severity:high', []);
       expect(filter).toEqual({ 'payload.severity': 'high' });
     });

     it('parses AND operator', () => {
       const filter = parseKQLQuery('severity:high AND host:web-01', []);
       expect(filter.$and).toHaveLength(2);
     });

     it('parses wildcard', () => {
       const filter = parseKQLQuery('host:web-*', []);
       expect(filter['payload.host'].$regex).toBe('^web-.*$');
     });
   });
   ```

6. **Integration Tests** (apps/webapp/backend/src/**tests**/liveMonitor.integration.test.ts)
   - Test search endpoint with various filters
   - Test aggregation buckets
   - Test saved views CRUD
   - Test SSE streaming

### Documentation (TODO)

7. **API Documentation** (docs/api/live-monitor.md)
   - Document all endpoints with request/response examples
   - Include KQL query syntax guide
   - Add authentication requirements

## Running the System

### 1. Start Infrastructure

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dnapulse
docker compose -f docker-compose.dev.yml up -d mongodb redpanda elasticsearch
```

### 2. Create Indexes

```bash
cd scripts
MONGO_URL="your_mongo_url" node create-live-monitor-indexes.js
```

### 3. Start Services

```bash
# Processing service
cd services/processing
go run cmd/processing/main.go

# Backend
cd apps/webapp/backend
npm run dev

# Frontend
cd apps/webapp/frontend
npm run dev
```

### 4. Seed Agent Types (if needed)

```bash
cd scripts
MONGO_URL="your_mongo_url" node seed-agent-types.js
```

### 5. Test Agent Data Flow

```bash
cd apps/agents/samples/linux-resource-monitor-linux-amd64
./linux-resource-monitor-linux-amd64 -config ./agent.yaml
```

## API Endpoints

### Search

```
POST /api/live-monitor/search
Body: {
  organization_id, time_range, query, limit, cursor
}
Response: { events[], next_cursor }
```

### Aggregation

```
POST /api/live-monitor/agg
Body: { organization_id, time_range, query, interval }
Response: HistogramBucket[]
```

### Fields

```
GET /api/live-monitor/fields?data_source_id=...
Response: FieldGroup[]
```

### Facets

```
POST /api/live-monitor/facet
Body: { field, organization_id, filter, limit }
Response: FacetValue[]
```

### SSE Stream

```
GET /api/live-monitor/stream?organization_id=...&filter={}
Response: text/event-stream
```

### Saved Views

```
POST /api/live-monitor/views
GET /api/live-monitor/views?organization_id=...
GET /api/live-monitor/views/:id
PUT /api/live-monitor/views/:id
DELETE /api/live-monitor/views/:id
```

## KQL Query Examples

```
severity:high
severity:high AND host:web-01
(severity:high OR severity:critical) AND NOT event_type:login
host:web-* AND @ts:[now-1h TO now]
message:"connection refused" AND service:nginx
```

## Key Features Implemented

1. ✅ Event normalization with canonical fields
2. ✅ KQL-like query language
3. ✅ Keyset cursor pagination
4. ✅ Time-bucketed histogram aggregation
5. ✅ Field grouping by category
6. ✅ Facet value extraction
7. ✅ Saved views CRUD
8. ✅ SSE streaming placeholder (ready for Kafka)
9. ✅ MongoDB indexes for performance
10. ✅ Full REST API with auth middleware

## Next Steps for Production

1. **Kafka Integration**: Replace placeholder with real Kafka consumer in kafkaStreamService
2. **Authentication**: Add JWT/session validation to all endpoints
3. **Rate Limiting**: Add rate limiting middleware
4. **Monitoring**: Add Prometheus metrics to all services
5. **Error Handling**: Add comprehensive error handling and retry logic
6. **Testing**: Complete unit and integration test suites
7. **Documentation**: Generate OpenAPI/Swagger docs
