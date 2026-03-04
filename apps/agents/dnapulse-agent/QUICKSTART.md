# DNA Pulse Agent - Hızlı Başlangıç

## Kurulum ve Test (5 Dakika)

### 1. Agent Binary Oluşturma

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dnapulse/agents/dnapulse-agent
make build
```

### 2. Test Config Oluşturma

```bash
# Config'i kopyalayın
cp configs/agent.example.yaml configs/agent.local.yaml

# API key ekleyin (web uygulamasından alın veya test key oluşturun)
nano configs/agent.local.yaml
```

Config'de düzenleyin:

```yaml
ingestion:
  api_key: 'YOUR_API_KEY_HERE' # Buraya API key girin
```

### 3. Agent'ı Kaydedin

```bash
./build/dnapulse-agent -config configs/agent.local.yaml -register
```

Çıktı:

```
Agent registered successfully
Agent ID: 6976f84dcc9d4f87ab3a3af4
Data Source ID: 6976f849cc9d4f87ab3a3af1
```

### 4. Agent'ı Çalıştırın

```bash
# Foreground'da test için
./build/dnapulse-agent -config configs/agent.local.yaml

# Veya arka planda
nohup ./build/dnapulse-agent -config configs/agent.local.yaml > agent.log 2>&1 &
```

### 5. Web Uygulamasında Görüntüleme

1. Web uygulamasını açın: `http://localhost:5173`
2. **Agents** sayfasına gidin
3. Yeni kayıtlı agent'ınızı görün
4. Status: **online** ✅
5. Last heartbeat: şimdi

### 6. Veri Akışını Kontrol Edin

```bash
# Agent loglarını görüntüleyin
tail -f /tmp/dnapulse-agent-test.log

# Data sources'ı kontrol edin
curl http://localhost:3001/api/data-sources | jq

# Agent'ın gönderdiği event'leri görün
curl http://localhost:3001/api/agents/AGENT_ID/events | jq
```

## Systemd Service Olarak Kurulum

### 1. Install

```bash
cd scripts
sudo ./install.sh
```

### 2. Config Düzenle

```bash
sudo nano /etc/dnapulse-agent/agent.yaml
# API key'inizi ekleyin
```

### 3. Register

```bash
sudo /usr/local/bin/dnapulse-agent -config /etc/dnapulse-agent/agent.yaml -register
```

### 4. Servisi Başlat

```bash
sudo systemctl enable dnapulse-agent
sudo systemctl start dnapulse-agent
sudo systemctl status dnapulse-agent
```

### 5. Logları İzle

```bash
sudo journalctl -u dnapulse-agent -f
```

## Config Değişiklikleri

### Veri Toplama Kaynakları

```yaml
collection:
  sources:
    # Dosya kaynağı
    - type: 'file'
      enabled: true
      path: '/var/log/application.log'
      filter: 'ERROR'

    # Command output
    - type: 'command'
      enabled: true
      command: 'df -h'
```

### Toplama Sıklığı

```yaml
collection:
  interval: 30s # 30 saniyede bir veri topla

ingestion:
  flush_interval: 10s # 10 saniyede bir gönder
  batch_size: 100 # Her batch'te 100 event
```

### Config Sync (Web App'ten Remote Update)

```yaml
sync:
  enabled: true
  interval: 5m
  auto_apply: false # true yaparsanız otomatik uygular (restart gerekir)
```

## Web Uygulamasından Yönetim

### Agent Instance Listesi

- Web app → **Agents** sayfası
- Her sunucudaki agent instance'ları görün
- Status, heartbeat, version bilgileri

### Instance Detayı

- Agent'e tıklayın
- **Config** sekmesi: Ayarları görüntüle/düzenle
- **Logs** sekmesi: Real-time loglar
- **Metrics** sekmesi: CPU, memory, network
- **Events** sekmesi: Gönderilen event'ler

### Config Güncelleme

1. Agent detayında **Config** sekmesine gidin
2. Ayarları düzenleyin (collection interval, veri kaynakları vs.)
3. **Save** butonuna basın
4. Agent 5 dakika içinde (veya hemen restart ile) yeni config'i alır

### Komut Gönderme

```typescript
// API üstünden
POST /api/agent-instances/:instanceId/command
{
  "command": "restart"
}
```

## Troubleshooting

### Agent Başlamıyor

```bash
# Config'i test edin
./build/dnapulse-agent -config configs/agent.local.yaml -test

# Ingestion service çalışıyor mu?
curl http://localhost:19071/health
```

### Veri Gönderilmiyor

```bash
# Log seviyesini debug yapın
# agent.yaml:
agent:
  log_level: "debug"

# Logları kontrol edin
tail -f /tmp/dnapulse-agent-test.log | grep -i error
```

### Web App'te Görünmüyor

```bash
# Backend API kontrol
curl http://localhost:3001/api/agents

# Agent heartbeat gönderiyor mu?
# Log'larda "Health check" arayin
grep "health" /tmp/dnapulse-agent-test.log
```

## Örnek Senaryolar

### Senaryo 1: Syslog Agent

```yaml
agent:
  type: 'syslog'
  name: 'webserver-01-syslog'

collection:
  sources:
    - type: 'file'
      path: '/var/log/syslog'
    - type: 'file'
      path: '/var/log/auth.log'
```

### Senaryo 2: Application Log Agent

```yaml
agent:
  type: 'custom-app'
  name: 'myapp-production'

collection:
  sources:
    - type: 'file'
      path: '/var/log/myapp/application.log'
      filter: 'ERROR|WARN'
      fields:
        application: 'myapp'
        environment: 'production'
```

### Senaryo 3: Metrics Collector

```yaml
agent:
  type: 'metrics'
  name: 'server-metrics'

collection:
  interval: 60s
  sources:
    - type: 'command'
      command: 'df -h'
      fields:
        metric_type: 'disk'
    - type: 'command'
      command: 'free -m'
      fields:
        metric_type: 'memory'
```

## İleri Seviye

### Çoklu Agent (Aynı Sunucuda)

Her agent için ayrı config:

```bash
# Agent 1: Syslog
/usr/local/bin/dnapulse-agent -config /etc/dnapulse-agent/syslog.yaml

# Agent 2: Application logs
/usr/local/bin/dnapulse-agent -config /etc/dnapulse-agent/app.yaml
```

### Custom Veri Kaynağı

Go kodu düzenleyerek yeni collector ekleyin:

- `pkg/collector/collector.go`
- Yeni `type` ekleyin
- `collect()` fonksiyonunda handle edin

### TLS/HTTPS

```yaml
ingestion:
  url: 'https://ingestion.yourdomain.com'
  # TLS certificate verification ayarları
```

## Destek

- Döküman: `/home/mert/Documents/workspace/dnasol-workspace/dnapulse/agents/dnapulse-agent/README.md`
- Loglar: `/var/log/dnapulse-agent/agent.log` (production)
- Issues: GitHub repository
