#!/bin/bash

# Quick test script for available services

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Environment detection
ENVIRONMENT=${ENVIRONMENT:-"local"}
if [ "$ENVIRONMENT" = "docker" ]; then
    INGESTION_PORT=8092
    DECISION_PORT=8091
    CONFIG_PORT=8087
    MODEL_PORT=8090
elif [ "$ENVIRONMENT" = "k8s" ]; then
    INGESTION_PORT=$(kubectl get svc dna-ingestion -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "30002")
    DECISION_PORT=$(kubectl get svc dna-decision -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "30004")
    CONFIG_PORT=$(kubectl get svc dna-config -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "30001")
    MODEL_PORT=$(kubectl get svc dna-model -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "30007")
else
    INGESTION_PORT=8092
    DECISION_PORT=8091
    CONFIG_PORT=${CONFIG_PORT:-8087}
    MODEL_PORT=8090
fi

# Test available services
test_service_health() {
    local service=$1
    local port=$2
    local url="http://localhost:$port"

    log_info "Testing $service on port $port..."

    if curl -s -f "$url/health" > /dev/null 2>&1; then
        local health_response=$(curl -s "$url/health")
        log_success "$service is healthy"
        echo "  Response: $health_response"
        return 0
    else
        log_error "$service is not responding"
        return 1
    fi
}

# Test ingestion with sample data
test_ingestion() {
    log_info "Testing ingestion service..."

    local test_event='{
        "event_id": "test_001",
        "@timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "event_type": "metric",
        "source": "test-server",
        "payload": {
            "name": "cpu_usage",
            "value": 85.5,
            "unit": "percent"
        },
        "attributes": {
            "host": "test-server",
            "environment": "test"
        }
    }'

    local response=$(curl -s -w "%{http_code}" -X POST "http://localhost:$INGESTION_PORT/ingest" \
        -H "Content-Type: application/json" \
        -d "$test_event")

    local http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_success "Ingestion test passed (HTTP $http_code)"
        echo "  Response: ${response%???}"
    else
        log_error "Ingestion test failed (HTTP $http_code)"
        echo "  Response: ${response%???}"
    fi
}

# Test model inference
test_model() {
    log_info "Testing model service inference..."

    local inference_request='{
        "features": {
            "count": 5,
            "labels": ["high-cpu", "alert"],
            "severity": "warning"
        }
    }'

    local response=$(curl -s -w "%{http_code}" -X POST "http://localhost:$MODEL_PORT/v1/infer" \
        -H "Content-Type: application/json" \
        -d "$inference_request")

    local http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_success "Model inference test passed (HTTP $http_code)"
        echo "  Response: ${response%???}"
    else
        log_error "Model inference test failed (HTTP $http_code)"
        echo "  Response: ${response%???}"
    fi
}

# Test config service
test_config() {
    log_info "Testing config service..."

    # Test config listing
    local list_response=$(curl -s -w "%{http_code}" "http://localhost:$CONFIG_PORT/v1/config")
    local list_http_code="${list_response: -3}"

    if [ "$list_http_code" = "200" ]; then
        log_success "Config listing test passed (HTTP $list_http_code)"
        echo "  Available configs: ${list_response%???}"
    else
        log_error "Config listing test failed (HTTP $list_http_code)"
    fi

    # Test config retrieval
    local get_response=$(curl -s -w "%{http_code}" "http://localhost:$CONFIG_PORT/v1/config/decision")
    local get_http_code="${get_response: -3}"

    if [ "$get_http_code" = "200" ]; then
        log_success "Config retrieval test passed (HTTP $get_http_code)"
    else
        log_error "Config retrieval test failed (HTTP $get_http_code)"
    fi
}

# Main execution
echo "=========================================="
echo "🧪 DNA Platform Quick Test"
echo "=========================================="
echo

# Test service health
test_service_health "Ingestion" $INGESTION_PORT
echo
test_service_health "Decision" $DECISION_PORT
echo
test_service_health "Config" $CONFIG_PORT
echo
test_service_health "Model" $MODEL_PORT
echo

# Test functionality
test_ingestion
echo
test_model
echo
test_config
echo

echo "=========================================="
echo "✅ Quick test completed!"
echo "=========================================="
