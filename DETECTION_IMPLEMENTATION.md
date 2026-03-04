# Detection & Investigation Module - Implementation Guide

## Overview

DNA Pulse Detection & Investigation modülü başarıyla implement edildi. Bu modül, event'leri analiz eden detection rule'ları, otomatik alert oluşturma ve investigation yönetimi sağlar.

## Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │
         │ REST API
         │
┌────────▼────────┐      ┌──────────────┐
│   Backend       │      │ Rule Engine  │
│   (Express)     │      │ (TypeScript) │
└────────┬────────┘      └──────┬───────┘
         │                      │
         │                      │
         └──────────┬───────────┘
                    │
            ┌───────▼────────┐
            │    MongoDB     │
            │  (Collections) │
            └────────────────┘
```

## Components

### 1. Backend Services

#### Rules Service (`apps/webapp/backend/src/services/rulesService.ts`)

- CRUD operations for detection rules
- Rule validation and management
- Organization-scoped access

#### Alerts Service (`apps/webapp/backend/src/services/alertsService.ts`)

- Alert management with new fields (window, entities, dedupe_key)
- Status updates and investigation linking
- Rule-based alert creation support

#### Investigations Service (`apps/webapp/backend/src/services/investigationsService.ts`)

- Full investigation lifecycle management
- Notes support
- Event and alert linking

#### Detection Service (`apps/webapp/backend/src/services/detectionService.ts`)

- Event search with KQL query support
- Event aggregation for histograms
- Reuses Live Monitor query engine

### 2. Rule Engine Microservice (`services/rule-engine/`)

**Components:**

- `index.ts`: Main scheduler (60s intervals)
- `evaluator.ts`: Rule evaluation logic
- `alertCreator.ts`: Alert creation with deduplication
- `entityExtractor.ts`: Extract hosts/users/IPs from events
- `queryParser.ts`: KQL query parser

**Features:**

- Automatic rule evaluation every 60 seconds
- Deduplication using `rule_id:bucket_timestamp` key
- Cooldown period support (default 5 minutes)
- Entity extraction from sample events
- MongoDB-based with no external dependencies

### 3. Frontend Integration

#### Detection Service (`apps/webapp/frontend/src/services/detectionService.ts`)

- API integration for rules, alerts, investigations
- JWT authentication support
- TypeScript interfaces matching backend

#### Investigate Modal (`apps/webapp/frontend/src/components/detection/InvestigateModal.tsx`)

- Create new investigation or add to existing
- Alert linking
- User-friendly interface

## Database Schema

### Collections

1. **rules**

   - organization_id, name, query, condition, severity, tags
   - enabled, schedule_sec, cooldown_min, last_run_at
   - Indexes: (organization_id, enabled), (organization_id, created_at)

2. **alerts**

   - organization_id, rule_id, rule_snapshot, status, severity
   - window{from, to}, match_count, sample_event_ids
   - entities{hosts, users, ips}, dedupe_key (unique)
   - investigation_id, assigned_to
   - Indexes: (organization_id, status, created_at), (dedupe_key unique)

3. **investigations**

   - organization_id, title, status, severity
   - alert_ids, event_refs, entities
   - assigned_to, created_by
   - Indexes: (organization_id, status, updated_at)

4. **investigation_notes**
   - organization_id, investigation_id, author_id, text
   - Indexes: (investigation_id, created_at)

## Setup Instructions

### 1. Setup MongoDB Collections and Indexes

```bash
cd scripts
npm install
node setup-detection-collections.js
```

### 2. Generate Dev JWT Token

```bash
cd apps/webapp/backend
npm run build
node -e "import('./dist/utils/devAuth.js').then(m => console.log('JWT Token:', m.generateDevToken()))"
```

Copy the token and store it in localStorage with key `jwt_token`:

```javascript
localStorage.setItem('jwt_token', 'YOUR_TOKEN_HERE');
```

### 3. Start Services

```bash
# Start all services including rule engine
docker compose -f docker-compose.dev.yml up -d

# Check rule engine logs
docker logs -f dnapulse-rule-engine

# Check backend logs
docker logs -f dnapulse-backend
```

### 4. Seed Sample Data

```bash
cd scripts
node seed-detection-data.js
```

This will:

- Create a sample detection rule
- Generate 10 test events
- Wait for rule engine to create alerts

## API Endpoints

### Rules

- `GET /api/rules` - List all rules
- `POST /api/rules` - Create rule
- `GET /api/rules/:id` - Get rule details
- `PATCH /api/rules/:id` - Update rule
- `DELETE /api/rules/:id` - Delete rule

### Alerts

- `GET /api/alerts` - List alerts
- `PATCH /api/alerts/:id/status` - Update alert status
- `POST /api/alerts/:id/investigate` - Create/link investigation

### Investigations

- `GET /api/investigations` - List investigations
- `POST /api/investigations` - Create investigation
- `GET /api/investigations/:id` - Get investigation details
- `PATCH /api/investigations/:id` - Update investigation
- `POST /api/investigations/:id/notes` - Add note
- `POST /api/investigations/:id/events` - Add events

### Detection

- `POST /api/detection/search-events` - Search events
- `POST /api/detection/agg-events` - Aggregate events

## Testing

### Manual Testing

1. **Create a Rule:**

   - Navigate to Detection & Investigation page
   - Click "Create Rule"
   - Set query: `severity:high OR severity:critical`
   - Set threshold: 5 events in 5 minutes
   - Enable the rule

2. **Generate Events:**

   - Use agent or seed script to generate matching events
   - Wait 60 seconds for rule engine evaluation

3. **View Alerts:**

   - Check Alerts kanban
   - Alerts should appear in "triggered" column

4. **Investigate:**
   - Click "Investigate" on an alert
   - Choose "Create New Investigation"
   - View investigation detail page

### Rule Engine Testing

```bash
# Watch rule engine logs
docker logs -f dnapulse-rule-engine

# Expected output every 60s:
# ⏰ [timestamp] Starting scheduled evaluation...
# 📋 Found X organizations with enabled rules
# 🔍 Evaluating Y rules for org XXXXXX
# 📊 Rule "Rule Name": 5/5 matches
# ✅ Alert created: Rule Name - 5 matches
```

## Troubleshooting

### Rule Engine Not Creating Alerts

1. Check if rule engine is running:

   ```bash
   docker ps | grep rule-engine
   ```

2. Check logs for errors:

   ```bash
   docker logs dnapulse-rule-engine
   ```

3. Verify rule is enabled:

   ```javascript
   db.rules.find({ enabled: true });
   ```

4. Check if events match the query:
   ```javascript
   db.events
     .find({
       organization_id: ObjectId('YOUR_ORG_ID'),
       'payload.severity': { $in: ['high', 'critical'] },
     })
     .count();
   ```

### JWT Authentication Issues

1. Generate a new token:

   ```bash
   cd apps/webapp/backend
   node -e "import('./dist/utils/devAuth.js').then(m => console.log(m.generateDevToken()))"
   ```

2. Store in localStorage:

   ```javascript
   localStorage.setItem('jwt_token', 'YOUR_NEW_TOKEN');
   ```

3. Refresh the page

### MongoDB Connection Issues

1. Check connection string in `.env`:

   ```
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?appName=Cluster0
   ```

2. Ensure password is properly encoded (special characters)

3. Test connection:
   ```bash
   cd scripts
   node setup-detection-collections.js
   ```

## Performance Considerations

1. **Indexes**: All required indexes are created by setup script
2. **Deduplication**: Uses unique index on `dedupe_key` for atomic dedup
3. **Cooldown**: Prevents alert spam with configurable cooldown period
4. **Pagination**: Use keyset pagination for large result sets
5. **Rule Evaluation**: Runs every 60s by default (configurable)

## Future Enhancements

1. **Advanced Conditions**: Support for unique count, rate-based rules
2. **Notification Channels**: Email, Slack, webhook integrations
3. **Rule Templates**: Pre-built rules for common use cases
4. **Machine Learning**: Anomaly detection and pattern recognition
5. **Correlation Rules**: Multi-event correlation
6. **Saved Views**: Persistent query and filter combinations
7. **RBAC**: Role-based access control for rules and investigations

## Files Created/Modified

### New Files

- `services/rule-engine/` (entire microservice)
- `apps/webapp/backend/src/middleware/auth.ts`
- `apps/webapp/backend/src/utils/devAuth.ts`
- `apps/webapp/backend/src/services/rulesService.ts`
- `apps/webapp/backend/src/services/detectionService.ts`
- `apps/webapp/backend/src/services/investigationNotesService.ts`
- `apps/webapp/backend/src/controllers/rulesController.ts`
- `apps/webapp/backend/src/controllers/detectionController.ts`
- `apps/webapp/backend/src/controllers/investigationsController.ts`
- `apps/webapp/backend/src/routes/rules.ts`
- `apps/webapp/backend/src/routes/detection.ts`
- `apps/webapp/backend/src/routes/investigations.ts`
- `apps/webapp/frontend/src/components/detection/InvestigateModal.tsx`
- `scripts/setup-detection-collections.js`
- `scripts/seed-detection-data.js`

### Modified Files

- `apps/webapp/backend/src/services/alertsService.ts`
- `apps/webapp/backend/src/services/investigationsService.ts`
- `apps/webapp/backend/src/controllers/alertsController.ts`
- `apps/webapp/backend/src/routes/alerts.ts`
- `apps/webapp/backend/src/server.ts`
- `apps/webapp/frontend/src/services/detectionService.ts`
- `docker-compose.dev.yml`

## Support

For issues or questions:

1. Check logs: `docker logs dnapulse-rule-engine`
2. Verify MongoDB indexes: `node scripts/setup-detection-collections.js`
3. Test with seed data: `node scripts/seed-detection-data.js`
