# 📘 Protocol Buffers (Protobuf) Rehberi - DNA Platform

## 📑 İçindekiler

1. [Protobuf Nedir ve Neden Kullanılır?](#protobuf-nedir-ve-neden-kullanılır)
2. [DNA Platform'da Protobuf Mimarisi](#dna-platformda-protobuf-mimarisi)
3. [Proto Dosyası Nasıl Oluşturulur?](#proto-dosyası-nasıl-oluşturulur)
4. [Best Practices](#best-practices)
5. [Code Generation](#code-generation)
6. [Servisler Arası İletişim](#servisler-arası-iletişim)
7. [Testing](#testing)
8. [Versiyonlama ve Breaking Changes](#versiyonlama-ve-breaking-changes)

---

## Protobuf Nedir ve Neden Kullanılır?

### 🎯 Protobuf Nedir?

Protocol Buffers (Protobuf), Google tarafından geliştirilen **dil-bağımsız**, **platform-bağımsız** bir veri serileştirme formatıdır.

### 💡 Neden Protobuf?

#### ✅ Avantajlar

1. **Performans**
   - JSON'dan 3-10x daha hızlı serileştirme/deserileştirme
   - Binary format sayesinde daha az bant genişliği kullanımı
   - Tipik olarak JSON'dan %30-50 daha küçük mesaj boyutu

2. **Güçlü Tip Kontrolü**
   - Compile-time tip kontrolü
   - Alan tipleri ve yapıları garanti altında
   - IDE desteği ve auto-completion

3. **Geriye Uyumluluk**
   - Eski kod yeni mesajları okuyabilir
   - Yeni kod eski mesajları okuyabilir
   - Smooth migration path

4. **Çoklu Dil Desteği**
   - Go, TypeScript/JavaScript, Python, Java, C++, vb.
   - Aynı .proto dosyasından tüm diller için kod üretimi

5. **Şema Doğrulama**
   - Mesaj yapısı açıkça tanımlanmış
   - Lint ve validation araçları
   - Breaking change detection

#### ⚖️ JSON vs Protobuf Karşılaştırması

```bash
# JSON örneği (102 bytes)
{
  "event_id": "evt_123",
  "source": "agent://host123/cpu",
  "type": "METRIC",
  "value": 95.5
}

# Protobuf binary (yaklaşık 40 bytes)
# %60 daha küçük!
```

**Performans Karşılaştırması:**
- Serileştirme: Protobuf **3-5x daha hızlı**
- Deserileştirme: Protobuf **2-3x daha hızlı**
- Boyut: Protobuf **30-50% daha küçük**

---

## DNA Platform'da Protobuf Mimarisi

### 📂 Dizin Yapısı

```
contracts/
├── proto/
│   └── dna/
│       ├── event/v1/
│       │   └── event.proto           # Event tanımları
│       ├── ingestion/v1/
│       │   └── ingestion.proto       # Ingestion servisi
│       ├── processing/v1/
│       │   └── processing.proto      # Processing servisi
│       ├── categorization/v1/
│       │   └── categorization.proto  # Categorization servisi
│       ├── correlation/v1/
│       │   └── correlation.proto     # Correlation servisi
│       ├── decision/v1/
│       │   └── decision.proto        # Decision servisi
│       ├── config/v1/
│       │   └── config.proto          # Config servisi
│       └── model/v1/
│           └── inference.proto       # Model servisi
├── buf.yaml                          # Buf konfigürasyonu
├── buf.gen.yaml                      # Code generation config
└── README.md                         # Genel dokümantasyon
```

### 🔄 Event Flow

```
┌─────────────┐  Event    ┌─────────────┐  ProcessedEvent  ┌────────────────┐
│  Ingestion  │────────>  │ Processing  │──────────────>   │ Categorization │
└─────────────┘           └─────────────┘                  └────────────────┘
                                                                    │
                                                                    │ CategorizedEvent
                                                                    ▼
┌─────────────┐           ┌─────────────┐                  ┌────────────────┐
│  Decision   │<──────────│ Correlation │<─────────────────│                │
└─────────────┘           └─────────────┘                  └────────────────┘
      │                         │
      │ Alert                   │ CorrelatedEvents
      ▼                         ▼
┌─────────────┐           ┌─────────────┐
│   Actions   │           │   Model     │
└─────────────┘           └─────────────┘
```

---

## Proto Dosyası Nasıl Oluşturulur?

### 📝 Temel Şablon

```protobuf
syntax = "proto3";
package dna.myservice.v1;

import "google/protobuf/timestamp.proto";
import "dna/event/v1/event.proto";

option go_package = "github.com/dnasol/dna-platform/sdks/go-sdk/gen/myservice/v1;myservicev1";

// MyMessage: Açıklama
message MyMessage {
  // Alan açıklaması
  string field_name = 1;
  int32 count = 2;
  google.protobuf.Timestamp created_at = 3;
}

// MyService: gRPC servisi
service MyService {
  rpc DoSomething(MyRequest) returns (MyResponse);
}
```

### 🔢 Alan Numaraları (Field Numbers)

**ÖNEMLİ:** Alan numaraları **asla değiştirilmemeli** ve **yeniden kullanılmamalıdır**!

```protobuf
message Event {
  string event_id = 1;        // ✅ Doğru
  string source = 2;          // ✅ Doğru
  // string old_field = 3;    // ❌ Silinen alan
  reserved 3;                 // ✅ Rezerve et
  reserved "old_field";       // ✅ Alan ismini de rezerve et
  string new_field = 4;       // ✅ Yeni alan için yeni numara
}
```

**Alan Numarası Kuralları:**
- 1-15: En sık kullanılan alanlar için (1 byte encoding)
- 16-2047: Sık kullanılan alanlar için (2 byte encoding)
- 2048+: Nadir kullanılan alanlar için
- 19000-19999: Rezerve (protoc tarafından kullanılır)

### 📦 Veri Tipleri

```protobuf
message DataTypes {
  // String ve bytes
  string name = 1;
  bytes data = 2;
  
  // Sayılar
  int32 count = 3;          // -2^31 to 2^31-1
  int64 big_count = 4;      // -2^63 to 2^63-1
  uint32 positive = 5;      // 0 to 2^32-1
  float score = 6;          // 32-bit float
  double precise = 7;       // 64-bit float
  
  // Boolean
  bool is_active = 8;
  
  // Enum
  Status status = 9;
  
  // Nested message
  Address address = 10;
  
  // Repeated (array)
  repeated string tags = 11;
  
  // Map
  map<string, string> metadata = 12;
  
  // Oneof (sadece birini seç)
  oneof payload {
    string text = 13;
    bytes binary = 14;
  }
  
  // Timestamp
  google.protobuf.Timestamp created_at = 15;
}

enum Status {
  STATUS_UNSPECIFIED = 0;  // Her zaman 0 ile başla
  STATUS_ACTIVE = 1;
  STATUS_INACTIVE = 2;
}
```

### 🎯 gRPC Servis Tipleri

```protobuf
service MyService {
  // 1. Unary RPC (basit request-response)
  rpc GetItem(GetItemRequest) returns (GetItemResponse);
  
  // 2. Server Streaming (sunucu stream gönderir)
  rpc StreamItems(StreamRequest) returns (stream Item);
  
  // 3. Client Streaming (istemci stream gönderir)
  rpc UploadItems(stream Item) returns (UploadResponse);
  
  // 4. Bidirectional Streaming (her iki taraf da stream gönderir)
  rpc Chat(stream Message) returns (stream Message);
}
```

---

## Best Practices

### ✅ DO: Yapılması Gerekenler

1. **Her zaman açıklama ekle**
   ```protobuf
   // User: Kullanıcı bilgileri
   message User {
     // Benzersiz kullanıcı ID
     string user_id = 1;
   }
   ```

2. **Enum'lar 0 ile başla**
   ```protobuf
   enum Status {
     STATUS_UNSPECIFIED = 0;  // ✅ İyi
     STATUS_ACTIVE = 1;
   }
   ```

3. **Alan numaralarını rezerve et**
   ```protobuf
   message Event {
     reserved 2, 15, 9 to 11;
     reserved "old_field", "deprecated_field";
   }
   ```

4. **Paket isimlerini versiyon**
   ```protobuf
   package dna.myservice.v1;  // ✅ İyi
   ```

5. **go_package opsiyonunu ekle**
   ```protobuf
   option go_package = "github.com/dnasol/dna-platform/sdks/go-sdk/gen/myservice/v1;myservicev1";
   ```

### ❌ DON'T: Yapılmaması Gerekenler

1. **Alan numaralarını değiştirme**
   ```protobuf
   string name = 1;
   // string name = 2;  // ❌ ASLA yapma!
   ```

2. **Alan tiplerini uyumsuz şekilde değiştirme**
   ```protobuf
   int32 count = 1;
   // string count = 1;  // ❌ Breaking change!
   ```

3. **Required alan kullanma** (proto3'te yok)
   ```protobuf
   // Proto2 (eski)
   // required string name = 1;  // ❌ Proto3'te kullanılmaz
   
   // Proto3 (yeni)
   string name = 1;  // ✅ Optional by default
   ```

---

## Code Generation

### 🔧 Buf Kurulumu

```bash
# macOS
brew install bufbuild/buf/buf

# Linux
curl -sSL "https://github.com/bufbuild/buf/releases/latest/download/buf-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/buf
chmod +x /usr/local/bin/buf

# Windows
choco install buf
```

### 📋 buf.gen.yaml

```yaml
version: v1
plugins:
  # Go kod üretimi
  - name: go
    out: ../sdks/go-sdk/gen
    opt: paths=source_relative
  
  # Go gRPC kod üretimi
  - name: go-grpc
    out: ../sdks/go-sdk/gen
    opt:
      - paths=source_relative
  
  # TypeScript kod üretimi
  - name: es
    out: ../sdks/ts-sdk/gen
    opt:
      - target=ts
  
  # Python kod üretimi
  - name: python
    out: ../sdks/py-sdk/gen
  
  # Python gRPC kod üretimi (opsiyonel)
  - name: grpc-python
    out: ../sdks/py-sdk/gen
```

### 🚀 Kod Üretimi

```bash
cd contracts

# 1. Lint (hata kontrolü)
buf lint

# 2. Kod üret
buf generate

# 3. Breaking change kontrolü
buf breaking --against '.git#branch=main'
```

---

## Servisler Arası İletişim

### 📨 Kafka ile Event-Driven Communication

**Senaryo:** Ingestion → Processing → Categorization

```go
// 1. Ingestion servisi event üretir
import eventv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/event/v1"

event := &eventv1.Event{
    EventId: uuid.New().String(),
    Source:  "agent://host123/cpu",
    Type:    eventv1.EventType_EVENT_TYPE_METRIC,
    Ts:      timestamppb.Now(),
    Attributes: map[string]string{
        "tenant_id": "tenant_1",
    },
    Body: &eventv1.Event_Metric{
        Metric: &eventv1.MetricBody{
            Name:  "cpu_usage",
            Value: 95.5,
            Unit:  "percent",
        },
    },
}

// Serialize
data, _ := proto.Marshal(event)

// Kafka'ya gönder
producer.Send(&kafka.Message{
    Topic: "ingestion.raw.v1",
    Value: data,
})
```

```typescript
// 2. Processing servisi event'i tüketir
import { Event } from '@dna/ts-sdk/gen/event/v1/event_pb';

consumer.on('message', async (message) => {
  // Deserialize
  const event = Event.fromBinary(message.value);
  
  console.log(`Processing event: ${event.eventId}`);
  
  // İşle...
  const processedEvent = await processEvent(event);
  
  // Sonraki servise gönder
  await sendToKafka('processing.cleaned.v1', processedEvent);
});
```

```python
# 3. Categorization servisi event'i tüketir
from dna.sdks.py_sdk.gen.event.v1 import event_pb2

def handle_message(message):
    # Deserialize
    event = event_pb2.Event()
    event.ParseFromString(message.value)
    
    print(f"Categorizing event: {event.event_id}")
    
    # Kategorize et...
    category = categorize(event)
    
    # Sonraki servise gönder
    send_to_kafka('categorization.labeled.v1', category)
```

### 🔌 gRPC ile Senkron İletişim

**Senaryo:** Decision servisi → Model servisine tahmin isteği

```typescript
// Decision servisi (TypeScript)
import { ModelServiceClient } from '@dna/ts-sdk/gen/model/v1/inference_grpc_pb';
import { InferenceRequest } from '@dna/ts-sdk/gen/model/v1/inference_pb';

const client = new ModelServiceClient(
  'model-service:50051',
  grpc.credentials.createInsecure()
);

const request = new InferenceRequest({
  requestId: 'req_123',
  model: 'anomaly-zscore:v1',
  event: event,
});

client.predict(request, (error, response) => {
  if (error) {
    console.error('Prediction failed:', error);
    return;
  }
  
  console.log(`Score: ${response.score}, Label: ${response.label}`);
  
  if (response.label === 'anomaly') {
    // Alert oluştur
    createAlert(event, response);
  }
});
```

```python
# Model servisi (Python)
import grpc
from dna.sdks.py_sdk.gen.model.v1 import inference_pb2, inference_pb2_grpc

class ModelServiceImpl(inference_pb2_grpc.ModelServiceServicer):
    def Predict(self, request, context):
        # Model ile tahmin yap
        result = self.model.predict(request.features)
        
        return inference_pb2.InferenceResponse(
            request_id=request.request_id,
            model=request.model,
            score=result['score'],
            label=result['label'],
            ts=Timestamp().GetCurrentTime(),
            processing_time_ms=result['processing_time_ms']
        )

# gRPC server başlat
server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
inference_pb2_grpc.add_ModelServiceServicer_to_server(
    ModelServiceImpl(), server
)
server.add_insecure_port('[::]:50051')
server.start()
```

---

## Testing

### 🧪 Proto Dosyası Test Etme

```bash
# 1. Lint testi
buf lint

# 2. Breaking change testi
buf breaking --against '.git#branch=main'

# 3. Format kontrolü
buf format -d  # Diff göster
buf format -w  # Düzelt
```

### 🔍 Üretilen Kod Testi

**Go Örneği:**

```go
// event_test.go
package event_test

import (
    "testing"
    eventv1 "github.com/dnasol/dna-platform/sdks/go-sdk/gen/event/v1"
    "google.golang.org/protobuf/proto"
)

func TestEventSerialization(t *testing.T) {
    // Event oluştur
    event := &eventv1.Event{
        EventId: "evt_123",
        Source:  "test",
        Type:    eventv1.EventType_EVENT_TYPE_METRIC,
    }
    
    // Serialize
    data, err := proto.Marshal(event)
    if err != nil {
        t.Fatalf("Marshal failed: %v", err)
    }
    
    // Deserialize
    var decoded eventv1.Event
    err = proto.Unmarshal(data, &decoded)
    if err != nil {
        t.Fatalf("Unmarshal failed: %v", err)
    }
    
    // Doğrula
    if decoded.EventId != event.EventId {
        t.Errorf("EventId mismatch: got %s, want %s", 
                 decoded.EventId, event.EventId)
    }
}
```

**TypeScript Örneği:**

```typescript
// event.test.ts
import { Event, EventType } from '@dna/ts-sdk/gen/event/v1/event_pb';

describe('Event Protobuf', () => {
  it('should serialize and deserialize correctly', () => {
    // Event oluştur
    const event = new Event({
      eventId: 'evt_123',
      source: 'test',
      type: EventType.EVENT_TYPE_METRIC,
    });
    
    // Serialize
    const bytes = event.toBinary();
    
    // Deserialize
    const decoded = Event.fromBinary(bytes);
    
    // Doğrula
    expect(decoded.eventId).toBe('evt_123');
    expect(decoded.type).toBe(EventType.EVENT_TYPE_METRIC);
  });
});
```

---

## Versiyonlama ve Breaking Changes

### 📌 Versiyonlama Stratejisi

```
dna.myservice.v1  →  dna.myservice.v2
```

**v1 ve v2 yan yana çalışabilir:**
- v1 client → v1 server ✅
- v1 client → v2 server ✅ (backward compatible)
- v2 client → v1 server ❌ (v2'ye özel alanlar kullanılmazsa ✅)

### 🔄 Backward Compatible Changes (Güvenli)

```protobuf
// v1
message User {
  string user_id = 1;
  string name = 2;
}

// v2 - Geriye uyumlu
message User {
  string user_id = 1;
  string name = 2;
  string email = 3;        // ✅ Yeni alan eklendi
  repeated string roles = 4; // ✅ Yeni repeated alan
}
```

### ⚠️ Breaking Changes (Yeni Versiyon Gerektirir)

```protobuf
// v1
message User {
  string user_id = 1;
  int32 age = 2;
}

// v2 - Breaking change!
message User {
  string user_id = 1;
  string age = 2;         // ❌ Tip değişti (int32 → string)
  // user_id alanı silindi  // ❌ Alan silindi
}
```

### 🛡️ Breaking Change Detection

```bash
# CI/CD pipeline'da
buf breaking --against '.git#branch=main'

# Çıktı:
# BREAKING CHANGE: Field "age" changed type from int32 to string
# BREAKING CHANGE: Field "name" was removed
```

---

## 🎓 Öğrenme Kaynakları

1. **Resmi Dokümantasyon**
   - [Protocol Buffers Guide](https://protobuf.dev/)
   - [Buf Documentation](https://buf.build/docs)
   - [gRPC Documentation](https://grpc.io/docs/)

2. **DNA Platform Örnekleri**
   - `contracts/proto/dna/event/v1/event.proto` - Temel event yapısı
   - `contracts/proto/dna/decision/v1/decision.proto` - Kompleks mesaj yapısı
   - `contracts/proto/dna/config/v1/config.proto` - gRPC servisi örneği

3. **Pratik Yapma**
   - Yeni bir servis için proto dosyası oluştur
   - Kod üret ve kullan
   - CI/CD pipeline'ı ekle

---

## 🚀 Hızlı Başlangıç Checklist

- [ ] Buf kurulumu yap
- [ ] Proto dosyası oluştur
- [ ] `buf lint` çalıştır
- [ ] `buf generate` ile kod üret
- [ ] Test yaz
- [ ] gRPC/Kafka entegrasyonu yap
- [ ] Breaking change detection ekle
- [ ] CI/CD pipeline'ına ekle

---

## 📞 Yardım ve Destek

- **Sorular:** DNA Platform ekibine sor
- **Hatalar:** GitHub Issues'a bildir
- **Dokümantasyon:** `contracts/README.md` dosyasına bak

