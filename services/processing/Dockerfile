# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /build

# Copy go mod files
COPY services/processing/go.mod services/processing/go.sum ./
COPY sdks/go-sdk ./../../sdks/go-sdk
RUN go mod download

# Copy source code
COPY services/processing ./

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o processing ./cmd/processing

# Runtime stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /build/processing .

CMD ["./processing"]
