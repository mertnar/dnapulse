#!/bin/bash

# Categorization Service Test Script
# Bu script servisi test eder

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SERVICE_URL=${SERVICE_URL:-http://localhost:8083}

echo "🧪 Categorization Servisini Test Ediyoruz..."
echo "Service URL: $SERVICE_URL"
echo ""

# Test 1: Health Check
echo -e "${YELLOW}1. Health Check...${NC}"
if response=$(curl -s -f "$SERVICE_URL/health"); then
    echo -e "${GREEN}✅ Health OK${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    echo -e "${RED}❌ Health FAILED${NC}"
    exit 1
fi
echo ""

# Test 2: Readiness Check
echo -e "${YELLOW}2. Readiness Check...${NC}"
if curl -s -f "$SERVICE_URL/ready" > /dev/null; then
    echo -e "${GREEN}✅ Ready OK${NC}"
else
    echo -e "${RED}❌ Ready FAILED${NC}"
    exit 1
fi
echo ""

# Test 3: Metrics
echo -e "${YELLOW}3. Metrics Check...${NC}"
if curl -s -f "$SERVICE_URL/metrics" > /dev/null; then
    echo -e "${GREEN}✅ Metrics OK${NC}"
    echo "Metrics endpoint çalışıyor"
else
    echo -e "${RED}❌ Metrics FAILED${NC}"
fi
echo ""

# Test 4: Create Label
echo -e "${YELLOW}4. Create Label...${NC}"
label_response=$(curl -s -X POST "$SERVICE_URL/v1/labels" \
    -H 'Content-Type: application/json' \
    -d '{
        "id": "test_label_'$(date +%s)'",
        "kind": "category",
        "name": "test_label",
        "description": "Test label",
        "active": true
    }')

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Label Created${NC}"
    echo "$label_response" | jq '.' 2>/dev/null || echo "$label_response"
else
    echo -e "${YELLOW}⚠️  Label creation might have failed (check logs)${NC}"
fi
echo ""

# Test 5: List Labels
echo -e "${YELLOW}5. List Labels...${NC}"
if labels=$(curl -s -f "$SERVICE_URL/v1/labels"); then
    echo -e "${GREEN}✅ Labels Listed${NC}"
    echo "$labels" | jq '. | length' 2>/dev/null || echo "$labels"
else
    echo -e "${YELLOW}⚠️  Could not list labels${NC}"
fi
echo ""

# Test 6: Assign Labels (if MongoDB is available)
echo -e "${YELLOW}6. Assign Labels...${NC}"
assign_response=$(curl -s -X POST "$SERVICE_URL/v1/assign" \
    -H 'Content-Type: application/json' \
    -d '{
        "items": [
            {
                "id": "test-item-'$(date +%s)'",
                "tenant_id": "test-tenant",
                "type": "metric",
                "ts": "'$(date -Iseconds)'",
                "payload": {
                    "cpu_load": 0.95,
                    "test": true
                },
                "attributes": {
                    "test": true
                }
            }
        ]
    }')

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Labels Assigned${NC}"
    echo "$assign_response" | jq '.results | length' 2>/dev/null || echo "$assign_response"
else
    echo -e "${YELLOW}⚠️  Label assignment might have failed (check logs)${NC}"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Test Tamamlandı!${NC}"
echo ""
echo "Servis Endpoints:"
echo "  🏥 Health:  $SERVICE_URL/health"
echo "  📊 Metrics: $SERVICE_URL/metrics"
echo "  📝 API:     $SERVICE_URL/v1/"
echo ""
echo "Detaylı API dökümantasyonu için README.md dosyasına bakın"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
