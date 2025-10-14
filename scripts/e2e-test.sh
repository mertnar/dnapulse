#!/bin/bash

# DNA Platform End-to-End Test Script
# This script tests all services in the DNA platform end-to-end

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost"
INGESTION_PORT=8080
PROCESSING_PORT=8081
DECISION_PORT=8082
CONFIG_PORT=8083
CATEGORIZATION_PORT=8084
CORRELATION_PORT=8085
MODEL_PORT=8086
ELASTICSEARCH_URL="http://localhost:9200"
KAFKA_BROKER="localhost:9092"

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test result tracking
test_result() {
    ((TOTAL_TESTS++))
    if [ $1 -eq 0 ]; then
        log_success "$2"
    else
        log_error "$2"
    fi
}

# Wait for service to be ready
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url/health" > /dev/null 2>&1; then
            log_success "$service_name is ready"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    log_error "$service_name failed to start within timeout"
    return 1
}

# Check if service is healthy
check_service_health() {
    local service_name=$1
    local port=$2
    local url="$BASE_URL:$port"
    
    log_info "Checking health of $service_name..."
    
    if curl -s -f "$url/health" > /dev/null 2>&1; then
        local health_response=$(curl -s "$url/health")
        log_info "$service_name health: $health_response"
        test_result 0 "$service_name health check"
    else
        test_result 1 "$service_name health check"
    fi
}

# Test ingestion service
test_ingestion() {
    log_info "=== Testing Ingestion Service ==="
    
    # Test normal event ingestion
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
            "environment": "test",
            "region": "us-east-1"
        }
    }'
    
    log_info "Testing normal event ingestion..."
    local response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL:$INGESTION_PORT/ingest" \
        -H "Content-Type: application/json" \
        -d "$test_event")
    
    local http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        test_result 0 "Normal event ingestion"
    else
        test_result 1 "Normal event ingestion (HTTP $http_code)"
    fi
    
    # Test rate limiting
    log_info "Testing rate limiting..."
    local rate_limit_failed=0
    for i in {1..15}; do
        local rate_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL:$INGESTION_PORT/ingest" \
            -H "Content-Type: application/json" \
            -d '{"event_type": "metric", "source": "test-server", "payload": {"name": "cpu_usage", "value": 75}}')
        
        local rate_http_code="${rate_response: -3}"
        if [ "$rate_http_code" = "429" ]; then
            log_info "Rate limit triggered at request $i"
            break
        fi
    done
    
    if [ $rate_limit_failed -eq 0 ]; then
        test_result 0 "Rate limiting"
    else
        test_result 1 "Rate limiting"
    fi
    
    # Test source filtering
    log_info "Testing source filtering..."
    local filter_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL:$INGESTION_PORT/ingest" \
        -H "Content-Type: application/json" \
        -d '{"event_type": "metric", "source": "unauthorized-source", "payload": {"name": "cpu_usage", "value": 75}}')
    
    local filter_http_code="${filter_response: -3}"
    if [ "$filter_http_code" = "403" ]; then
        test_result 0 "Source filtering"
    else
        test_result 1 "Source filtering (HTTP $filter_http_code)"
    fi
    
    # Check metrics
    log_info "Checking ingestion metrics..."
    local metrics_response=$(curl -s "$BASE_URL:$INGESTION_PORT/metrics" | grep "ingestion_events_processed_total" || echo "")
    if [ -n "$metrics_response" ]; then
        test_result 0 "Ingestion metrics"
    else
        test_result 1 "Ingestion metrics"
    fi
}

# Test processing service
test_processing() {
    log_info "=== Testing Processing Service ==="
    
    # Check processing metrics
    log_info "Checking processing metrics..."
    local metrics_response=$(curl -s "$BASE_URL:$PROCESSING_PORT/metrics" | grep "processing_events_processed_total" || echo "")
    if [ -n "$metrics_response" ]; then
        test_result 0 "Processing metrics"
    else
        test_result 1 "Processing metrics"
    fi
    
    # Check Kafka topic for processed events
    log_info "Checking processed events in Kafka..."
    if command -v docker > /dev/null 2>&1; then
        local kafka_check=$(docker exec redpanda rpk topic consume processing.cleaned.v1 --num 1 --offset start --timeout 5s 2>/dev/null || echo "")
        if [ -n "$kafka_check" ]; then
            test_result 0 "Kafka topic consumption"
        else
            test_result 1 "Kafka topic consumption"
        fi
    else
        log_warning "Docker not available, skipping Kafka topic check"
    fi
}

# Test categorization service
test_categorization() {
    log_info "=== Testing Categorization Service ==="
    
    # Check categorization metrics
    log_info "Checking categorization metrics..."
    local metrics_response=$(curl -s "$BASE_URL:$CATEGORIZATION_PORT/metrics" | grep "categorization_rules_evaluated_total" || echo "")
    if [ -n "$metrics_response" ]; then
        test_result 0 "Categorization metrics"
    else
        test_result 1 "Categorization metrics"
    fi
    
    # Check categorized events in Kafka
    log_info "Checking categorized events in Kafka..."
    if command -v docker > /dev/null 2>&1; then
        local kafka_check=$(docker exec redpanda rpk topic consume categorization.labeled.v1 --num 1 --offset start --timeout 5s 2>/dev/null || echo "")
        if [ -n "$kafka_check" ]; then
            test_result 0 "Categorized events in Kafka"
        else
            test_result 1 "Categorized events in Kafka"
        fi
    else
        log_warning "Docker not available, skipping Kafka topic check"
    fi
}

# Test correlation service
test_correlation() {
    log_info "=== Testing Correlation Service ==="
    
    # Check correlation metrics
    log_info "Checking correlation metrics..."
    local metrics_response=$(curl -s "$BASE_URL:$CORRELATION_PORT/metrics" | grep "correlation_records_emitted_total" || echo "")
    if [ -n "$metrics_response" ]; then
        test_result 0 "Correlation metrics"
    else
        test_result 1 "Correlation metrics"
    fi
    
    # Check correlation records in Kafka
    log_info "Checking correlation records in Kafka..."
    if command -v docker > /dev/null 2>&1; then
        local kafka_check=$(docker exec redpanda rpk topic consume correlation.grouped.v1 --num 1 --offset start --timeout 5s 2>/dev/null || echo "")
        if [ -n "$kafka_check" ]; then
            test_result 0 "Correlation records in Kafka"
        else
            test_result 1 "Correlation records in Kafka"
        fi
    else
        log_warning "Docker not available, skipping Kafka topic check"
    fi
}

# Test model service
test_model() {
    log_info "=== Testing Model Service ==="
    
    # Test inference endpoint
    log_info "Testing model inference..."
    local inference_request='{
        "features": {
            "count": 5,
            "labels": ["high-cpu", "alert"],
            "severity": "warning"
        }
    }'
    
    local inference_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL:$MODEL_PORT/v1/infer" \
        -H "Content-Type: application/json" \
        -d "$inference_request")
    
    local inference_http_code="${inference_response: -3}"
    if [ "$inference_http_code" = "200" ]; then
        test_result 0 "Model inference"
        log_info "Inference response: ${inference_response%???}"
    else
        test_result 1 "Model inference (HTTP $inference_http_code)"
    fi
    
    # Check model metrics
    log_info "Checking model metrics..."
    local metrics_response=$(curl -s "$BASE_URL:$MODEL_PORT/metrics" | grep "model_inferences_total" || echo "")
    if [ -n "$metrics_response" ]; then
        test_result 0 "Model metrics"
    else
        test_result 1 "Model metrics"
    fi
}

# Test decision service
test_decision() {
    log_info "=== Testing Decision Service ==="
    
    # Check decision metrics
    log_info "Checking decision metrics..."
    local metrics_response=$(curl -s "$BASE_URL:$DECISION_PORT/metrics" | grep "decision_policies_evaluated_total" || echo "")
    if [ -n "$metrics_response" ]; then
        test_result 0 "Decision metrics"
    else
        test_result 1 "Decision metrics"
    fi
    
    # Check debug endpoint
    log_info "Checking decision debug endpoint..."
    local debug_response=$(curl -s -w "%{http_code}" "$BASE_URL:$DECISION_PORT/policy/debug")
    local debug_http_code="${debug_response: -3}"
    if [ "$debug_http_code" = "200" ]; then
        test_result 0 "Decision debug endpoint"
        log_info "Debug response: ${debug_response%???}"
    else
        test_result 1 "Decision debug endpoint (HTTP $debug_http_code)"
    fi
    
    # Check alerts in Elasticsearch
    log_info "Checking alerts in Elasticsearch..."
    local es_response=$(curl -s -w "%{http_code}" "$ELASTICSEARCH_URL/alerts/_search?pretty&size=5")
    local es_http_code="${es_response: -3}"
    if [ "$es_http_code" = "200" ]; then
        test_result 0 "Elasticsearch alerts check"
    else
        test_result 1 "Elasticsearch alerts check (HTTP $es_http_code)"
    fi
}

# Test configuration service
test_config() {
    log_info "=== Testing Configuration Service ==="
    
    # Test config listing
    log_info "Testing config listing..."
    local list_response=$(curl -s -w "%{http_code}" "$BASE_URL:$CONFIG_PORT/v1/config")
    local list_http_code="${list_response: -3}"
    if [ "$list_http_code" = "200" ]; then
        test_result 0 "Config listing"
        log_info "Available configs: ${list_response%???}"
    else
        test_result 1 "Config listing (HTTP $list_http_code)"
    fi
    
    # Test config retrieval
    log_info "Testing config retrieval..."
    local get_response=$(curl -s -w "%{http_code}" "$BASE_URL:$CONFIG_PORT/v1/config/decision")
    local get_http_code="${get_response: -3}"
    if [ "$get_http_code" = "200" ]; then
        test_result 0 "Config retrieval"
    else
        test_result 1 "Config retrieval (HTTP $get_http_code)"
    fi
    
    # Test config update
    log_info "Testing config update..."
    local update_config='alerts:
  - id: "test-policy"
    when: "type == \"metric\" && payload.value > 90"
    actions:
      - type: "index-es"
        config:
          index: "test-alerts"
          document:
            title: "Test Alert"
            value: "{{ payload.value }}"'
    
    local update_response=$(curl -s -w "%{http_code}" -X PUT "$BASE_URL:$CONFIG_PORT/v1/config/decision" \
        -H "Content-Type: text/plain" \
        -d "$update_config")
    
    local update_http_code="${update_response: -3}"
    if [ "$update_http_code" = "200" ]; then
        test_result 0 "Config update"
    else
        test_result 1 "Config update (HTTP $update_http_code)"
    fi
    
    # Test SSE stream
    log_info "Testing SSE stream..."
    local sse_response=$(curl -s -w "%{http_code}" -N --max-time 5 "$BASE_URL:$CONFIG_PORT/v1/stream" || echo "")
    local sse_http_code="${sse_response: -3}"
    if [ "$sse_http_code" = "200" ]; then
        test_result 0 "SSE stream"
    else
        test_result 1 "SSE stream (HTTP $sse_http_code)"
    fi
}

# Test dead letter queue
test_dlq() {
    log_info "=== Testing Dead Letter Queue ==="
    
    # Send malformed JSON
    log_info "Testing malformed JSON handling..."
    local malformed_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL:$INGESTION_PORT/ingest" \
        -H "Content-Type: application/json" \
        -d 'invalid json')
    
    local malformed_http_code="${malformed_response: -3}"
    if [ "$malformed_http_code" = "400" ]; then
        test_result 0 "Malformed JSON handling"
    else
        test_result 1 "Malformed JSON handling (HTTP $malformed_http_code)"
    fi
    
    # Check DLQ topics
    log_info "Checking DLQ topics..."
    if command -v docker > /dev/null 2>&1; then
        local dlq_check=$(docker exec redpanda rpk topic list | grep "deadletter" || echo "")
        if [ -n "$dlq_check" ]; then
            test_result 0 "DLQ topics exist"
        else
            test_result 1 "DLQ topics exist"
        fi
    else
        log_warning "Docker not available, skipping DLQ topic check"
    fi
}

# Test observability
test_observability() {
    log_info "=== Testing Observability ==="
    
    # Test Prometheus metrics
    log_info "Testing Prometheus metrics..."
    local prometheus_services=("ingestion:$INGESTION_PORT" "processing:$PROCESSING_PORT" "decision:$DECISION_PORT" "categorization:$CATEGORIZATION_PORT" "correlation:$CORRELATION_PORT" "model:$MODEL_PORT")
    
    for service_port in "${prometheus_services[@]}"; do
        IFS=':' read -r service port <<< "$service_port"
        local metrics_response=$(curl -s "$BASE_URL:$port/metrics" | grep -E "(total|duration|rate)" || echo "")
        if [ -n "$metrics_response" ]; then
            test_result 0 "$service Prometheus metrics"
        else
            test_result 1 "$service Prometheus metrics"
        fi
    done
    
    # Test Elasticsearch connectivity
    log_info "Testing Elasticsearch connectivity..."
    local es_health=$(curl -s -w "%{http_code}" "$ELASTICSEARCH_URL/_cluster/health")
    local es_health_code="${es_health: -3}"
    if [ "$es_health_code" = "200" ]; then
        test_result 0 "Elasticsearch connectivity"
    else
        test_result 1 "Elasticsearch connectivity (HTTP $es_health_code)"
    fi
}

# Performance test
test_performance() {
    log_info "=== Testing Performance ==="
    
    # Generate load
    log_info "Generating load test..."
    local load_start=$(date +%s)
    local load_count=0
    
    for i in {1..50}; do
        local load_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL:$INGESTION_PORT/ingest" \
            -H "Content-Type: application/json" \
            -d "{\"event_id\": \"load_test_$i\", \"event_type\": \"metric\", \"source\": \"load-test-server\", \"payload\": {\"name\": \"cpu_usage\", \"value\": $((RANDOM % 100))}}")
        
        local load_http_code="${load_response: -3}"
        if [ "$load_http_code" = "200" ]; then
            ((load_count++))
        fi
    done
    
    local load_end=$(date +%s)
    local load_duration=$((load_end - load_start))
    local load_rate=$((load_count * 60 / load_duration))
    
    log_info "Load test: $load_count requests in ${load_duration}s (${load_rate} req/min)"
    
    if [ $load_count -ge 45 ]; then
        test_result 0 "Performance test"
    else
        test_result 1 "Performance test ($load_count/50 requests successful)"
    fi
}

# Main test execution
main() {
    echo "=========================================="
    echo "🧪 DNA Platform End-to-End Test Suite"
    echo "=========================================="
    echo
    
    # Wait for all services to be ready
    log_info "Checking service readiness..."
    
    wait_for_service "Ingestion" "$BASE_URL:$INGESTION_PORT"
    wait_for_service "Processing" "$BASE_URL:$PROCESSING_PORT"
    wait_for_service "Decision" "$BASE_URL:$DECISION_PORT"
    wait_for_service "Config" "$BASE_URL:$CONFIG_PORT"
    wait_for_service "Categorization" "$BASE_URL:$CATEGORIZATION_PORT"
    wait_for_service "Correlation" "$BASE_URL:$CORRELATION_PORT"
    wait_for_service "Model" "$BASE_URL:$MODEL_PORT"
    
    echo
    
    # Run all tests
    test_ingestion
    echo
    test_processing
    echo
    test_categorization
    echo
    test_correlation
    echo
    test_model
    echo
    test_decision
    echo
    test_config
    echo
    test_dlq
    echo
    test_observability
    echo
    test_performance
    
    echo
    echo "=========================================="
    echo "📊 Test Results Summary"
    echo "=========================================="
    echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n🎉 ${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "\n❌ ${RED}Some tests failed!${NC}"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --services     Test only service health checks"
        echo "  --performance  Test only performance"
        echo "  --config       Test only configuration"
        echo "  --observability Test only observability"
        exit 0
        ;;
    --services)
        wait_for_service "Ingestion" "$BASE_URL:$INGESTION_PORT"
        wait_for_service "Processing" "$BASE_URL:$PROCESSING_PORT"
        wait_for_service "Decision" "$BASE_URL:$DECISION_PORT"
        wait_for_service "Config" "$BASE_URL:$CONFIG_PORT"
        wait_for_service "Categorization" "$BASE_URL:$CATEGORIZATION_PORT"
        wait_for_service "Correlation" "$BASE_URL:$CORRELATION_PORT"
        wait_for_service "Model" "$BASE_URL:$MODEL_PORT"
        exit 0
        ;;
    --performance)
        test_performance
        exit $?
        ;;
    --config)
        test_config
        exit $?
        ;;
    --observability)
        test_observability
        exit $?
        ;;
    *)
        main
        ;;
esac

