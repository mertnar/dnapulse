# DNA Platform Hardening - Migration to Protobuf & Security

## Overview

This document describes the hardening improvements made to the DNA platform:

- ✅ Migrated from JSON to Protobuf binary format across all services
- ✅ Added JWT authentication middleware to ingestion service
- ✅ Implemented pre-commit hooks with linting
- ✅ Added unit tests for processing service
- ✅ Configured code quality tools

## Changes Made

### 1. Protobuf Migration

**Contracts:**

- `contracts/proto/event/v1/event.proto` - Event schema definition
- `contracts/buf.gen.yaml` - Updated for protobuf code generation

**Generated SDKs:**

- `sdks/go-sdk/gen/event/v1/event.pb.go` - Go protobuf bindings
- `sdks/ts-sdk/gen/event/v1/event_pb.ts` - TypeScript type definitions

**Services Updated:**

**Ingestion (Go):**

- Now uses `google.golang.org/protobuf` to serialize events
- Converts JSON HTTP requests to protobuf before sending to Kafka
- Added dependencies: `golang-jwt/jwt/v5`, `google.golang.org/protobuf`

**Processing (Go):**

- Consumes and produces protobuf-encoded Kafka messages
- Added `normalizeEvent()` function with unit tests
- Dependencies updated to include protobuf support

**Decision (TypeScript):**

- Decodes protobuf messages from Kafka using `protobufjs`
- Falls back to graceful handling if proto schema unavailable
- Added dependency: `protobufjs`

### 2. JWT Authentication

**Location:** `services/ingestion/cmd/ingestion/main.go`

**Middleware:** `jwtMiddleware()`

- Validates JWT tokens from `Authorization: Bearer <token>` header
- Checks issuer (`JWT_ISSUER` env var)
- Checks audience (`JWT_AUD` env var)
- Uses HMAC signature validation with `JWT_SECRET`

**Configuration:**

```bash
# Enable JWT validation (disabled if empty)
JWT_ISSUER=https://auth.dnasol.io
JWT_AUD=dna-platform-api
JWT_SECRET=your-secret-key-here
```

**Bypass:** If `JWT_ISSUER` is not set, JWT validation is skipped (for local dev).

### 3. Testing

**Unit Tests Added:**

- `services/processing/cmd/processing/normalize_test.go`
  - Tests for `determineSeverity()` function
  - Tests for `normalizeEvent()` enrichment logic
  - Uses `testify/assert` for assertions

**Run Tests:**

```bash
cd services/processing
go test ./...
```

### 4. Code Quality & Linting

**Pre-commit Configuration:** `.pre-commit-config.yaml`

- Go: `golangci-lint` with `.golangci.yml` config
- Python: `ruff` for scripts
- TypeScript/JS: `prettier` + `eslint`
- Protobuf: `buf lint`
- General: trailing whitespace, large files, private keys

**Config Files:**

- `.golangci.yml` - Go linter configuration
- `.prettierrc.json` - TypeScript/JavaScript formatting
- `.eslintrc.json` - TypeScript linting rules

## Setup Instructions

### 1. Install Tools

**Go:**

```bash
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

**Buf (Protobuf):**

```bash
# Install buf CLI
brew install bufbuild/buf/buf
# or
go install github.com/bufbuild/buf/cmd/buf@latest
```

**Pre-commit:**

```bash
pip install pre-commit
```

**Node.js (for TypeScript services):**

```bash
cd services/decision
npm install
```

### 2. Setup Pre-commit Hooks

```bash
cd /home/mert/Documents/workspace/dnasol-workspace/dna-platform
pre-commit install
```

Now pre-commit will run automatically on `git commit`.

**Manual run:**

```bash
pre-commit run --all-files
```

### 3. Generate Protobuf Code

```bash
cd contracts
buf generate
```

This will regenerate:

- `sdks/go-sdk/gen/**/*.pb.go`
- `sdks/ts-sdk/gen/**/*_pb.ts`
- `sdks/py-sdk/gen/**/*_pb2.py`

### 4. Update Dependencies

**Go Services:**

```bash
cd services/ingestion
go mod tidy
go mod download

cd ../processing
go mod tidy
go mod download
```

**TypeScript Service:**

```bash
cd services/decision
npm install
```

### 5. Run Tests

**Go Tests:**

```bash
# All services
go test ./...

# Specific service
cd services/processing
go test -v ./...
```

**Lint All Code:**

```bash
# Go
golangci-lint run ./...

# TypeScript (if eslint installed globally)
cd services/decision
npx eslint src/
```

## Environment Variables

### Ingestion Service (JWT)

```env
# JWT Configuration
JWT_ISSUER=https://auth.example.com    # Required issuer
JWT_AUD=dna-platform                   # Optional audience
JWT_SECRET=your-secret-key             # HMAC secret (use secure storage in prod)

# Kafka
KAFKA_BROKERS=bus:9092
KAFKA_TOPIC=ingestion.raw.v1
HTTP_PORT=8080
```

## Verification

### Test JWT Authentication

**Without JWT (should work if JWT_ISSUER not set):**

```bash
curl -X POST http://localhost:8080/ingest \
  -H 'Content-Type: application/json' \
  -d '{"metric":"cpu_usage","value":95.5,"source":"server-01"}'
```

**With JWT (if enabled):**

```bash
# Generate a test JWT token (using your secret)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:8080/ingest \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"metric":"cpu_usage","value":95.5,"source":"server-01"}'
```

### Verify Protobuf Flow

Check logs to confirm protobuf usage:

```bash
docker logs dna-ingestion --tail 20
# Should show: "Event ingested (protobuf): evt_..."

docker logs dna-processing --tail 20
# Should show: "Processing event (protobuf): evt_..."

docker logs dna-decision --tail 20
# Should show: "Processing event (protobuf): evt_..."
```

## Migration Checklist

- [x] Protobuf schema defined in `contracts/proto/`
- [x] `buf generate` configured and documented
- [x] Go SDK generated with protobuf types
- [x] TypeScript SDK with protobuf types
- [x] Ingestion service migrated to protobuf
- [x] Processing service migrated to protobuf
- [x] Decision service migrated to protobuf
- [x] JWT middleware added to ingestion
- [x] Unit tests added for processing
- [x] Pre-commit hooks configured
- [x] Linter configurations added
- [ ] Integration tests (future work)
- [ ] Performance benchmarks (future work)

## Notes

- **Kafka topics unchanged:** Still using `ingestion.raw.v1` and `processing.cleaned.v1`
- **Backward compatibility:** JSON API endpoint still accepts JSON, converts internally to protobuf
- **Generated code:** `.pb.go` and `_pb.ts` files are excluded from linting
- **Local development:** JWT can be disabled for easier local testing

## Next Steps

1. Set up CI/CD pipeline with pre-commit checks
2. Add integration tests for end-to-end protobuf flow
3. Implement token rotation for JWT secrets
4. Add metrics for protobuf serialization performance
5. Consider gRPC for service-to-service communication
