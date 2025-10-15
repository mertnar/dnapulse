#!/bin/bash

# Comprehensive DNA Platform Test Script
# Tests the complete flow from ingestion to decision

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
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

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        log_success "$2"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "$2"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Generate test events
generate_test_events() {
    log_info "=== Generating Test Events ==="

    # Event 1: High CPU Usage (should trigger alert)
    local event1='{
        "event_id": "test_cpu_high_001",
        "@timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "event_type": "metric",
        "source": "test-server-01",
        "payload": {
            "name": "cpu_usage",
            "value": 85.5,
            "unit": "percent"
        },
        "attributes": {
            "host": "web-server-01",
            "environment": "production",
            "region": "us-east-1"
        }
    }'

    # Event 2: Normal CPU Usage (should not trigger alert)
    local event2='{
        "event_id": "test_cpu_normal_002",
        "@timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "event_type": "metric",
        "source": "test-server-02",
        "payload": {
            "name": "cpu_usage",
            "value": 45.2,
            "unit": "percent"
        },
        "attributes": {
            "host": "app-server-02",
            "environment": "production",
            "region": "us-west-2"
        }
    }'

    # Event 3: Error Log
    local event3='{
        "event_id": "test_error_003",
        "@timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "event_type": "log",
        "source": "app-server-03",
        "payload": {
            "level": "ERROR",
            "message": "Database connection timeout",
            "stack_trace": "ConnectionError: timeout after 30s"
        },
        "attributes": {
            "host": "app-server-03",
            "environment": "staging",
            "service": "user-service"
        }
    }'

    # Send events
    log_info "Sending high CPU usage event..."
    local response1=$(curl -s -w "%{http_code}" -X POST "http://localhost:$INGESTION_PORT/ingest" \
        -H "Content-Type: application/json" \
        -d "$event1")
    local http_code1="${response1: -3}"
    test_result $([ "$http_code1" = "202" ] && echo 0 || echo 1) "High CPU event ingestion"

    log_info "Sending normal CPU usage event..."
    local response2=$(curl -s -w "%{http_code}" -X POST "http://localhost:$INGESTION_PORT/ingest" \
        -H "Content-Type: application/json" \
        -d "$event2")
    local http_code2="${response2: -3}"
    test_result $([ "$http_code2" = "202" ] && echo 0 || echo 1) "Normal CPU event ingestion"

    log_info "Sending error log event..."
    local response3=$(curl -s -w "%{http_code}" -X POST "http://localhost:$INGESTION_PORT/ingest" \
        -H "Content-Type: application/json" \
        -d "$event3")
    local http_code3="${response3: -3}"
    test_result $([ "$http_code3" = "202" ] && echo 0 || echo 1) "Error log event ingestion"

    echo "Events sent. Waiting for processing..."
    sleep 5
}

# Test model inference
test_model_inference() {
    log_info "=== Testing Model Service ==="

    # Test normal inference
    local normal_request='{
        "features": {
            "count": 3,
            "labels": ["normal", "metric"],
            "severity": "info"
        }
    }'

    local normal_response=$(curl -s -w "%{http_code}" -X POST "http://localhost:$MODEL_PORT/v1/infer" \
        -H "Content-Type: application/json" \
        -d "$normal_request")
    local normal_http_code="${normal_response: -3}"
    test_result $([ "$normal_http_code" = "200" ] && echo 0 || echo 1) "Normal model inference"

    if [ "$normal_http_code" = "200" ]; then
        log_info "Normal inference response: ${normal_response%???}"
    fi

    # Test anomaly inference
    local anomaly_request='{
        "features": {
            "count": 10,
            "labels": ["high-cpu", "alert", "critical"],
            "severity": "warning"
        }
    }'

    local anomaly_response=$(curl -s -w "%{http_code}" -X POST "http://localhost:$MODEL_PORT/v1/infer" \
        -H "Content-Type: application/json" \
        -d "$anomaly_request")
    local anomaly_http_code="${anomaly_response: -3}"
    test_result $([ "$anomaly_http_code" = "200" ] && echo 0 || echo 1) "Anomaly model inference"

    if [ "$anomaly_http_code" = "200" ]; then
        log_info "Anomaly inference response: ${anomaly_response%???}"
    fi
}

# Test configuration management
test_configuration() {
    log_info "=== Testing Configuration Management ==="

    # Test config listing
    local list_response=$(curl -s -w "%{http_code}" "http://localhost:$CONFIG_PORT/v1/config")
    local list_http_code="${list_response: -3}"
    test_result $([ "$list_http_code" = "200" ] && echo 0 || echo 1) "Config listing"

    if [ "$list_http_code" = "200" ]; then
        log_info "Available configs: ${list_response%???}"
    fi

    # Test config retrieval
    local get_response=$(curl -s -w "%{http_code}" "http://localhost:$CONFIG_PORT/v1/config/decision")
    local get_http_code="${get_response: -3}"
    test_result $([ "$get_http_code" = "200" ] && echo 0 || echo 1) "Config retrieval"

    # Test config update
    local update_config='alerts:
  - id: "test-policy"
    when: "type == \"metric\" && payload.value > 90"
    actions:
      - type: "index-es"
        config:
          index: "test-alerts"
          document:
            title: "Test Alert"
            value: "{{ payload.value }}"
            timestamp: "{{ @timestamp }}"
  - id: "error-log-policy"
    when: "type == \"log\" && payload.level == \"ERROR\""
    actions:
      - type: "index-es"
        config:
          index: "error-alerts"
          document:
            title: "Error Log Alert"
            message: "{{ payload.message }}"
            source: "{{ source }}"'

    local update_response=$(curl -s -w "%{http_code}" -X PUT "http://localhost:$CONFIG_PORT/v1/config/decision" \
        -H "Content-Type: text/plain" \
        -d "$update_config")
    local update_http_code="${update_response: -3}"
    test_result $([ "$update_http_code" = "200" ] && echo 0 || echo 1) "Config update"

    if [ "$update_http_code" = "200" ]; then
        log_info "Config updated successfully"
    fi
}

# Test observability
test_observability() {
    log_info "=== Testing Observability ==="

    # Test Prometheus metrics for each service
    local services=("$INGESTION_PORT:ingestion" "$DECISION_PORT:decision" "$CONFIG_PORT:config" "$MODEL_PORT:model")

    for service in "${services[@]}"; do
        IFS=':' read -r port name <<< "$service"
        local metrics_response=$(curl -s "http://localhost:$port/metrics" | grep -E "(total|duration|rate)" || echo "")
        test_result $([ -n "$metrics_response" ] && echo 0 || echo 1) "$name metrics endpoint"
    done

    # Test Elasticsearch connectivity
    local es_health=$(curl -s -w "%{http_code}" "http://localhost:9200/_cluster/health")
    local es_health_code="${es_health: -3}"
    test_result $([ "$es_health_code" = "200" ] && echo 0 || echo 1) "Elasticsearch connectivity"

    if [ "$es_health_code" = "200" ]; then
        log_info "Elasticsearch is healthy"
    fi

    # Check for alerts in Elasticsearch
    local alerts_response=$(curl -s -w "%{http_code}" "http://localhost:9200/alerts/_search?size=5")
    local alerts_http_code="${alerts_response: -3}"
    test_result $([ "$alerts_http_code" = "200" ] && echo 0 || echo 1) "Elasticsearch alerts index"

    if [ "$alerts_http_code" = "200" ]; then
        local alert_count=$(echo "${alerts_response%???}" | jq '.hits.total.value // 0' 2>/dev/null || echo "0")
        log_info "Found $alert_count alerts in Elasticsearch"
    fi
}

# Test service health
test_service_health() {
    log_info "=== Testing Service Health ==="

    local services=("$INGESTION_PORT:ingestion" "$DECISION_PORT:decision" "$CONFIG_PORT:config" "$MODEL_PORT:model")

    for service in "${services[@]}"; do
        IFS=':' read -r port name <<< "$service"
        local health_response=$(curl -s -w "%{http_code}" "http://localhost:$port/health")
        local health_http_code="${health_response: -3}"
        test_result $([ "$health_http_code" = "200" ] && echo 0 || echo 1) "$name health check"

        if [ "$health_http_code" = "200" ]; then
            log_info "$name health: ${health_response%???}"
        fi
    done
}

# Test rate limiting
test_rate_limiting() {
    log_info "=== Testing Rate Limiting ==="

    local rate_limit_triggered=false

    for i in {1..20}; do
        local response=$(curl -s -w "%{http_code}" -X POST "http://localhost:$INGESTION_PORT/ingest" \
            -H "Content-Type: application/json" \
            -d "{\"event_id\": \"rate_test_$i\", \"event_type\": \"metric\", \"source\": \"test-server\", \"payload\": {\"name\": \"cpu_usage\", \"value\": 75}}")

        local http_code="${response: -3}"
        if [ "$http_code" = "429" ]; then
            log_info "Rate limit triggered at request $i"
            rate_limit_triggered=true
            break
        fi
    done

    test_result $([ "$rate_limit_triggered" = "true" ] && echo 0 || echo 1) "Rate limiting"
}

# Test source filtering
test_source_filtering() {
    log_info "=== Testing Source Filtering ==="

    local response=$(curl -s -w "%{http_code}" -X POST "http://localhost:$INGESTION_PORT/ingest" \
        -H "Content-Type: application/json" \
        -d '{"event_type": "metric", "source": "unauthorized-source", "payload": {"name": "cpu_usage", "value": 75}}')

    local http_code="${response: -3}"
    test_result $([ "$http_code" = "403" ] && echo 0 || echo 1) "Source filtering"

    if [ "$http_code" = "403" ]; then
        log_info "Source filtering working correctly"
    else
        log_warning "Source filtering may not be configured or working"
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "🧪 DNA Platform Comprehensive Test Suite"
    echo "=========================================="
    echo

    test_service_health
    echo
    test_configuration
    echo
    generate_test_events
    echo
    test_model_inference
    echo
    test_rate_limiting
    echo
    test_source_filtering
    echo
    test_observability

    echo
    echo "=========================================="
    echo "📊 Test Results Summary"
    echo "=========================================="
    echo -e "Total Tests: ${BLUE}$((TESTS_PASSED + TESTS_FAILED))${NC}"
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

# Handle arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --health       Test only service health"
        echo "  --config       Test only configuration"
        echo "  --events       Test only event generation"
        echo "  --model        Test only model inference"
        echo "  --observability Test only observability"
        exit 0
        ;;
    --health)
        test_service_health
        exit $?
        ;;
    --config)
        test_configuration
        exit $?
        ;;
    --events)
        generate_test_events
        exit $?
        ;;
    --model)
        test_model_inference
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
