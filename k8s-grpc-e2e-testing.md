# K8s + gRPC ile Uçtan Uca Test Planı

## Varsayımlar

- Mevcut servislerin çoğu HTTP ile çalışıyor. gRPC endpoint’i olanlar için `grpcurl` kullanacağız; olmayanlarda HTTP ile doğrulayacağız. Gerekirse ileride gRPC server’ları ekleyip planı genişleteceğiz.
- Cluster: Kind. Namespace: `dna-platform`. Helm chart: `deploy/k8s/helm/dna-platform`.
- Proto kaynakları: `contracts/proto/**` ve Buf konfig: `contracts/buf.yaml`.

## 1) Önkoşullar (lokalde)

- kind, kubectl, helm, docker, buf, grpcurl kurulu.
- Repo kökünde çalışın: `dna-platform/`

## 2) İmajları inşa et ve Kind’a yükle

- Tüm servis imajlarını build et (repo içindeki Dockerfile’lar kullanılır)
- Kind cluster’a yükle (image tar veya `kind load docker-image`)

## 3) Helm ile tam stack’i kur

- Namespace oluştur: `dna-platform`
- `helm upgrade --install dna-platform deploy/k8s/helm/dna-platform -n dna-platform -f deploy/k8s/helm/dna-platform/values.yaml`
- Redpanda, Mongo, Elasticsearch (veya OpenSearch), Prometheus, Jaeger, platform servisleri ayağa kalkar

## 4) Port-forward’ları başlat

- Lokal erişim için sabit portlar:
- config: 8087 → svc/config:8080
- ingestion: 8092 → svc/ingestion:8080
- processing: 8093 → svc/processing:8080
- decision: 8091 → svc/decision:8080
- categorization: 8088 → svc/categorization:8080
- correlation: 8089 → svc/correlation:8080
- model: 8090 → svc/model:8080
- elasticsearch: 9200 → svc/elasticsearch:9200
- prometheus: 9090 → svc/prometheus-server:80
- jaeger: 16686 → svc/jaeger-query:16686
- (Opsiyonel) Kibana: 5601 → svc/kibana:5601 (Aşağıda kurulum adımı var)

## 5) Proto descriptor üretimi (grpcurl için)

- `cd contracts`
- `buf lint && buf build -o dna-platform.bin` (tüm proto seti için FileDescriptorSet)
- Testlerde: `grpcurl -plaintext -protoset contracts/dna-platform.bin ...`

## 6) Senaryo A – Basit event akışı (log)

Amaç: Tek bir log event’i gönder, pipeline’da ilerlesin; health/metrics ile servisleri doğrula.

- Hazırlık (Config): Gerekli `processing.rules.yaml`, `categorization.yaml` vb. config kayıtlarını `config` servisine HTTP PUT ile yükleyin (mevcut şema/örneklerinizle)
- Health kontrolleri (HTTP):
- `curl http://localhost:8087/health` (config)
- `curl http://localhost:8092/health` (ingestion)
- `curl http://localhost:8093/health` (processing)
- `curl http://localhost:8091/health` (decision) vb.
- Event gönderimi (gRPC, varsa):
- `grpcurl -plaintext -protoset contracts/dna-platform.bin -d '{ ...IngestRequest JSON... }' localhost:8092 dna.ingestion.v1.IngestionService/Ingest`
- Alternatif (HTTP) ingestion endpoint’i: `curl -X POST http://localhost:8092/ingest -H 'content-type: application/json' -d '{...}'`
- Doğrulama:
- Processing/Categorization/Correlation logları (kubectl logs) ve/veya servis-specific metrics endpoint’leri
- Prometheus’ta metrikleri görüntüle: `http://localhost:9090`
- Elasticsearch index’inde event’leri ara: `curl http://localhost:9200/_cat/indices?v` ve `/_search`

## 7) Senaryo B – Korelasyon ve Karar üretimi

Amaç: Birden çok event göndererek korelasyon kuralını tetiklemek ve decision/alert üretimini doğrulamak.

- Config’e korelasyon kuralları yükle (ör. aynı `source` + `severity` 3+ event → alert)
- Ardışık 3-5 event gönder (aynı `source`, `severity`):
- gRPC ingestion veya HTTP `/ingest`
- Doğrulama:
- Correlation servis loglarında grup anahtarları ve sayacın arttığını gör
- Decision servis loglarında policy evaluation ve alert üretimi gör
- Elasticsearch’te `alerts-*` indeksinde alert dokümanları (varsa) arayın
- Prometheus metriklerinde artış (process edilen event sayısı vb.)

## 8) Senaryo C – Model/Anomali tespiti

Amaç: Model servisini kullanarak karar akışına sinyal sağlamak.

- Model servisine gRPC çağrısı (varsa):
- `grpcurl -plaintext -protoset contracts/dna-platform.bin -d '{ ...InferenceRequest... }' localhost:8090 dna.model.v1.ModelService/Infer`
- Decision ile entegrasyon akışı: İş kurallarına göre `ModelService` sonucu dikkate alınan event gönder
- Doğrulama:
- Decision servis loglarında model sonucunun işlendiğini gör
- Elasticsearch’te ilgili çıktı kayıtları

## 9) Observability – Erişim ve doğrulama

- Prometheus: `http://localhost:9090` (sorgular: `http_requests_total`, servis metrikleri)
- Jaeger: `http://localhost:16686` (trace’ler)
- Elasticsearch: `http://localhost:9200`
- Kibana kurulumu (eğer chart’ta yoksa kısa yol):
- `helm repo add elastic https://helm.elastic.co && helm repo update`
- `helm upgrade --install kibana elastic/kibana -n dna-platform --set service.type=ClusterIP`
- Port-forward: `kubectl -n dna-platform port-forward svc/kibana-kibana 5601:5601`
- Kibana: `http://localhost:5601` (Index Pattern oluştur, `events-*` / `alerts-*`)

## 10) Temizlik

- Port-forward süreçlerini durdur
- `helm -n dna-platform uninstall dna-platform` (ve opsiyonel Kibana)
- `kind delete cluster`

# EXECUTION

## 1) Önkoşulları Doğrulama

cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform && which kind kubectl helm docker buf grpcurl

go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest

which grpcurl

## 2) Docker İmajlarını İnşa Et ve Kind'a Yükle

Önce Kind cluster'ın durumunu kontrol edelim:
kind get clusters

Cluster zaten var. Şimdi tüm servis imajlarını build edelim:
docker build -t dna-platform/ingestion:latest -f services/ingestion/Dockerfile .
docker build -t dna-platform/processing:latest -f services/processing/Dockerfile .
docker build -t dna-platform/correlation:latest -f services/correlation/Dockerfile .
docker build -t dna-platform/config:latest -f services/config/Dockerfile .
docker build -t dna-platform/categorization:latest -f services/categorization/Dockerfile .
docker build -t dna-platform/decision:latest -f services/decision/Dockerfile .
docker build -t dna-platform/model:latest -f services/model/Dockerfile .

Şimdi tüm imajları Kind cluster'a yükleyelim:
kind load docker-image dna-platform/ingestion:latest --name dna-platform
kind load docker-image dna-platform/processing:latest --name dna-platform && kind load docker-image dna-platform/correlation:latest --name dna-platform && kind load docker-image dna-platform/config:latest --name dna-platform && kind load docker-image dna-platform/categorization:latest --name dna-platform && kind load docker-image dna-platform/decision:latest --name dna-platform && kind load docker-image dna-platform/model:latest --name dna-platform

## 3) Helm ile Tam Stack'i Kur

kubectl create namespace dna-platform --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install dna-platform deploy/k8s/helm/dna-platform -n dna-platform -f deploy/k8s/helm/dna-platform/values.yaml
kubectl get pods -n dna-platform
kubectl logs -n dna-platform deployment/dna-platform-decision --tail=10
kubectl logs -n dna-platform deployment/dna-platform-redpanda --tail=10

Redpanda çalışıyor gibi görünüyor. Decision servisini yeniden başlatalım:
kubectl rollout restart deployment/dna-platform-decision -n dna-platform
kubectl get pods -n dna-platform | grep -E "(decision|redpanda)"

Biraz bekleyelim ve tekrar kontrol edelim:
sleep 30 && kubectl get pods -n dna-platform

Decision servisi hala sorun yaşıyor. Categorization ve Correlation servislerini kontrol edelim:
kubectl get pods -n dna-platform | grep -E "(categorization|correlation|model)"

Bu servisler eksik. Helm values'ı kontrol edelim:
readig values.yaml

Servisler tanımlı. Helm chart'ı yeniden deploy edelim:
helm upgrade --install dna-platform deploy/k8s/helm/dna-platform -n dna-platform -f deploy/k8s/helm/dna-platform/values.yaml --force

PVC sorunu var. Önce mevcut release'i uninstall edip yeniden kuralım:
helm uninstall dna-platform -n dna-platform
kubectl delete pvc --all -n dna-platform
helm install dna-platform deploy/k8s/helm/dna-platform -n dna-platform -f deploy/k8s/helm/dna-platform/values.yaml
kubectl get pods -n dna-platform

Categorization, Correlation ve Model servisleri hala yok. Helm chart template'lerini kontrol edelim:
listed deploy/k8s/templates

Categorization, Correlation ve Model servisleri için template dosyaları eksik. Bunları oluşturalım:

Şimdi Helm chart'ı upgrade edelim:
helm upgrade dna-platform deploy/k8s/helm/dna-platform -n dna-platform -f deploy/k8s/helm/dna-platform/values.yaml
kubectl get pods -n dna-platform

Harika! Şimdi tüm servisler var. Correlation'da hata var, kontrol edelim:
kubectl logs -n dna-platform deployment/dna-platform-correlation --tail=10

DNS sorunu var. Biraz bekleyelim ve tekrar deneyelim:
sleep 30 && kubectl get pods -n dna-platform | grep -E "(categorization|correlation|model)"

## 4) Port-Forward'ları Başlat

kubectl port-forward -n dna-platform svc/dna-platform-config 8087:8080 &

cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform && kubectl port-forward -n dna-platform svc/dna-platform-ingestion 8092:8080 &
cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform && kubectl port-forward -n dna-platform svc/dna-platform-processing 8093:8080 &
cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform && kubectl port-forward -n dna-platform svc/dna-platform-decision 8091:8080 &
kubectl port-forward -n dna-platform svc/dna-platform-categorization 8088:8080 &
kubectl port-forward -n dna-platform svc/dna-platform-correlation 8089:8080 &
kubectl port-forward -n dna-platform svc/dna-platform-model 8090:8080 &
kubectl port-forward -n dna-platform svc/dna-platform-elasticsearch 9200:9200 &
kubectl port-forward -n dna-platform svc/dna-platform-prometheus 9090:80 &
kubectl port-forward -n dna-platform svc/dna-platform-jaeger 16686:16686 &
kubectl port-forward -n dna-platform svc/dna-platform-kibana 5601:5601 &

cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform && sleep 5 && curl -s http://localhost:8087/health
curl -s http://localhost:8092/health
curl -s http://localhost:8093/health
curl -s http://localhost:8091/health
curl -s http://localhost:8090/health

## 5) Proto Descriptor Üretimi

cd contracts && buf lint

Lint uyarıları var ama devam edelim. Protoset dosyasını oluşturalım:
buf build -o dna-platform.bin
ls -la dna-platform.bin

## 6) Senaryo A - Basit Event Akışı

Önce config servisine gerekli konfigürasyonları yükleyelim:
url -X PUT http://localhost:8087/v1/config/processing \
 -H "Content-Type: application/json" \
 -d '{
"key": "processing",
"scope": "processing",
"value": {
"rules": [
{
"id": "rule1",
"name": "Basic Processing Rule",
"conditions": {
"event_type": "log"
},
"transformations": [
{
"type": "add_field",
"field": "processed_at",
"value": "{{timestamp}}"
}
],
"output_topic": "processing.processed.v1"
}
]
}
}'
curl -X PUT http://localhost:8087/v1/config/categorization \
 -H "Content-Type: application/json" \
 -d '{
"key": "categorization",
"scope": "categorization",
"value": {
"rules": [
{
"id": "log_categorization",
"name": "Log Categorization",
"conditions": {
"event_type": "log"
},
"categories": [
{
"name": "application",
"confidence": 0.9,
"labels": ["app", "service"]
}
]
}
]
}
}'

Şimdi basit bir event gönderelim:
curl -X POST http://localhost:8092/ingest \
 -H "Content-Type: application/json" \
 -d '{
"event_id": "test-event-001",
"event_type": "log",
"timestamp": "2025-10-15T15:35:00Z",
"source": "test-app",
"severity": "info",
"message": "Test log message for DNA Platform",
"metadata": {
"service": "test-service",
"version": "1.0.0"
}
}'

Harika! Event kabul edildi. Şimdi servislerin loglarını kontrol edelim:
kubectl logs -n dna-platform deployment/dna-platform-processing --tail=5
kubectl logs -n dna-platform deployment/dna-platform-categorization --tail=5

Categorization servisi config yükleyemiyor. Elasticsearch'i kontrol edelim:
curl -s http://localhost:9200/\_cat/indices?v
curl -s "http://localhost:9200/alerts/\_search?pretty" | head -20

Prometheus'u kontrol edelim:
curl -s "http://localhost:9090/api/v1/query?query=up" | jq '.data.result[] | select(.metric.job | contains("dna-platform"))'
curl -s "http://localhost:9090/api/v1/query?query=up"

Prometheus'a erişim sorunu var. Port-forward'u kontrol edelim:
ps aux | grep "port-forward.\*9090"

Port-forward çalışmıyor. Yeniden başlatalım:
kubectl port-forward -n dna-platform svc/dna-platform-prometheus 9090:80 &
cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform && sleep 3 && curl -s http://localhost:9090/api/v1/query?query=up | head -10
curl -s http://localhost:16686/api/services

## 7) Senaryo B - Korelasyon ve Alert Üretimi

Önce correlation config'ini yükleyelim:
curl -X PUT http://localhost:8087/v1/config/correlation \
 -H "Content-Type: application/json" \
 -d '{
"key": "correlation",
"scope": "correlation",
"value": {
"window_duration": "300s",
"group_by": ["source", "severity"],
"emit_if": "count >= 3",
"output_topic": "correlation.grouped.v1"
}
}'

Şimdi aynı source ve severity'ye sahip 5 event gönderelim:
for i in {1..5}; do
curl -X POST http://localhost:8092/ingest \
 -H "Content-Type: application/json" \
 -d "{
\"event_id\": \"correlation-test-$i\",
\"event_type\": \"log\",
\"timestamp\": \"2025-10-15T15:37:00Z\",
\"source\": \"critical-app\",
\"severity\": \"error\",
\"message\": \"Critical error message $i\",
\"metadata\": {
\"service\": \"critical-service\",
\"version\": \"1.0.0\"
}
}"
echo "Event $i sent"
sleep 1
done

Şimdi correlation servisinin loglarını kontrol edelim:
kubectl logs -n dna-platform deployment/dna-platform-correlation --tail=10

Correlation servisi hala config yükleyemiyor. Decision servisinin loglarını kontrol edelim:
kubectl logs -n dna-platform deployment/dna-platform-decision --tail=10

Redpanda'da sorun var. Elasticsearch'te alert'leri kontrol edelim:
curl -s "http://localhost:9200/alerts/\_search?pretty&size=5" | jq '.hits.hits[] | {\_id, \_source}'

## 8) Senaryo C - Model/Inference ile Anomali Tespiti

Model servisine gRPC çağrısı yapalım:
cd contracts && grpcurl -plaintext -protoset dna-platform.bin -d '{
"model_id": "anomaly-detector",
"input_data": {
"features": [0.95, 0.87, 0.92, 0.88, 0.91],
"timestamp": "2025-10-15T15:38:00Z"
},
"options": {
"threshold": 0.8,
"return_probability": true
}
}' localhost:8090 dna.model.v1.ModelService/Predict

Model servisi gRPC endpoint'i yok. HTTP ile test edelim:
curl -X POST http://localhost:8090/predict \
 -H "Content-Type: application/json" \
 -d '{
"model_id": "anomaly-detector",
"input_data": {
"features": [0.95, 0.87, 0.92, 0.88, 0.91],
"timestamp": "2025-10-15T15:38:00Z"
},
"options": {
"threshold": 0.8,
"return_probability": true
}
}'

Model servisinin mevcut endpoint'lerini kontrol edelim:
curl -s http://localhost:8090/docs
curl -s http://localhost:8090/openapi.json | jq '.paths | keys'
curl -X POST http://localhost:8090/v1/infer \
 -H "Content-Type: application/json" \
 -d '{
"model_id": "anomaly-detector",
"input_data": {
"features": [0.95, 0.87, 0.92, 0.88, 0.91],
"timestamp": "2025-10-15T15:38:00Z"
},
"options": {
"threshold": 0.8,
"return_probability": true
}
}'

Schema'yı kontrol edelim:
curl -s http://localhost:8090/openapi.json | jq '.paths."/v1/infer".post.requestBody.content."application/json".schema'
curl -s http://localhost:8090/openapi.json | jq '.components.schemas.InferenceRequest'

Doğru format ile tekrar deneyelim:
curl -X POST http://localhost:8090/v1/infer \
 -H "Content-Type: application/json" \
 -d '{
"features": {
"cpu_usage": 0.95,
"memory_usage": 0.87,
"disk_usage": 0.92,
"network_usage": 0.88,
"load_average": 0.91
}
}'

Harika! Model servisi çalışıyor. Şimdi anomali tespiti için yüksek değerler gönderelim:
curl -X POST http://localhost:8090/v1/infer \
 -H "Content-Type: application/json" \
 -d '{
"features": {
"cpu_usage": 0.99,
"memory_usage": 0.98,
"disk_usage": 0.97,
"network_usage": 0.96,
"load_average": 0.99
}
}'

## 9) Observability - Erişim ve Doğrulama

Prometheus:
curl -s "http://localhost:9090/api/v1/query?query=up" | jq '.data.result[] | select(.metric.job | contains("dna-platform")) | {job: .metric.job, instance: .metric.instance, value: .value[1]}'

Elasticsearch:
curl -s "http://localhost:9200/\_cat/indices?v"

Kibana:
curl -s http://localhost:5601/api/status | jq '.status.overall.state'

Jaeger:
curl -s http://localhost:16686/api/services | jq '.data'

## 10) Temizlik

pkill -f "kubectl port-forward"
helm uninstall dna-platform -n dna-platform
kubectl delete namespace dna-platform
