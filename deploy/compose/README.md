# DNA Platform Services Docker Compose

Bu Docker Compose dosyası DNA Platform'un temel servislerini (ingestion, processing, categorization) ve gerekli altyapı bileşenlerini içerir.

## 🚀 Hızlı Başlangıç

### 1. Servisleri Başlat

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform/deploy/compose
docker compose -f docker-compose.services.yml up -d
```

### 2. Servisleri Kontrol Et

```bash
# Tüm servislerin durumunu kontrol et
docker compose -f docker-compose.services.yml ps

# Logları görüntüle
docker compose -f docker-compose.services.yml logs -f
```

### 3. Servisleri Durdur

```bash
docker compose -f docker-compose.services.yml down
```

## 📋 Servisler

### Altyapı Servisleri

- **Kafka (Redpanda)** - Message broker (Port: 19092)
- **MongoDB** - Veritabanı (Port: 27018)
- **Elasticsearch** - Arama ve analitik (Port: 9200)
- **Prometheus** - Metrik toplama (Port: 9091)

### Uygulama Servisleri

- **Config Service** - Merkezi konfigürasyon yönetimi (Port: 8084)
- **Ingestion Service** - Veri giriş noktası (Port: 8081 HTTP, 9090 gRPC)
- **Processing Service** - Veri işleme ve normalizasyon (Port: 8082)
- **Categorization Service** - Etiketleme ve kategorilendirme (Port: 8083)

## 🔧 Konfigürasyon

### Otomatik Config Yükleme

Servisler başlatıldığında `init-configs` container'ı otomatik olarak `configs/` klasöründeki YAML dosyalarını config service'e yükler:

- `ingestion.yaml` → `/v1/config/ingestion`
- `processing.rules.yaml` → `/v1/config/processing`
- `categorization.yaml` → `/v1/config/categorization`

### Environment Variables

Her servis kendi environment variables'larına sahiptir. Detaylar için `docker-compose.services.yml` dosyasına bakın.

## 🧪 Test Etme

### 1. Health Check'ler

```bash
# Config Service
curl http://localhost:8084/health

# Ingestion Service
curl http://localhost:8081/health

# Processing Service
curl http://localhost:8082/health

# Categorization Service
curl http://localhost:8083/health
```

### 2. Config'leri Kontrol Et

```bash
# Tüm config'leri listele
curl http://localhost:8084/v1/config

# Belirli bir config'i getir
curl http://localhost:8084/v1/config/categorization
```

### 3. Veri Gönderme

```bash
# Ingestion service'e test verisi gönder
curl -X POST http://localhost:8081/v1/ingest \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "test-001",
    "tenant_id": "tenant-1",
    "type": "metric",
    "ts": "2024-01-15T10:30:00Z",
    "payload": {
      "cpu_load": 0.95,
      "memory_usage": 0.85
    },
    "attributes": {
      "host": "server-01",
      "environment": "production"
    }
  }'
```

### 4. Metrikleri Görüntüle

```bash
# Prometheus UI
open http://localhost:9091

# Categorization metrikleri
curl http://localhost:8083/metrics

# Config service metrikleri
curl http://localhost:8084/metrics
```

## 📊 Monitoring

### Prometheus Targets

Prometheus aşağıdaki servislerden metrikleri toplar:

- Config Service: `http://config:8080/metrics`
- Categorization Service: `http://categorization:8083/metrics`
- Ingestion Service: `http://ingestion:8080/metrics`
- Processing Service: `http://processing:8080/metrics`

### Elasticsearch

```bash
# Cluster health
curl http://localhost:9200/_cluster/health

# Index'leri listele
curl http://localhost:9200/_cat/indices
```

### MongoDB

```bash
# MongoDB'ye bağlan
mongosh mongodb://admin:admin123@localhost:27018/admin

# Veritabanlarını listele
show dbs
```

## 🔄 Hot Reload

Config service Server-Sent Events (SSE) kullanarak config değişikliklerini gerçek zamanlı olarak servislere bildirir:

```bash
# SSE stream'i dinle
curl -N http://localhost:8084/v1/stream
```

Config değiştirildiğinde servisler otomatik olarak güncellenir.

## 🐛 Sorun Giderme

### Servisler Başlamıyor

```bash
# Logları kontrol et
docker compose -f docker-compose.services.yml logs [service-name]

# Servis durumunu kontrol et
docker compose -f docker-compose.services.yml ps
```

### Config Yüklenmiyor

```bash
# Init container loglarını kontrol et
docker compose -f docker-compose.services.yml logs init-configs

# Manuel config yükleme
curl -X PUT -H 'Content-Type: application/x-yaml' \
  --data-binary @configs/categorization.yaml \
  http://localhost:8084/v1/config/categorization
```

### Port Çakışması

Eğer portlar kullanımda ise, `docker-compose.services.yml` dosyasındaki port mapping'leri değiştirin.

### Veri Kaybı

Volume'lar persistent olduğu için veriler korunur:

- MongoDB: `mongo-data` volume
- Elasticsearch: `es-data` volume
- Prometheus: `prometheus-data` volume

## 📁 Dosya Yapısı

```
deploy/compose/
├── docker-compose.services.yml  # Ana compose dosyası
├── prometheus.yml               # Prometheus konfigürasyonu
├── init-configs.sh             # Config yükleme scripti
└── README.md                   # Bu dosya
```

## 🔗 Bağlantılar

- **Config Service API**: http://localhost:8084
- **Ingestion API**: http://localhost:8081
- **Processing API**: http://localhost:8082
- **Categorization API**: http://localhost:8083
- **Prometheus UI**: http://localhost:9091
- **Elasticsearch**: http://localhost:9200
- **MongoDB**: mongodb://localhost:27018

## 📚 Daha Fazla Bilgi

- [Config Service README](../../services/config/README.md)
- [Categorization Service README](../../services/categorization/README.md)
- [Ingestion Service](../../services/ingestion/)
- [Processing Service](../../services/processing/)
