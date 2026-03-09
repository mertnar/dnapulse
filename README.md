# DNAPulse

DNAPulse; ajan tabanlı log toplama, gerçek zamanlı izleme ve detection & investigation özelliklerini bir arada sunan bir güvenlik veri platformudur. Platform; Kafka (Redpanda), Elasticsearch, MongoDB, Go tabanlı processing servisi ve React/Vite web arayüzünden oluşur.

Bu depo; DNAPulse’in **tam çalışan geliştirme ortamını** (Docker Compose ile) ve tüm backend / frontend / processing servislerini içerir.

---

## İçerik

- [Mimari Genel Bakış](#mimari-genel-bakış)
- [Öne Çıkan Özellikler](#öne-çıkan-özellikler)
- [Geliştirme Ortamını Çalıştırma](#geliştirme-ortamını-çalıştırma)
- [Veri Modelleri & Derived Models](#veri-modelleri--derived-models)
- [Live Monitor](#live-monitor)
- [Detection & Investigation ve Saved Views](#detection--investigation-ve-saved-views)
- [Processing Servisi](#processing-servisi)

---

## Mimari Genel Bakış

Ana bileşenler:

- **apps/webapp/backend**: Node.js/Express REST API
- **apps/webapp/frontend**: React + Vite tabanlı web arayüzü
- **services/processing**: Go ile yazılmış event processing servisi
- **Kafka (Redpanda)**: Event kuyruğu
- **Elasticsearch + Kibana**: Arama, indeksleme ve görselleştirme
- **MongoDB**: Konfigürasyon ve meta-data saklama (data models, saved views, vs.)
- **deploy/compose**: Geliştirme ortamı için `docker-compose.dev.yml`

---

## Öne Çıkan Özellikler

- **Data Models & Derived Models**

  - Root ve derived data model yapısı
  - Her derived model için ayrı Elasticsearch index’i
  - Seçili alanlarla (attributes) sınırlı derived index oluşturma
  - Derived attribute desteği:
    - `math / derive_math`
    - `concat / derive_concat`
    - `conditional / derive_conditional`
    - `extract_regex`
    - `normalize`
    - Advanced expression (custom expression)

- **Live Monitor**

  - Index bazlı event listesi
  - Zaman aralığı seçimi (preset + custom)
  - Histogram ve temel filtreler

- **Detection & Investigation**
  - KQL benzeri sorgu ile arama
  - Saved Views:
    - View olarak sorgu + time range + filtre + görselleştirme ayarlarını kaydetme
    - Tablo veya grafik (bar/line/area/pie/scatter) görünümleri
    - Otomatik yenileme (auto-refresh), zaman aralığı seçimi
    - Views sayfasında grid/list görünümü, arama ve filtreleme

---

## Geliştirme Ortamını Çalıştırma

Önkoşullar:

- Docker & Docker Compose
- Linux / macOS (veya WSL2)

Adımlar:

```bash
git clone https://github.com/mertnar/dnapulse.git
cd dnapulse

# Geliştirme ortamını ayağa kaldır
docker compose -f docker-compose.dev.yml up -d
```

Servisler:

- Web arayüzü: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- Kibana: `http://localhost:5601`

Logları görmek için:

```bash
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f processing
```

---

## Veri Modelleri & Derived Models

Veri modelleri; MongoDB’de saklanan ve hem processing servisi hem de web arayüzü tarafından kullanılan şemalardır.

- **Root Model**: Kaynağın (örn. Linux agent) ürettiği ham event’leri temsil eder.
- **Derived Model**: Bir veya birden fazla root modelden türetilen, sadece seçili alanları ve hesaplanmış (derived) alanları içeren yeni bir index’tir.

Son değişikliklerle birlikte:

- Derived model oluştururken önce model ve attribute’lar MongoDB’ye yazılır, sonra Elasticsearch mapping güncellenir.
- Hem backend hem de processing servisi; nested alanlar ve array/object tipleri için doğru mapping’i üretir.
- Processing servisi, root event’leri okuyup ilgili derived modeller için:
  - Seçilen attribute’ları kopyalar
  - Derived attribute’ların hesaplamasını yapar
  - Sonuç event’i derived index’e yazar.

---

## Live Monitor

`/live-monitor` sayfası:

- Organizasyonun data model index’lerini listeler.
- Seçilen index için:
  - Event listesi
  - Zaman aralığı (15m / 1h / 24h / 7d / custom)
  - Basit filtreler (severity, source, vs.)

Backend tarafında `apps/webapp/backend/src/services/liveMonitorService.ts` dosyası; Elasticsearch’e sorgu ve histogram isteklerini yöneten ana katmandır.

---

## Detection & Investigation ve Saved Views

`/detection` sayfası, gelişmiş arama ve inceleme (investigation) arayüzünü sağlar. Buradan:

- KQL benzeri sorgular ile indeksler üzerinde arama yapabilirsiniz.
- Çalışan bir sorguyu **Saved View** olarak kaydedebilirsiniz:
  - Query
  - Time range
  - Seçili kolonlar
  - Filtreler (`pinned_filters` / `datasource_scope`)
  - Visualization config (table / line / bar / area / pie / scatter)

### Views Sayfası

- `/views` altında:
  - Tüm kayıtlı view’ler grid veya list görünümünde gösterilir.
  - Arama kutusu (isim, açıklama, query içinde arama)
  - Visualization tipine göre filtreleme
  - Her kart için: Open, Edit, Duplicate, Delete aksiyonları

### View Detail

- `/views/:id`:
  - Seçilen view’e göre:
    - Tablo görünümü veya grafik görünümü
    - Time range seçici (preset + custom)
    - Auto-refresh (Off / 10s / 30s / 1m)
    - CSV export
    - Fullscreen mod

### View Edit

- `/views/:id/edit`:
  - View ismi ve açıklamasını güncelleme
  - Visualization tipini kartlar üzerinden seçme
  - X/Y axis alanları ve aggregation ayarları
  - Legend / grid / stacked seçenekleri

---

## Processing Servisi

`services/processing` dizini, agent’lardan gelen event’leri işleyip Elasticsearch’e yazan Go uygulamasını içerir.

Önemli parçalar:

- `cmd/processing/main.go`: Uygulamanın giriş noktası; Kafka’dan okuyup pipeline + derived model işleme mantığını koşturur.
- `internal/model`: Data model tanımları ve registry.
- `internal/transform/derived.go`: Derived model transformer:
  - Seçilen attribute’ları event’ten çıkarır.
  - Derived attribute’ları (`math`, `concat`, `conditional`, `extract_regex`, `normalize`, advanced expression) hesaplar.
  - Sonuç event’i, ilgili derived index’e hazırlar.

Geliştirme sırasında sadece processing servisini yeniden derlemek için:

```bash
docker compose -f docker-compose.dev.yml build processing
docker compose -f docker-compose.dev.yml restart processing
```

---

## Katkı ve Geliştirme

Bu proje aktif geliştirme altındadır. Yeni özellikler eklerken:

- Backend için TypeScript + Express kod yapısını,
- Frontend için React + Vite + Tailwind bileşen pattern’lerini,
- Processing için mevcut Go kod stilini ve `golangci-lint` kurallarını

izlemeniz tavsiye edilir.
