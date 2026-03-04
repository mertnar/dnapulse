# DNA Pulse Agent

DNA Pulse Agent, sunucularınızdan log ve event verilerini toplayan ve DNA Pulse platformuna ileten hafif bir agent uygulamasıdır.

## Özellikler

- ✅ **Otomatik Kayıt**: API key ile otomatik agent kaydı ve schema discovery
- ✅ **Çoklu Veri Kaynağı**: Dosya, syslog, command output desteği
- ✅ **Batch Processing**: Verimli veri gönderimi için batch işleme
- ✅ **Health Check**: Periyodik health check ve durum bildirimi
- ✅ **Config Sync**: Web uygulamasından remote config güncelleme
- ✅ **Systemd Service**: Linux servisi olarak çalışma desteği
- ✅ **Güvenli**: Minimal yetki, JWT authentication, TLS desteği

## Kurulum

### Gereksinimler

- Linux (Ubuntu 20.04+, CentOS 7+, RHEL 7+)
- systemd
- Aktif DNA Pulse platformu
- API Key (web uygulamasından alınabilir)

### Hızlı Kurulum

```bash
# Repository'yi klonlayın
git clone https://github.com/dnasol/dna-platform.git
cd dna-platform/agents/dnapulse-agent

# Binary'i build edin
make build

# Kurulumu yapın (root gerekli)
cd scripts
sudo ./install.sh
```

### Manuel Kurulum

```bash
# Build
make build

# Kurulum
sudo make install

# Config dosyasını düzenleyin
sudo nano /etc/dnapulse-agent/agent.yaml

# API key'inizi ekleyin
ingestion:
  api_key: "YOUR_API_KEY_HERE"

# Agent'ı kaydedin
sudo /usr/local/bin/dnapulse-agent -config /etc/dnapulse-agent/agent.yaml -register

# Servisi başlatın
sudo systemctl enable dnapulse-agent
sudo systemctl start dnapulse-agent
```

## Konfigürasyon

Config dosyası: `/etc/dnapulse-agent/agent.yaml`

### Temel Ayarlar

```yaml
agent:
  name: 'production-server-01'
  type: 'syslog' # syslog, windows-event, custom-app
  version: '1.0.0'
  platform: 'linux'

ingestion:
  url: 'http://localhost:19071'
  api_key: 'YOUR_API_KEY'
  batch_size: 100
  flush_interval: 10s

collection:
  enabled: true
  interval: 30s
  sources:
    - type: 'file'
      enabled: true
      path: '/var/log/syslog'
```

### Veri Kaynakları

#### Dosya Tabanlı

```yaml
sources:
  - type: 'file'
    enabled: true
    path: '/var/log/application.log'
    filter: 'ERROR' # Opsiyonel filtre
    fields:
      service: 'my-app'
      priority: 'high'
```

#### Command Output

```yaml
sources:
  - type: 'command'
    enabled: true
    command: 'df -h'
    fields:
      metric_type: 'disk_usage'
```

### Config Sync

Web uygulamasından remote config güncelleme:

```yaml
sync:
  enabled: true
  interval: 5m
  auto_apply: false # Otomatik uygulama (restart gerektirir)
  backup_configs: true
```

## Kullanım

### Servis Yönetimi

```bash
# Başlat
sudo systemctl start dnapulse-agent

# Durdur
sudo systemctl stop dnapulse-agent

# Yeniden başlat
sudo systemctl restart dnapulse-agent

# Durum kontrolü
sudo systemctl status dnapulse-agent

# Log görüntüleme
sudo journalctl -u dnapulse-agent -f
```

### Manuel Çalıştırma

```bash
# Test mode (config doğrulama)
sudo /usr/local/bin/dnapulse-agent -config /etc/dnapulse-agent/agent.yaml -test

# Register
sudo /usr/local/bin/dnapulse-agent -config /etc/dnapulse-agent/agent.yaml -register

# Foreground'da çalıştır
sudo /usr/local/bin/dnapulse-agent -config /etc/dnapulse-agent/agent.yaml
```

### Log Dosyaları

- Agent logs: `/var/log/dnapulse-agent/agent.log`
- Systemd logs: `journalctl -u dnapulse-agent`

## Web Uygulaması Entegrasyonu

### Agent'ı Görüntüleme

1. Web uygulamasında **Agents** sayfasına gidin
2. Kayıtlı agent'ınızı listede görün
3. Agent detaylarını inceleyin:
   - Status (online/offline)
   - Last heartbeat
   - Version, Platform
   - Connected data source

### Config Yönetimi

1. Web uygulamasında agent detayına gidin
2. **Config** sekmesinden ayarları görüntüleyin
3. Ayarları düzenleyin ve kaydedin
4. Agent otomatik olarak (veya manuel restart ile) yeni config'i uygular

### Instance Yönetimi

Web uygulamasından her agent instance için:

- Config değişiklikleri
- Restart/stop komutları
- Log görüntüleme
- Metrics ve health status

## Güvenlik

- API key güvenli şekilde saklanmalı (`chmod 640 /etc/dnapulse-agent/agent.yaml`)
- Agent minimal yetkilerle çalışır (`dnapulse` user)
- JWT token ile authenticated communication
- TLS/HTTPS desteği (production için önerilir)

## Troubleshooting

### Agent Kayıt Olmuyor

```bash
# Config'i test edin
sudo /usr/local/bin/dnapulse-agent -config /etc/dnapulse-agent/agent.yaml -test

# API key'i kontrol edin
# Ingestion service'in çalıştığından emin olun
curl http://localhost:19071/health
```

### Veri Gönderilmiyor

```bash
# Log'ları kontrol edin
sudo journalctl -u dnapulse-agent -n 100

# Health check durumunu kontrol edin
# Web uygulamasında agent status'ü kontrol edin
```

### Yüksek CPU/Memory Kullanımı

- `collection.interval` değerini artırın
- `collection.max_batch_size` değerini azaltın
- Gereksiz veri kaynaklarını disable edin

## Development

### Build

```bash
# Local build
make build

# Cross-platform build
make build-all

# Specific platform
make build-linux
make build-windows
make build-macos
```

### Test

```bash
make test
```

## Lisans

Copyright © 2024 DNA Solutions
