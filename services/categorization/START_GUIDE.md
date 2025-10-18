# Categorization Servisini Başlatma Rehberi

## 📋 Gereksinimler

### 1. Bağımlılıklar

- Node.js 20+
- MongoDB (running on `localhost:27017`)
- Config Service (running on `localhost:8084`)

### 2. Opsiyonel

- Elasticsearch (for search functionality)
- Jaeger (for tracing)

---

## 🚀 Hızlı Başlangıç

### Adım 1: Bağımlılıkları Yükle

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform/services/categorization
npm install
```

### Adım 2: Ortam Değişkenlerini Ayarla

`.env` dosyası oluştur:

```bash
# Service Configuration
PORT=8083
HOST=0.0.0.0
LOG_LEVEL=info

# Config Service (ZORUNLU)
CONFIG_URL=http://localhost:8084
CONFIG_SCOPE=categorization
CONFIG_SSE_URL=http://localhost:8084/v1/stream

# MongoDB (ZORUNLU)
MONGO_URI=mongodb://localhost:27017
MONGO_DATABASE=categorization

# Elasticsearch (Opsiyonel - Search için)
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=categorized-items

# Observability (Opsiyonel)
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Authentication (Development için bypass)
BYPASS_AUTH=true
JWT_SECRET=dev-secret-key
```

### Adım 3: Config Service'i Hazırla

Config service'de `categorization` scope için config olmalı:

**Config Service'e POST et:**

```bash
curl -X POST http://localhost:8084/v1/config/categorization \
  -H 'Content-Type: application/json' \
  -d @dev.categorization.json
```

**Veya `dev.categorization.json` dosyasını kullan:**

```json
{
  "version": 1,
  "cardinality": "one_to_many",
  "label_kind": "category",
  "default_label": "uncategorized",
  "targets": {
    "item_types": ["metric", "log", "trace"]
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
    }
  }
}
```

### Adım 4: MongoDB'yi Başlat

```bash
# Docker ile
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Veya yerel MongoDB
sudo systemctl start mongodb
```

### Adım 5: Config Service'i Başlat

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform/services/config
npm run dev
```

### Adım 6: Categorization Servisini Başlat

**Development Mode:**

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform/services/categorization
npm run dev
```

**Production Mode:**

```bash
# Build
npm run build

# Start
npm start
```

---

## ✅ Servisin Çalıştığını Kontrol Et

### Health Check

```bash
curl http://localhost:8083/health
```

Beklenen yanıt:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "mongodb": "connected",
    "config": "connected"
  }
}
```

### Readiness Check

```bash
curl http://localhost:8083/ready
```

### Metrics

```bash
curl http://localhost:8083/metrics
```

---

## 🧪 Test Etme

### 1. Label Oluştur

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

### 2. Item'lara Label Ata

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
          "cpu_load": 0.95
        },
        "attributes": {}
      }
    ]
  }'
```

### 3. Item'ın Label'larını Sorgula

```bash
curl http://localhost:8083/v1/items/evt-001/labels
```

---

## 🐳 Docker ile Başlatma

### Build

```bash
npm run docker:build
```

### Run

```bash
docker run -d \
  -p 8083:8083 \
  -e CONFIG_URL=http://host.docker.internal:8084 \
  -e MONGO_URI=mongodb://host.docker.internal:27017 \
  -e BYPASS_AUTH=true \
  --name categorization \
  dna-categorization
```

---

## 🔧 Sorun Giderme

### Config Service'e Bağlanamıyor

```bash
# Config service'in çalıştığını kontrol et
curl http://localhost:8084/health

# SSE endpoint'ini kontrol et
curl http://localhost:8084/v1/stream
```

### MongoDB'ye Bağlanamıyor

```bash
# MongoDB'nin çalıştığını kontrol et
mongosh --eval "db.adminCommand('ping')"

# Docker container'ı kontrol et
docker ps | grep mongodb
```

### Config Yüklenmiyor

```bash
# Config'i manuel yükle
curl -X POST http://localhost:8084/v1/config/categorization \
  -H 'Content-Type: application/json' \
  -d @dev.categorization.json

# Config'i kontrol et
curl http://localhost:8084/v1/config/categorization
```

### Hot-Reload Çalışmıyor

```bash
# SSE bağlantısını test et
curl -N http://localhost:8084/v1/stream

# Config'i güncelle ve SSE event'ini gözlemle
curl -X POST http://localhost:8084/v1/config/categorization \
  -H 'Content-Type: application/json' \
  -d '{"version": 2, ...}'
```

---

## 📊 Monitoring

### Logs

```bash
# Development logs
tail -f logs/categorization.log

# Docker logs
docker logs -f categorization
```

### Metrics (Prometheus format)

```bash
curl http://localhost:8083/metrics
```

Önemli metrikler:

- `dna_categorization_items_processed_total`
- `dna_categorization_labels_assigned_total`
- `dna_categorization_pipeline_executions_total`
- `dna_categorization_processing_duration_seconds`

---

## 🎯 Test Sonuçları

Tüm testler başarıyla geçiyor:

```
Test Suites: 4 passed, 4 total
Tests:       22 passed, 22 total
✅ Config Service Integration
✅ SSE Hot-Reload
✅ All Labelers (Rule-based, External DB, ML, User)
✅ Error Handling
```

---

## 📚 API Endpoints

| Method | Endpoint               | Description                |
| ------ | ---------------------- | -------------------------- |
| GET    | `/health`              | Health check               |
| GET    | `/ready`               | Readiness check            |
| GET    | `/metrics`             | Prometheus metrics         |
| POST   | `/v1/labels`           | Create label               |
| GET    | `/v1/labels`           | List labels                |
| GET    | `/v1/labels/:id`       | Get label                  |
| PUT    | `/v1/labels/:id`       | Update label               |
| DELETE | `/v1/labels/:id`       | Delete label               |
| POST   | `/v1/assign`           | Assign labels to items     |
| POST   | `/v1/assign/bulk`      | Bulk assignment            |
| GET    | `/v1/items/:id/labels` | Get item labels            |
| GET    | `/v1/items/search`     | Search items (requires ES) |
| DELETE | `/v1/items/:id/labels` | Remove item labels         |

---

## 🎉 Başarılı Başlatma!

Servis çalışıyor olmalı:

- 🟢 Health: http://localhost:8083/health
- 🟢 Metrics: http://localhost:8083/metrics
- 🟢 API Docs: README.md dosyasına bakın
