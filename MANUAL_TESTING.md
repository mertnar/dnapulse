# Manual Testing Guide for DNA Pulse Agent System

## Prerequisites

1. **MongoDB** running on `localhost:27017`
2. **Ingestion Service** running on `http://localhost:19071`
3. **Backend API** running on `http://localhost:3001`
4. **Frontend** running on `http://localhost:5173` (optional, for UI testing)

## Step 1: Create Test API Key

First, create a test API key in MongoDB:

```bash
cd scripts
npm install  # Install bcryptjs if not already installed
node create-test-apikey.js
```

This will output an API key like: `dna_test_1234567890_abc123xyz`

**Save this API key** - you'll need it for all agent requests!

## Step 2: Run Automated Test Script

The easiest way to test everything:

```bash
cd scripts
export API_KEY="your-api-key-from-step-1"
./test-agent.sh
```

Or set the API key inline:

```bash
API_KEY="dna_test_..." ./test-agent.sh
```

## Step 3: Manual Testing with cURL

### 3.1 Register Agent

```bash
curl -X POST http://localhost:19071/api/v1/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "api_key": "YOUR_API_KEY_HERE",
    "agent_name": "Production Web Server",
    "agent_type": "syslog",
    "version": "1.0.0",
    "platform": "linux",
    "hostname": "web-server-01",
    "sample_data": [
      {
        "timestamp": "2026-01-26T10:00:00Z",
        "level": "info",
        "message": "System started",
        "host": "web-server-01",
        "service": "nginx"
      },
      {
        "timestamp": "2026-01-26T10:01:00Z",
        "level": "warning",
        "message": "High CPU usage",
        "host": "web-server-01",
        "cpu_percent": 85.5
      }
    ]
  }'
```

**Expected Response:**

```json
{
  "agent_id": "679f0a1b2c3d4e5f6a7b8c9d",
  "data_source_id": "679f0a1b2c3d4e5f6a7b8c9e",
  "jwt_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

**Save the `jwt_token` and `agent_id` for next steps!**

### 3.2 Health Check

```bash
curl -X POST http://localhost:19071/api/v1/agent/health \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "status": "online",
    "metrics": {
      "cpu_usage": 45.2,
      "memory_usage": 60.1,
      "disk_usage": 35.8
    }
  }'
```

**Expected Response:**

```json
{
  "acknowledged": true,
  "next_check_in": 60
}
```

### 3.3 Send Pulse Data

```bash
curl -X POST http://localhost:19071/api/v1/pulse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "events": [
      {
        "timestamp": "2026-01-26T10:05:00Z",
        "level": "info",
        "message": "Request processed successfully",
        "host": "web-server-01",
        "service": "nginx",
        "response_time_ms": 125,
        "status_code": 200
      },
      {
        "timestamp": "2026-01-26T10:05:01Z",
        "level": "warning",
        "message": "Slow query detected",
        "host": "web-server-01",
        "service": "database",
        "query_time_ms": 2500
      }
    ]
  }'
```

**Expected Response:**

```json
{
  "accepted": 2,
  "rejected": 0,
  "errors": []
}
```

## Step 4: Verify in Web Application

### 4.1 Check Agents via Backend API

```bash
curl http://localhost:3001/api/agents | jq '.'
```

You should see your registered agent in the list.

### 4.2 Check Data Sources via Backend API

```bash
curl http://localhost:3001/api/data-sources | jq '.'
```

You should see the automatically created data source.

### 4.3 Check Data Source Details

```bash
curl http://localhost:3001/api/data-sources/DATA_SOURCE_ID | jq '.'
```

### 4.4 Check Data Source Schema

```bash
curl http://localhost:3001/api/data-sources/DATA_SOURCE_ID/model | jq '.'
```

This shows the discovered schema from the sample data.

### 4.5 View in Web UI

1. Open `http://localhost:5173` in your browser
2. Navigate to **Agents** page
3. You should see your registered agent with:

   - Name: "Production Web Server"
   - Status: "online"
   - Platform: "linux"
   - Last heartbeat timestamp

4. Navigate to **Data Sources** page
5. You should see:

   - A new data source with type "syslog"
   - Status: "active"
   - Connected agents count

6. Click on the data source to see:
   - Connected agents list
   - Discovered schema with field types
   - Sample events

## Step 5: Continuous Testing

### Send Multiple Health Checks

```bash
# Run this every 60 seconds
while true; do
  curl -X POST http://localhost:19071/api/v1/agent/health \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
    -d '{"status": "online"}'
  sleep 60
done
```

### Send Continuous Pulse Data

```bash
# Send pulse every 30 seconds
while true; do
  curl -X POST http://localhost:19071/api/v1/pulse \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
    -d "{
      \"events\": [{
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"level\": \"info\",
        \"message\": \"Periodic heartbeat\",
        \"host\": \"web-server-01\",
        \"metric\": \"cpu_usage\",
        \"value\": $(shuf -i 20-80 -n 1)
      }]
    }"
  sleep 30
done
```

## Troubleshooting

### API Key Not Found

If you get `401 Unauthorized`:

1. Make sure you created the API key using `create-test-apikey.js`
2. Check the API key is correct (no extra spaces)
3. Verify MongoDB has the key: `mongosh dna-pulse --eval "db.api_keys.find().pretty()"`

### JWT Token Invalid

If you get `Invalid token`:

1. Make sure you're using the JWT token from the register response
2. Check token hasn't expired (24 hours)
3. Re-register to get a new token

### Data Not Appearing in Web App

1. Check backend is running: `curl http://localhost:3001/health`
2. Check MongoDB connection in backend logs
3. Verify data exists in MongoDB:
   ```bash
   mongosh dna-pulse --eval "db.agents.find().pretty()"
   mongosh dna-pulse --eval "db.data_sources.find().pretty()"
   ```

### Schema Not Discovered

1. Make sure `sample_data` array has at least 1-2 sample events
2. Check sample data has consistent structure
3. Verify schema was created:
   ```bash
   mongosh dna-pulse --eval "db.discovered_schemas.find().pretty()"
   ```

## Expected Database State

After successful registration and pulse:

```bash
# Check organizations
mongosh dna-pulse --eval "db.organizations.find().pretty()"

# Check agents
mongosh dna-pulse --eval "db.agents.find().pretty()"

# Check data sources
mongosh dna-pulse --eval "db.data_sources.find().pretty()"

# Check discovered schemas
mongosh dna-pulse --eval "db.discovered_schemas.find().pretty()"

# Check events
mongosh dna-pulse --eval "db.events.find().limit(5).pretty()"
```

## Next Steps

1. **Multiple Agents**: Register multiple agents with different `agent_type` values
2. **Schema Evolution**: Send events with new fields to test schema updates
3. **Error Handling**: Test invalid data to see rejection handling
4. **Performance**: Send large batches of events to test throughput
5. **Web UI**: Explore all features in the web application
