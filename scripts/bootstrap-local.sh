#!/bin/bash
set -e

echo "=== DNA Platform Local Bootstrap ==="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create Kafka topics
echo -e "${YELLOW}Creating Kafka topics...${NC}"

docker exec dna-bus rpk topic create ingestion.raw.v1 \
  --partitions 3 \
  --replicas 1 \
  2>/dev/null || echo "Topic ingestion.raw.v1 already exists"

docker exec dna-bus rpk topic create processing.cleaned.v1 \
  --partitions 3 \
  --replicas 1 \
  2>/dev/null || echo "Topic processing.cleaned.v1 already exists"

echo -e "${GREEN}✓ Kafka topics created${NC}"

# List topics
echo -e "${YELLOW}Available topics:${NC}"
docker exec dna-bus rpk topic list

# Create Elasticsearch index template
echo -e "${YELLOW}Creating Elasticsearch index template for alerts...${NC}"

curl -X PUT "http://localhost:9200/_index_template/alerts-template" \
  -H 'Content-Type: application/json' \
  -d '{
  "index_patterns": ["alerts*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    },
    "mappings": {
      "properties": {
        "@timestamp": {
          "type": "date"
        },
        "event_id": {
          "type": "keyword"
        },
        "event_type": {
          "type": "keyword"
        },
        "source": {
          "type": "keyword"
        },
        "severity": {
          "type": "keyword"
        },
        "metric_name": {
          "type": "keyword"
        },
        "metric_value": {
          "type": "double"
        },
        "threshold": {
          "type": "double"
        },
        "message": {
          "type": "text"
        },
        "raw_data": {
          "type": "object",
          "enabled": false
        }
      }
    }
  }
}' 2>/dev/null

# Create initial alerts index
curl -X PUT "http://localhost:9200/alerts" -H 'Content-Type: application/json' 2>/dev/null || true

echo -e "${GREEN}✓ Elasticsearch index template created${NC}"

# Verify ES setup
echo -e "${YELLOW}Verifying Elasticsearch indices:${NC}"
curl -s "http://localhost:9200/_cat/indices?v" | grep -E "health|alerts" || true

echo ""
echo -e "${GREEN}=== Bootstrap Complete ===${NC}"
echo -e "Kafka topics: ingestion.raw.v1, processing.cleaned.v1"
echo -e "Elasticsearch: alerts index ready"
echo -e ""
echo -e "Next steps:"
echo -e "  1. Send a test event: curl -X POST http://localhost:8080/ingest -H 'Content-Type: application/json' -d '{\"metric\":\"cpu_usage\",\"value\":95.5,\"source\":\"server-01\"}'"
echo -e "  2. View alerts in Kibana: http://localhost:5601"
