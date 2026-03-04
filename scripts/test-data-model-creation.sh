#!/bin/bash

# Test script for data model creation

echo "🧪 Testing Data Model Creation"
echo "================================"

# 1. Check current data models
echo ""
echo "1️⃣  Current data models in MongoDB:"
cd /home/mert/Documents/workspace/dnasol-workspace/dnapulse/scripts
node check-all-data-models.js | grep "Total data models"

# 2. Restart ingestion service
echo ""
echo "2️⃣  Restarting ingestion service..."
cd /home/mert/Documents/workspace/dnasol-workspace/dnapulse
docker compose -f docker-compose.dev.yml restart ingestion
sleep 5

# 3. Show instructions
echo ""
echo "3️⃣  Now register a NEW agent:"
echo ""
echo "   cd apps/agents/samples/linux-resource-monitor-linux-amd64"
echo "   ./linux-resource-monitor register --name test-agent-$(date +%s)"
echo ""
echo "4️⃣  After registration, check data models again:"
echo ""
echo "   cd scripts && node check-all-data-models.js"
echo ""
echo "5️⃣  Check ingestion logs:"
echo ""
echo "   docker logs dnapulse-ingestion --tail 50 | grep -A 2 'root data model'"
echo ""
