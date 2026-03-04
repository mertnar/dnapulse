# Data Source & Data Model Isolation

## Özet

DNA Pulse platformunda **data source** ve **data model** yapıları **organization-scoped** (account'a özel) olarak tasarlanmıştır.

## Temel Kurallar

### 1. Data Source Kuralları

✅ **Her organization için ayrı data source**

- Aynı agent type'ı kullanan farklı organization'lar, her biri kendi data source'una sahip olur
- Query: `{ organization_id: orgID, agent_type: agentType }`

✅ **Bir organization'da aynı agent type'dan maksimum 1 data source**

- İlk agent register olduğunda data source oluşturulur
- Sonraki agent'lar aynı data source'u kullanır
- `agent_count` alanı her yeni agent ile artırılır

✅ **Farklı agent type'lar için farklı data source'lar**

- Aynı organization içinde bile, her agent type'ın kendi data source'u vardır

### 2. Data Model Kuralları

✅ **Her data source için bir root data model**

- Data source oluşturulduğunda otomatik olarak root data model oluşturulur
- `organization_id` ile ilişkilendirilir

✅ **Organization-specific Elasticsearch index**

- Index adı formatı: `org_{organization_id}__{agent_type}__v{version}`
- Örnek: `org_6976ee903bd20e1f00bc5dd6__linux-resource-monitor__v1`
- Bu sayede Elasticsearch'te de veri izolasyonu sağlanır

## Kod Akışı

### Agent Registration Sırasında

```go
// 1. Organization ID'yi API key'den al
orgID := getOrgIDFromAPIKey(apiKey)

// 2. Bu organization için bu agent type'dan data source var mı kontrol et
dataSource, err := mongoStore.GetDataSourceByAgentType(ctx, orgID, agentType)

if err != nil {
    // 3. Yoksa yeni data source oluştur
    dataSource = &mongo.DataSource{
        OrganizationID: orgID,
        Name:           generateName(agentType),
        AgentType:      agentType,
        AgentCount:     0,
    }
    mongoStore.CreateDataSource(ctx, dataSource)

    // 4. Root data model oluştur
    rootModel = &mongo.DataModel{
        OrganizationID: orgID,
        DataIndex:      agentType,
        Source: {
            DataSourceIDs: [dataSource.ID],
        },
        ELK: {
            IndexName: fmt.Sprintf("org_%s__%s__v1", orgID, agentType),
        },
    }
    mongoStore.CreateDataModel(ctx, rootModel)
}

// 5. Agent'ı oluştur ve mevcut data source'a bağla
agent = &mongo.Agent{
    OrganizationID: orgID,
    DataSourceID:   dataSource.ID,
    ...
}
mongoStore.CreateAgent(ctx, agent)

// 6. Data source'un agent sayısını artır
mongoStore.IncrementDataSourceAgentCount(ctx, dataSource.ID)
```

## Veritabanı Yapısı

### data_sources Collection

```javascript
{
  _id: ObjectId("ds1"),
  organization_id: ObjectId("111"),  // Acme Corp
  name: "Linux Resource Monitor",
  type: "agent-based",
  agent_type: "linux-resource-monitor",
  status: "active",
  agent_count: 3,  // Bu organization'da bu type'dan 3 agent var
  created_at: ISODate("2026-02-24T10:00:00Z")
}

{
  _id: ObjectId("ds2"),
  organization_id: ObjectId("222"),  // TechCo
  name: "Linux Resource Monitor",
  type: "agent-based",
  agent_type: "linux-resource-monitor",  // Aynı agent type
  status: "active",
  agent_count: 2,  // Bu organization'da bu type'dan 2 agent var
  created_at: ISODate("2026-02-24T11:00:00Z")
}
```

### data_models Collection

```javascript
{
  _id: ObjectId("dm1"),
  organization_id: ObjectId("111"),  // Acme Corp
  name: "Linux Resource Monitor - Root Model",
  data_index: "linux-resource-monitor",
  type: "root",
  source: {
    data_source_ids: [ObjectId("ds1")],
    agent_type: "linux-resource-monitor"
  },
  elk: {
    index_name: "org_111__linux-resource-monitor__v1"  // Acme Corp'un index'i
  }
}

{
  _id: ObjectId("dm2"),
  organization_id: ObjectId("222"),  // TechCo
  name: "Linux Resource Monitor - Root Model",
  data_index: "linux-resource-monitor",
  type: "root",
  source: {
    data_source_ids: [ObjectId("ds2")],
    agent_type: "linux-resource-monitor"
  },
  elk: {
    index_name: "org_222__linux-resource-monitor__v1"  // TechCo'nun index'i
  }
}
```

### agents Collection

```javascript
// Acme Corp'un agent'ları
{
  _id: ObjectId("a1"),
  organization_id: ObjectId("111"),
  data_source_id: ObjectId("ds1"),  // Acme Corp'un data source'u
  name: "server-prod-01",
  agent_type: "linux-resource-monitor"
}

{
  _id: ObjectId("a2"),
  organization_id: ObjectId("111"),
  data_source_id: ObjectId("ds1"),  // Aynı data source
  name: "server-prod-02",
  agent_type: "linux-resource-monitor"
}

// TechCo'nun agent'ları
{
  _id: ObjectId("a3"),
  organization_id: ObjectId("222"),
  data_source_id: ObjectId("ds2"),  // TechCo'nun data source'u
  name: "web-server-01",
  agent_type: "linux-resource-monitor"
}
```

## Güvenlik ve İzolasyon

### 1. Veritabanı Seviyesinde İzolasyon

```javascript
// Data source sorgusu - DAIMA organization_id ile filtrele
db.data_sources.find({
  organization_id: ObjectId('111'),
  agent_type: 'linux-resource-monitor',
});

// Data model sorgusu - DAIMA organization_id ile filtrele
db.data_models.find({
  organization_id: ObjectId('111'),
});
```

### 2. Elasticsearch Seviyesinde İzolasyon

```javascript
// Her organization'ın kendi index'i var
Acme Corp: org_111__linux-resource-monitor__v1
TechCo:    org_222__linux-resource-monitor__v1

// Event'ler organization'a özel index'e yazılır
PUT /org_111__linux-resource-monitor__v1/_doc/evt1
{
  "organization_id": "111",
  "agent_id": "a1",
  "cpu_usage": 45.2,
  ...
}
```

### 3. API Seviyesinde İzolasyon

```typescript
// Backend - Data Sources Controller
async getAll(req: AuthRequest, res: Response) {
  const organizationId = req.user?.organization_id;  // JWT'den al
  const dataSources = await dataSourcesService.getAll(organizationId);
  // Sadece bu organization'ın data source'larını döner
}

// Backend - Data Models Controller
async getAll(req: AuthRequest, res: Response) {
  const organizationId = req.user?.organization_id;  // JWT'den al
  const dataModels = await dataModelsService.getAll(organizationId);
  // Sadece bu organization'ın data model'lerini döner
}
```

## Test Senaryoları

### Senaryo 1: İki Organization, Aynı Agent Type

```bash
# Acme Corp (org: 111)
curl -X POST http://ingestion:8080/api/v1/register \
  -H "X-API-Key: dna_acme_key_123" \
  -d '{"agent_type": "linux-resource-monitor", ...}'

# Sonuç:
# - Data Source oluşturuldu: ds1 (org: 111, type: linux-resource-monitor)
# - Data Model oluşturuldu: dm1 (org: 111)
# - Agent oluşturuldu: a1 (data_source_id: ds1)

# TechCo (org: 222)
curl -X POST http://ingestion:8080/api/v1/register \
  -H "X-API-Key: dna_techco_key_456" \
  -d '{"agent_type": "linux-resource-monitor", ...}'

# Sonuç:
# - Data Source oluşturuldu: ds2 (org: 222, type: linux-resource-monitor)
# - Data Model oluşturuldu: dm2 (org: 222)
# - Agent oluşturuldu: a3 (data_source_id: ds2)

# ✅ Her organization'ın kendi data source ve data model'i var
```

### Senaryo 2: Aynı Organization, Aynı Agent Type'dan 2. Agent

```bash
# Acme Corp - İlk agent
curl -X POST http://ingestion:8080/api/v1/register \
  -H "X-API-Key: dna_acme_key_123" \
  -d '{"agent_name": "server-prod-01", "agent_type": "linux-resource-monitor", ...}'

# Sonuç:
# - Data Source oluşturuldu: ds1 (agent_count: 1)
# - Data Model oluşturuldu: dm1
# - Agent oluşturuldu: a1

# Acme Corp - İkinci agent
curl -X POST http://ingestion:8080/api/v1/register \
  -H "X-API-Key: dna_acme_key_123" \
  -d '{"agent_name": "server-prod-02", "agent_type": "linux-resource-monitor", ...}'

# Sonuç:
# - Data Source bulundu: ds1 (YENİ OLUŞTURULMADI, agent_count: 2)
# - Data Model mevcut (YENİ OLUŞTURULMADI)
# - Agent oluşturuldu: a2 (data_source_id: ds1)

# ✅ Aynı data source kullanıldı, yeni oluşturulmadı
```

### Senaryo 3: Aynı Organization, Farklı Agent Type'lar

```bash
# Acme Corp - Linux agent
curl -X POST http://ingestion:8080/api/v1/register \
  -H "X-API-Key: dna_acme_key_123" \
  -d '{"agent_type": "linux-resource-monitor", ...}'

# Sonuç:
# - Data Source: ds1 (org: 111, type: linux-resource-monitor)
# - Data Model: dm1

# Acme Corp - Windows agent
curl -X POST http://ingestion:8080/api/v1/register \
  -H "X-API-Key: dna_acme_key_123" \
  -d '{"agent_type": "windows-event-log", ...}'

# Sonuç:
# - Data Source: ds2 (org: 111, type: windows-event-log)  ← YENİ
# - Data Model: dm2  ← YENİ

# ✅ Farklı agent type'lar için farklı data source'lar oluşturuldu
```

## Sonuç

✅ **Data Source İzolasyonu:**

- Her organization için ayrı data source
- Aynı organization'da aynı agent type'dan maksimum 1 data source
- Farklı agent type'lar için farklı data source'lar

✅ **Data Model İzolasyonu:**

- Her data source için bir root data model
- Organization-specific Elasticsearch index'leri

✅ **Güvenlik:**

- Tüm sorgular organization_id ile filtrelenir
- Cross-organization erişim mümkün değil
- Elasticsearch'te bile veri izolasyonu sağlanır

✅ **Mevcut Kod:**

- Sistem zaten bu şekilde çalışıyor
- `GetDataSourceByAgentType` fonksiyonu organization_id + agent_type ile sorgu yapıyor
- Yeni kod değişikliğine gerek yok
