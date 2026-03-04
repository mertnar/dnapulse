# ELK Integration for Live Monitor & Detection

## Özet

Live Monitor ve Detection & Investigation sayfaları artık **Elasticsearch (ELK)** tabanlı arama kullanıyor. Kullanıcılar data model index'lerini seçerek hangi verileri görüntüleyeceklerini belirleyebilir ve ELK query syntax'ı ile arama yapabilirler.

## Yapılan Değişiklikler

### 1. Backend - Elasticsearch Client

**Yeni Dosya:** `apps/webapp/backend/src/lib/elasticsearch.ts`

Özellikler:

- ✅ Elasticsearch client bağlantısı
- ✅ `searchELK()` - Event arama
- ✅ `getHistogram()` - Zaman bazlı histogram aggregation
- ✅ `getIndexMappings()` - Index field mappings
- ✅ `getFieldStats()` - Field istatistikleri
- ✅ `indexExists()` - Index varlık kontrolü
- ✅ `getIndices()` - Tüm index'leri listeleme

Query Builder:

```typescript
buildELKQuery({
  index: 'org_111__linux-resource-monitor__v1',
  query: 'severity:critical AND cpu_usage > 80',
  time_range: { from: '2026-02-24T00:00:00Z', to: '2026-02-24T23:59:59Z' },
  filters: [{ field: 'host', value: 'server-01', operator: 'equals' }],
});
```

### 2. Backend - Live Monitor Service

**Güncellenen Dosya:** `apps/webapp/backend/src/services/liveMonitorService.ts`

Değişiklikler:

- ✅ `searchEvents()` - MongoDB yerine Elasticsearch kullanıyor
- ✅ `getAggregation()` - ELK histogram aggregation kullanıyor
- ✅ `getFields()` - ELK index mappings'den field'ları alıyor
- ✅ `index` parametresi eklendi (data model'in ELK index'i)

Öncesi (MongoDB):

```typescript
const events = await collection.find(filter).sort(...).toArray();
```

Sonrası (Elasticsearch):

```typescript
const result = await searchELK({
  index: params.index,
  query: params.query,
  time_range: timeRange,
  size: limit,
});
```

### 3. Frontend - Index Selector Component

**Yeni Dosya:** `apps/webapp/frontend/src/components/live-monitor/IndexSelector.tsx`

Özellikler:

- ✅ Dropdown ile index seçimi
- ✅ Data model bilgilerini gösterir (name, index_name, type, status)
- ✅ Active index'leri filtreler
- ✅ Responsive ve dark mode destekli

### 4. Frontend - Data Models Service

**Yeni Dosya:** `apps/webapp/frontend/src/services/dataModelsService.ts`

Özellikler:

- ✅ `getDataModels()` - Tüm data model'leri getirir
- ✅ `getActiveIndices()` - Sadece aktif index'leri getirir

### 5. Frontend - Live Monitor Service

**Güncellenen Dosya:** `apps/webapp/frontend/src/services/liveMonitorService.ts`

Değişiklikler:

- ✅ `searchEvents()` - `index` parametresi eklendi
- ✅ `getHistogram()` - `index` parametresi eklendi
- ✅ `getFields()` - `index` parametresi eklendi (dataSourceId yerine)

### 6. Frontend - Live Monitor Page

**Güncellenen Dosya:** `apps/webapp/frontend/src/pages/LiveMonitor.tsx`

Değişiklikler:

- ✅ `IndexSelector` component eklendi
- ✅ Data source dropdown kaldırıldı → Index selector ile değiştirildi
- ✅ `selectedIndex` state eklendi
- ✅ `fetchIndices()` - Data model index'lerini yükler
- ✅ `fetchData()` - Seçili index'e göre ELK'dan veri çeker
- ✅ `fetchFields()` - ELK mappings'den field'ları çeker

### 7. Frontend - Detection & Investigation Page

**Güncellenen Dosya:** `apps/webapp/frontend/src/pages/DetectionInvestigation.tsx`

Değişiklikler:

- ✅ `IndexSelector` component eklendi
- ✅ `selectedIndex` state eklendi
- ✅ `fetchIndices()` - Data model index'lerini yükler
- ✅ `loadEvents()` - Seçili index'e göre ELK'dan veri çeker

## Kullanım Akışı

### 1. Index Seçimi

```
User → Live Monitor / Detection & Investigation Page
  ↓
IndexSelector Component
  ↓
dataModelsService.getActiveIndices()
  ↓
Backend: GET /api/data-models (filtered by organization_id)
  ↓
Returns: [
  {
    id: "dm1",
    name: "Linux Resource Monitor - Root Model",
    index_name: "org_111__linux-resource-monitor__v1",
    type: "root",
    status: "active"
  },
  ...
]
```

### 2. Event Arama

```
User types query: "severity:critical AND cpu_usage > 80"
  ↓
Frontend: liveMonitorService.searchEvents({
  index: "org_111__linux-resource-monitor__v1",
  query: "severity:critical AND cpu_usage > 80",
  time_range: { preset: "1h" }
})
  ↓
Backend: POST /api/live-monitor/search
  ↓
liveMonitorService.searchEvents() → searchELK()
  ↓
Elasticsearch: POST /org_111__linux-resource-monitor__v1/_search
{
  "query": {
    "bool": {
      "must": [
        { "query_string": { "query": "severity:critical AND cpu_usage > 80" } }
      ],
      "filter": [
        { "range": { "@timestamp": { "gte": "...", "lte": "..." } } }
      ]
    }
  },
  "size": 100,
  "sort": [{ "@timestamp": "desc" }]
}
  ↓
Returns: Events matching the query
```

### 3. Histogram Aggregation

```
Frontend: liveMonitorService.getHistogram(60, selectedIndex)
  ↓
Backend: POST /api/live-monitor/agg
  ↓
liveMonitorService.getAggregation() → getELKHistogram()
  ↓
Elasticsearch: POST /org_111__linux-resource-monitor__v1/_search
{
  "size": 0,
  "query": { "bool": { "filter": [...] } },
  "aggs": {
    "events_over_time": {
      "date_histogram": {
        "field": "@timestamp",
        "fixed_interval": "3m"
      },
      "aggs": {
        "by_severity": {
          "terms": { "field": "severity.keyword" }
        }
      }
    }
  }
}
  ↓
Returns: Histogram buckets with severity breakdown
```

### 4. Field Discovery

```
Frontend: liveMonitorService.getFields(selectedIndex)
  ↓
Backend: GET /api/live-monitor/fields?index=org_111__linux-resource-monitor__v1
  ↓
liveMonitorService.getFields() → getIndexMappings()
  ↓
Elasticsearch: GET /org_111__linux-resource-monitor__v1/_mapping
  ↓
Returns: Field definitions from index mappings
{
  "properties": {
    "@timestamp": { "type": "date" },
    "severity": { "type": "keyword" },
    "cpu_usage": { "type": "float" },
    "memory_usage": { "type": "float" },
    ...
  }
}
  ↓
Parsed and categorized by field type (common, network, process, file, custom)
```

## ELK Query Syntax

Kullanıcılar aşağıdaki query syntax'larını kullanabilir:

### Basit Aramalar

```
severity:critical
host:server-01
cpu_usage > 80
```

### Boolean Operatörler

```
severity:critical AND cpu_usage > 80
severity:high OR severity:critical
severity:critical AND NOT host:test-*
```

### Wildcard Aramalar

```
host:server-*
message:*error*
user:admin*
```

### Range Sorguları

```
cpu_usage > 80
memory_usage >= 90
port:[8000 TO 9000]
```

### Field Existence

```
_exists_:error_message
NOT _exists_:user
```

### Nested Fields

```
payload.cpu_usage > 80
payload.network.bytes_sent > 1000000
```

## UI Değişiklikleri

### Live Monitor

**Öncesi:**

```
[Data Source Dropdown: All Data Sources | Linux Monitor | Windows Events]
```

**Sonrası:**

```
[Index Selector: Linux Resource Monitor - Root Model]
  ↓ Dropdown
  - Linux Resource Monitor - Root Model
    org_111__linux-resource-monitor__v1
    [active] [root]
  - Windows Event Log - Root Model
    org_111__windows-event-log__v1
    [active] [root]
```

### Detection & Investigation

Aynı index selector eklendi, query ve histogram ELK üzerinden çalışıyor.

## Veri İzolasyonu

### Organization-Scoped Indices

Her organization'ın kendi index'leri var:

```
Organization A (ID: 111):
  - org_111__linux-resource-monitor__v1
  - org_111__windows-event-log__v1
  - org_111__syslog__v1

Organization B (ID: 222):
  - org_222__linux-resource-monitor__v1
  - org_222__windows-event-log__v1
```

### Backend Filtering

Backend, kullanıcının organization_id'sine göre sadece kendi data model'lerini döner:

```typescript
// Data Models Controller
async getAll(req: AuthRequest, res: Response) {
  const organizationId = req.user?.organization_id;
  const models = await dataModelsService.getAll(organizationId);
  // Sadece bu organization'ın data model'leri
}
```

### Elasticsearch Query

ELK query'leri organization-specific index'ler üzerinde çalışır:

```javascript
// Kullanıcı sadece kendi organization'ının index'ini seçebilir
POST / org_111__linux - resource - monitor__v1 / _search;

// Başka organization'ın index'ine erişemez
POST / org_222__linux - resource - monitor__v1 / _search; // ❌ Access denied
```

## Avantajlar

### 1. Performans

- ✅ Elasticsearch, büyük veri setlerinde MongoDB'den çok daha hızlı
- ✅ Full-text search optimize edilmiş
- ✅ Aggregation'lar (histogram, stats) çok hızlı

### 2. Esneklik

- ✅ Güçlü query syntax (boolean, wildcard, range, nested)
- ✅ Real-time indexing
- ✅ Faceted search ve aggregations

### 3. Ölçeklenebilirlik

- ✅ Milyonlarca event'i saniyeler içinde arayabilir
- ✅ Horizontal scaling (cluster)
- ✅ Index sharding ve replication

### 4. Veri İzolasyonu

- ✅ Organization-specific index'ler
- ✅ Backend filtering ile double security
- ✅ Cross-organization erişim mümkün değil

## Test Senaryoları

### Senaryo 1: Index Seçimi ve Arama

```bash
# 1. Kullanıcı login olur
POST /api/auth/login
{ "email": "john@acme.com", "password": "..." }

# 2. Data model index'lerini alır
GET /api/data-models
Authorization: Bearer <jwt>

# Response:
[
  {
    "id": "dm1",
    "name": "Linux Resource Monitor - Root Model",
    "elk": {
      "index_name": "org_111__linux-resource-monitor__v1"
    },
    "status": "active"
  }
]

# 3. Index seçer ve arama yapar
POST /api/live-monitor/search
Authorization: Bearer <jwt>
{
  "index": "org_111__linux-resource-monitor__v1",
  "query": "severity:critical",
  "time_range": { "preset": "1h" }
}

# 4. Elasticsearch'te sorgu çalışır
POST /org_111__linux-resource-monitor__v1/_search
{
  "query": {
    "bool": {
      "must": [{ "query_string": { "query": "severity:critical" } }],
      "filter": [{ "range": { "@timestamp": {...} } }]
    }
  }
}
```

### Senaryo 2: Histogram Görüntüleme

```bash
POST /api/live-monitor/agg
Authorization: Bearer <jwt>
{
  "index": "org_111__linux-resource-monitor__v1",
  "time_range": { "preset": "24h" },
  "interval": 60
}

# Elasticsearch aggregation
POST /org_111__linux-resource-monitor__v1/_search
{
  "size": 0,
  "aggs": {
    "events_over_time": {
      "date_histogram": {
        "field": "@timestamp",
        "fixed_interval": "60m"
      },
      "aggs": {
        "by_severity": {
          "terms": { "field": "severity.keyword" }
        }
      }
    }
  }
}

# Response: Zaman bazlı event sayıları ve severity dağılımı
```

### Senaryo 3: Field Discovery

```bash
GET /api/live-monitor/fields?index=org_111__linux-resource-monitor__v1
Authorization: Bearer <jwt>

# Elasticsearch mapping
GET /org_111__linux-resource-monitor__v1/_mapping

# Response: Field'lar kategorize edilmiş şekilde
[
  {
    "category": "common",
    "fields": [
      { "name": "@timestamp", "type": "date" },
      { "name": "severity", "type": "string" },
      { "name": "host", "type": "string" }
    ]
  },
  {
    "category": "custom",
    "fields": [
      { "name": "cpu_usage", "type": "number" },
      { "name": "memory_usage", "type": "number" }
    ]
  }
]
```

## Örnek ELK Sorguları

### CPU Kullanımı Yüksek Event'ler

```
cpu_usage > 80 AND severity:(high OR critical)
```

### Belirli Bir Host'tan Gelen Event'ler

```
host:server-prod-01 AND @timestamp:[now-1h TO now]
```

### Error İçeren Event'ler

```
message:*error* OR message:*failed* OR message:*exception*
```

### Network Trafiği Yüksek Event'ler

```
bytes_sent > 1000000 AND protocol:tcp
```

### Belirli Kullanıcı Aktiviteleri

```
user:admin AND (action:delete OR action:modify)
```

## Elasticsearch Index Yapısı

### Index Naming Convention

```
org_{organization_id}__{agent_type}__v{version}
```

Örnekler:

- `org_6976ee903bd20e1f00bc5dd6__linux-resource-monitor__v1`
- `org_6976ee903bd20e1f00bc5dd6__windows-event-log__v1`
- `org_6976ee903bd20e1f00bc5dd6__syslog__v1`

### Index Mappings

```json
{
  "org_111__linux-resource-monitor__v1": {
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "organization_id": { "type": "keyword" },
        "agent_id": { "type": "keyword" },
        "data_source_id": { "type": "keyword" },
        "severity": { "type": "keyword" },
        "host": { "type": "keyword" },
        "cpu_usage": { "type": "float" },
        "memory_usage": { "type": "float" },
        "disk_usage": { "type": "float" },
        "network_bytes_sent": { "type": "long" },
        "network_bytes_received": { "type": "long" },
        "message": { "type": "text" }
      }
    }
  }
}
```

## Güvenlik

### 1. Index-Level Isolation

- Her organization'ın kendi index'leri var
- Index isimleri organization_id içerir

### 2. Backend Filtering

- Data models API organization_id ile filtreler
- Kullanıcı sadece kendi organization'ının index'lerini görebilir

### 3. JWT Authentication

- Tüm API çağrıları JWT ile korumalı
- organization_id JWT payload'ında

### 4. No Direct ELK Access

- Frontend direkt Elasticsearch'e erişemez
- Tüm sorgular backend üzerinden geçer
- Backend, kullanıcının sadece kendi index'lerine erişmesini sağlar

## Performans Optimizasyonları

### 1. Index Sharding

```javascript
// Her index için optimal shard sayısı
PUT /org_111__linux-resource-monitor__v1
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1
  }
}
```

### 2. Query Caching

- Elasticsearch otomatik olarak sık kullanılan sorguları cache'ler

### 3. Pagination

- `from` ve `size` parametreleri ile pagination
- Büyük result set'ler için scroll API kullanılabilir

### 4. Field Data Types

- `keyword` - Exact match, aggregation
- `text` - Full-text search
- `date` - Time-based queries ve aggregations

## Sonraki Adımlar (Opsiyonel)

### 1. Advanced Queries

- Saved query templates
- Query builder UI
- Query suggestions

### 2. Visualizations

- Custom dashboards
- Time series charts
- Heatmaps

### 3. Alerting

- ELK Watcher integration
- Real-time alerting based on queries

### 4. Machine Learning

- Anomaly detection
- Pattern recognition
- Forecasting

## Sonuç

✅ **Live Monitor ve Detection & Investigation sayfaları artık ELK tabanlı:**

- Index seçimi ile hangi verinin görüntüleneceği belirlenir
- ELK query syntax ile güçlü aramalar yapılır
- Histogram ve aggregation'lar ELK'dan gelir
- Field'lar ELK index mappings'den alınır
- Organization-based veri izolasyonu korunur

✅ **Performans:**

- MongoDB'den çok daha hızlı arama
- Büyük veri setlerinde optimal performans
- Real-time aggregation'lar

✅ **Güvenlik:**

- Organization-specific index'ler
- Backend filtering
- JWT authentication
- Cross-organization erişim yok
