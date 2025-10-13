# DNA Platform Contracts

This directory contains the contract definitions for the DNA Platform: Protobuf schemas, OpenAPI specifications, and JSON schemas.

## What is a Contract?

A **contract** is a versioned interface definition that ensures compatibility between services, SDKs, and clients. Contracts define:

- **Event schemas** (Protobuf) for event-driven communication
- **API endpoints** (OpenAPI) for REST interfaces
- **Configuration schemas** (JSON Schema) for validation

## Versioning Strategy

- Use **semantic paths**: `v1`, `v2`, etc.
- **Backward compatibility**: Only add new fields; never remove or change existing field numbers
- **Breaking changes**: Require a new version (e.g., `v1` → `v2`)
- **Field numbering**: Never reuse field numbers; reserved range 19000-19999 is for protoc internal use

## Structure

```
contracts/
├── proto/
│   ├── event/v1/         # Event definitions
│   ├── model/v1/         # ML inference contracts
│   └── decision/v1/      # Alert & decision contracts
├── openapi/              # REST API specifications
├── schemas/              # JSON Schema validators
├── buf.yaml              # Buf configuration
└── buf.gen.yaml          # Code generation config
```

## Generated SDKs

Generated code is output to:

- **Go**: `sdks/go-sdk/gen/`
- **TypeScript**: `sdks/ts-sdk/gen/`
- **Python**: `sdks/py-sdk/gen/`

## Topic Naming Convention

For event-driven topics, use this pattern:

```
<service>.<stage>.<version>

Examples:
- ingestion.raw.v1
- processing.cleaned.v1
- correlation.matched.v1
- decision.alert.v1
```

## Workflow

### 1. Initialize Buf Module (first time only)

```bash
cd contracts
buf mod init
```

### 2. Lint Protobuf Definitions

```bash
buf lint
```

### 3. Generate Code for All SDKs

```bash
buf generate
```

### 4. Check for Breaking Changes

```bash
# Against main branch
buf breaking --against '.git#branch=main'

# Against a specific tag
buf breaking --against '.git#tag=v1.0.0'
```

## Using Generated Code in Services

### Go Service

```go
import (
    eventv1 "github.com/dna/sdks/go-sdk/gen/event/v1"
)

event := &eventv1.Event{
    EventId: "evt_123",
    Source:  "agent://host123/cpu",
    Type:    eventv1.EventType_METRIC,
    // ...
}
```

### TypeScript/Node Service

```typescript
import { Event, EventType } from '@dna/ts-sdk/gen/event/v1/event_pb';

const event = new Event({
  eventId: 'evt_123',
  source: 'agent://host123/cpu',
  type: EventType.METRIC,
  // ...
});
```

### Python Service

```python
from dna.sdks.py_sdk.gen.event.v1 import event_pb2

event = event_pb2.Event(
    event_id='evt_123',
    source='agent://host123/cpu',
    type=event_pb2.METRIC,
)
```

## CI/CD Integration

Breaking change detection runs automatically in GitHub Actions on every PR (see `.github/workflows/buf.yml`).

## Resources

- [Buf Documentation](https://buf.build/docs)
- [Protocol Buffers Language Guide](https://protobuf.dev/programming-guides/proto3/)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [JSON Schema](https://json-schema.org/)
