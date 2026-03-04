#!/bin/bash

# DNA Pulse Ingestion Service - Local Development Startup Script

set -e

cd "$(dirname "$0")/../services/ingestion"

echo "Starting DNA Pulse Ingestion Service (local development mode)..."

export KAFKA_BROKERS=localhost:9092
export KAFKA_TOPIC=ingestion.raw.v1
export HTTP_PORT=19071
export GRPC_PORT=9090
export MONGO_URL=mongodb://localhost:27017/dna-pulse
export ELASTICSEARCH_URL=http://localhost:9200
export ELASTICSEARCH_INDEX=ingestion-events
export METRICS_PORT=9091
export JWT_SECRET=your-secret-key-change-in-production
export DISABLE_JWT_VALIDATION=true
export RATE_LIMIT=100

echo "Configuration:"
echo "  Kafka Brokers: $KAFKA_BROKERS"
echo "  Kafka Topic: $KAFKA_TOPIC"
echo "  HTTP Port: $HTTP_PORT"
echo "  gRPC Port: $GRPC_PORT"
echo "  MongoDB URL: $MONGO_URL"
echo "  Elasticsearch URL: $ELASTICSEARCH_URL"
echo "  Elasticsearch Index: $ELASTICSEARCH_INDEX"
echo ""

go run cmd/ingestion/main.go
