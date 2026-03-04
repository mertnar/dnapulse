#!/bin/bash

# DNA Pulse Agent Manual Test Script
# This script demonstrates the complete agent registration and data ingestion flow

INGESTION_URL="${INGESTION_URL:-http://localhost:19071}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

echo "=========================================="
echo "DNA Pulse Agent Manual Test"
echo "=========================================="
echo "Ingestion URL: $INGESTION_URL"
echo "Backend URL: $BACKEND_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Use API Key
echo -e "${BLUE}Step 1: Using API Key...${NC}"

# Use API_KEY from environment or prompt user
if [ -z "$API_KEY" ]; then
  echo "API_KEY environment variable not set."
  echo "Please create an API key first:"
  echo "  cd scripts && node create-test-apikey.js"
  echo ""
  echo "Then set it:"
  echo "  export API_KEY=\"your-api-key-here\""
  echo "  ./test-agent.sh"
  exit 1
fi

echo "Using API Key: $API_KEY"
echo ""

# Step 2: Register Agent
echo -e "${BLUE}Step 2: Registering Agent...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$INGESTION_URL/api/v1/register" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "api_key": "'"$API_KEY"'",
    "agent_name": "Test Production Server",
    "agent_type": "syslog",
    "version": "1.0.0",
    "platform": "linux",
    "hostname": "web-server-01",
    "sample_data": [
      {
        "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
        "level": "info",
        "message": "System started",
        "host": "web-server-01",
        "service": "nginx"
      },
      {
        "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
        "level": "warning",
        "message": "High CPU usage detected",
        "host": "web-server-01",
        "cpu_percent": 85.5
      },
      {
        "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
        "level": "error",
        "message": "Database connection failed",
        "host": "web-server-01",
        "error_code": "DB_CONN_001"
      }
    ]
  }')

echo "Register Response:"
echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""

# Extract JWT token and IDs from response
JWT_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.jwt_token' 2>/dev/null)
AGENT_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.agent_id' 2>/dev/null)
DATA_SOURCE_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data_source_id' 2>/dev/null)

if [ -z "$JWT_TOKEN" ] || [ "$JWT_TOKEN" = "null" ]; then
  echo -e "${RED}Error: Failed to register agent. Please check:${NC}"
  echo "1. Ingestion service is running on $INGESTION_URL"
  echo "2. MongoDB is running and accessible"
  echo "3. API key exists in database"
  echo ""
  echo "To create an API key, you can use MongoDB directly:"
  echo "mongosh dna-pulse --eval 'db.api_keys.insertOne({"
  echo "  organization_id: ObjectId(\"YOUR_ORG_ID\"),"
  echo "  key: \"\$2a\$10\$HASHED_KEY_HERE\","
  echo "  name: \"Test Key\","
  echo "  permissions: [\"agent:register\", \"agent:ingest\"],"
  echo "  created_at: new Date()"
  echo "})'"
  exit 1
fi

echo -e "${GREEN}✓ Agent registered successfully!${NC}"
echo "Agent ID: $AGENT_ID"
echo "Data Source ID: $DATA_SOURCE_ID"
echo "JWT Token: ${JWT_TOKEN:0:50}..."
echo ""

# Step 3: Health Check
echo -e "${BLUE}Step 3: Sending Health Check...${NC}"
HEALTH_RESPONSE=$(curl -s -X POST "$INGESTION_URL/api/v1/agent/health" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "status": "online",
    "metrics": {
      "cpu_usage": 45.2,
      "memory_usage": 60.1,
      "disk_usage": 35.8
    }
  }')

echo "Health Check Response:"
echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
echo ""

if echo "$HEALTH_RESPONSE" | grep -q "acknowledged"; then
  echo -e "${GREEN}✓ Health check successful!${NC}"
else
  echo -e "${YELLOW}⚠ Health check may have failed${NC}"
fi
echo ""

# Step 4: Send Pulse Data
echo -e "${BLUE}Step 4: Sending Pulse Data (Events)...${NC}"
PULSE_RESPONSE=$(curl -s -X POST "$INGESTION_URL/api/v1/pulse" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "events": [
      {
        "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
        "level": "info",
        "message": "Request processed successfully",
        "host": "web-server-01",
        "service": "nginx",
        "response_time_ms": 125,
        "status_code": 200
      },
      {
        "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
        "level": "warning",
        "message": "Slow query detected",
        "host": "web-server-01",
        "service": "database",
        "query_time_ms": 2500,
        "query": "SELECT * FROM users"
      },
      {
        "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
        "level": "error",
        "message": "Failed to connect to external API",
        "host": "web-server-01",
        "service": "api-client",
        "error": "Connection timeout",
        "retry_count": 3
      }
    ]
  }')

echo "Pulse Response:"
echo "$PULSE_RESPONSE" | jq '.' 2>/dev/null || echo "$PULSE_RESPONSE"
echo ""

ACCEPTED=$(echo "$PULSE_RESPONSE" | jq -r '.accepted' 2>/dev/null)
REJECTED=$(echo "$PULSE_RESPONSE" | jq -r '.rejected' 2>/dev/null)

if [ "$ACCEPTED" != "null" ] && [ "$ACCEPTED" != "0" ]; then
  echo -e "${GREEN}✓ Pulse data sent successfully!${NC}"
  echo "Accepted: $ACCEPTED events"
  echo "Rejected: ${REJECTED:-0} events"
else
  echo -e "${YELLOW}⚠ Pulse data may have failed${NC}"
fi
echo ""

# Step 5: Check Data in Web App
echo -e "${BLUE}Step 5: Checking Data in Web App...${NC}"
echo "You can now check the web app at:"
echo "  - Agents: $BACKEND_URL/api/agents"
echo "  - Data Sources: $BACKEND_URL/api/data-sources"
echo ""

echo "Fetching agents from backend..."
AGENTS_RESPONSE=$(curl -s "$BACKEND_URL/api/agents")
echo "$AGENTS_RESPONSE" | jq '.' 2>/dev/null || echo "$AGENTS_RESPONSE"
echo ""

echo "Fetching data sources from backend..."
DATA_SOURCES_RESPONSE=$(curl -s "$BACKEND_URL/api/data-sources")
echo "$DATA_SOURCES_RESPONSE" | jq '.' 2>/dev/null || echo "$DATA_SOURCES_RESPONSE"
echo ""

echo -e "${GREEN}=========================================="
echo "Test Complete!"
echo "==========================================${NC}"
echo ""
echo "Next Steps:"
echo "1. Open web app: http://localhost:5173"
echo "2. Navigate to Agents page to see registered agent"
echo "3. Navigate to Data Sources page to see created data source"
echo "4. Check Data Source Details to see connected agents and schema"
echo ""
