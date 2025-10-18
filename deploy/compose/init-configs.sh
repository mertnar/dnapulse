#!/bin/bash

# DNA Platform Config Initialization Script
# This script loads all YAML configuration files from the configs/ directory
# into the config service via REST API

set -e

# Configuration
CONFIG_SERVICE_URL=${CONFIG_SERVICE_URL:-http://config:8080}
CONFIGS_DIR=${CONFIGS_DIR:-/configs}
MAX_RETRIES=30
RETRY_INTERVAL=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Wait for config service to be ready
wait_for_config_service() {
    log_info "Waiting for config service to be ready at $CONFIG_SERVICE_URL..."

    local retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -s -f "$CONFIG_SERVICE_URL/health" > /dev/null 2>&1; then
            log_success "Config service is ready!"
            return 0
        fi

        retries=$((retries + 1))
        log_info "Config service not ready, waiting... (attempt $retries/$MAX_RETRIES)"
        sleep $RETRY_INTERVAL
    done

    log_error "Config service failed to become ready after $MAX_RETRIES attempts"
    return 1
}

# Load a single config file
load_config() {
    local config_file="$1"
    local scope="$2"

    if [ ! -f "$config_file" ]; then
        log_warning "Config file $config_file not found, skipping..."
        return 0
    fi

    log_info "Loading $scope configuration from $config_file..."

    local response
    local http_code

    response=$(curl -s -w "\n%{http_code}" \
        -X PUT \
        -H "Content-Type: application/x-yaml" \
        --data-binary @"$config_file" \
        "$CONFIG_SERVICE_URL/v1/config/$scope")

    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)

    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        log_success "Successfully loaded $scope configuration (HTTP $http_code)"
        return 0
    else
        log_error "Failed to load $scope configuration (HTTP $http_code)"
        log_error "Response: $response_body"
        return 1
    fi
}

# Verify config was loaded
verify_config() {
    local scope="$1"

    log_info "Verifying $scope configuration..."

    local response
    local http_code

    response=$(curl -s -w "\n%{http_code}" \
        -H "Accept: application/x-yaml" \
        "$CONFIG_SERVICE_URL/v1/config/$scope")

    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" -eq 200 ]; then
        log_success "Verified $scope configuration is available"
        return 0
    else
        log_error "Failed to verify $scope configuration (HTTP $http_code)"
        return 1
    fi
}

# Main execution
main() {
    log_info "Starting DNA Platform configuration initialization..."
    log_info "Config service URL: $CONFIG_SERVICE_URL"
    log_info "Configs directory: $CONFIGS_DIR"

    # Wait for config service
    if ! wait_for_config_service; then
        log_error "Cannot proceed without config service"
        exit 1
    fi

    # List of configs to load (scope -> file mapping)
    declare -A configs=(
        ["ingestion"]="ingestion.yaml"
        ["processing"]="processing.rules.yaml"
        ["categorization"]="categorization.yaml"
        ["correlation"]="correlation.yaml"
        ["model"]="model.yaml"
        ["decision"]="decision.policies.yaml"
        ["platform"]="platform.yaml"
    )

    local failed_configs=()
    local loaded_configs=()

    # Load each configuration
    for scope in "${!configs[@]}"; do
        local config_file="$CONFIGS_DIR/${configs[$scope]}"

        if load_config "$config_file" "$scope"; then
            if verify_config "$scope"; then
                loaded_configs+=("$scope")
            else
                failed_configs+=("$scope")
            fi
        else
            failed_configs+=("$scope")
        fi

        echo # Add spacing between configs
    done

    # Summary
    echo "=========================================="
    log_info "Configuration loading summary:"
    echo "=========================================="

    if [ ${#loaded_configs[@]} -gt 0 ]; then
        log_success "Successfully loaded configurations:"
        for config in "${loaded_configs[@]}"; do
            echo "  ✓ $config"
        done
    fi

    if [ ${#failed_configs[@]} -gt 0 ]; then
        log_error "Failed to load configurations:"
        for config in "${failed_configs[@]}"; do
            echo "  ✗ $config"
        done
        echo
        log_error "Some configurations failed to load. Check the logs above for details."
        exit 1
    fi

    log_success "All configurations loaded successfully!"

    # List all available configs
    log_info "Listing all available configurations..."
    curl -s "$CONFIG_SERVICE_URL/v1/config" | jq '.' 2>/dev/null || {
        log_warning "Could not parse config list response (jq not available or invalid JSON)"
    }

    log_success "Configuration initialization completed!"
}

# Run main function
main "$@"
