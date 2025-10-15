# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /build

# Copy go mod files
COPY services/ingestion/go.mod services/ingestion/go.sum ./
COPY sdks/go-sdk ./sdks/go-sdk
RUN go mod download

# Copy source code
COPY services/ingestion ./

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o ingestion ./cmd/ingestion

# Runtime stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /build/ingestion .

EXPOSE 8080

CMD ["./ingestion"]
