# Build stage
FROM golang:1.24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

WORKDIR /build

# Copy SDK first (needed for replace directive)
COPY sdks/go-sdk ./sdks/go-sdk

# Copy go mod files
COPY services/processing/go.mod services/processing/go.sum ./
# Update replace directive to use local path
RUN sed -i 's|replace github.com/dnasol/dna-platform/sdks/go-sdk => ../../sdks/go-sdk|replace github.com/dnasol/dna-platform/sdks/go-sdk => ./sdks/go-sdk|' go.mod
RUN go mod download

# Copy source code
COPY services/processing ./

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o processing ./cmd/processing

# Final stage
FROM alpine:3.19

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Create non-root user
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/processing .
COPY --from=builder /build/dev.pipeline.json /app/dev.pipeline.json

# Change ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose ports
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run
CMD ["./processing"]
