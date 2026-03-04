# Organization-Based Data Isolation Flow

This document explains how the DNA Pulse platform ensures that all data (agents, data sources, data models, events) is properly associated with the correct organization account.

## Overview

The platform implements a complete B2B multi-tenancy model where:

- Each user belongs to an organization
- Each API key belongs to an organization
- All resources (agents, data sources, data models, events) are scoped to an organization
- Users can only see and access data from their own organization

## Complete Flow

### 1. User Registration & Login

**Frontend:** `apps/webapp/frontend/src/pages/Register.tsx`

- User registers with company name, email, and password
- First registered user becomes admin for the organization

**Backend:** `apps/webapp/backend/src/services/authService.ts`

- Creates new organization in MongoDB (`organizations` collection)
- Creates user with `organization_id` reference
- Returns JWT token containing `user_id`, `organization_id`, `role`, `email`

**JWT Payload:**

```typescript
{
  user_id: string;
  organization_id: string;
  role: 'admin' | 'analyst' | 'viewer';
  email: string;
}
```

### 2. API Key Creation

**Frontend:** `apps/webapp/frontend/src/pages/APIKeys.tsx`

- Admin user clicks "Generate New Key"
- No organization_id sent in request (automatically derived from JWT)

**Backend:** `apps/webapp/backend/src/controllers/apiKeysController.ts`

- Protected by `authMiddleware`
- Extracts `organization_id` from `req.user` (JWT payload)
- Creates API key with `organization_id` and `created_by` (user_id)

**Database:** `api_keys` collection

```javascript
{
  _id: ObjectId,
  organization_id: ObjectId,  // ← Linked to organization
  name: string,
  key: string,  // bcrypt hashed
  permissions: ['register', 'ingest', 'read'],
  created_by: ObjectId,
  created_at: Date
}
```

### 3. Agent Download

**Frontend:** `apps/webapp/frontend/src/components/agents/AgentDownloadModal.tsx`

- User selects agent type (e.g., Linux Resource Monitor)
- Downloads agent binary with embedded `agentTypeId`
- User provides their API key in the download modal

**Download URL:**

```
GET /downloads/{agentType}-linux-amd64?format=zip&agentTypeId={agentTypeId}
```

### 4. Agent Registration

**Agent → Ingestion Service:**

```bash
./linux-resource-monitor-linux-amd64 -config ./agent.yaml -register
```

**Request:**

```http
POST /api/v1/register
X-API-Key: dna_1234567890_abcdef
Content-Type: application/json

{
  "agent_name": "prod-server-01",
  "agent_type": "linux-resource-monitor",
  "agent_type_id": "6976ee903bd20e1f00bc5dd6",
  "version": "1.0.0",
  "platform": "linux",
  "hostname": "prod-server-01"
}
```

**Ingestion Service:** `services/ingestion/cmd/ingestion/main.go`

1. **API Key Validation** (`services/ingestion/pkg/middleware/auth.go`)

   - Extracts `X-API-Key` header
   - Calls `auth.ValidateAPIKey()` → `store.ValidateAPIKey()`
   - Validates API key against MongoDB `api_keys` collection
   - Retrieves associated `organization` from `organizations` collection
   - Adds `organization_id` to request context

2. **Agent Creation** (`handleRegister` function)
   - Gets `organization_id` from context (set by middleware)
   - **Checks if data source exists** for this organization + agent type:
     - Query: `{ organization_id: orgID, agent_type: agentType }`
     - If exists: reuses existing data source
     - If not exists: creates new data source with `organization_id`
   - **Creates root data model** (only if data source was just created)
   - Creates agent record with `organization_id` and links to data source
   - Generates JWT token containing `agent_id`, `org_id`, `data_source_id`

**Database:** `agents` collection

```javascript
{
  _id: ObjectId,
  organization_id: ObjectId,  // ← From API key
  agent_type_id: ObjectId,
  data_source_id: ObjectId,
  name: "prod-server-01",
  version: "1.0.0",
  platform: "linux",
  status: "online",
  created_at: Date
}
```

**Database:** `data_sources` collection

```javascript
{
  _id: ObjectId,
  organization_id: ObjectId,  // ← From API key
  name: "Linux Resource Monitor",
  type: "agent-based",
  agent_type: "linux-resource-monitor",  // ← Unique per organization
  status: "active",
  agent_count: 1,
  created_at: Date
}
```

**Important:** Data sources are **organization-scoped**:

- Each organization has its own data source for each agent type
- Query: `{ organization_id: orgID, agent_type: agentType }`
- If Organization A and Organization B both use "linux-resource-monitor", they each get their own separate data source
- Within one organization, the same agent type uses the same data source (max 1 per agent type per organization)

**Database:** `data_models` collection

```javascript
{
  _id: ObjectId,
  organization_id: ObjectId,  // ← From API key
  name: "Linux Resource Monitor - Root Model",
  data_index: "linux-resource-monitor",
  type: "root",
  version: 1,
  status: "active",
  source: {
    data_source_ids: [ObjectId],  // ← Links to organization's data source
    agent_type: "linux-resource-monitor"
  },
  elk: {
    index_name: "org_6976ee903bd20e1f00bc5dd6__linux-resource-monitor__v1"  // ← Organization-specific index
  },
  created_at: Date
}
```

**Important:** Data models are **organization-scoped**:

- Each organization has its own data model for each agent type
- The ELK index name includes the organization_id to ensure data isolation in Elasticsearch
- Data models are automatically created when the first agent of that type registers for an organization

**Response:**

```json
{
  "agent_id": "6976ee903bd20e1f00bc5dd7",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "config": {...},
  "config_version": 1
}
```

### 5. Event Ingestion

**Agent → Ingestion Service:**

```http
POST /api/v1/pulse
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "events": [
    {
      "timestamp": "2026-02-24T10:30:00Z",
      "cpu_usage": 45.2,
      "memory_usage": 62.8,
      ...
    }
  ]
}
```

**Ingestion Service:** `handlePulse` function

1. **JWT Validation** (`services/ingestion/pkg/middleware/auth.go`)

   - Extracts `Authorization: Bearer <token>` header
   - Validates JWT token
   - Extracts claims: `agent_id`, `org_id`, `data_source_id`
   - Adds claims to request context

2. **Event Storage**
   - Gets `org_id` from context (from JWT)
   - Creates `IngestedEvent` with `organization_id`
   - Stores in MongoDB `events` collection
   - Publishes to Kafka for processing

**Database:** `events` collection

```javascript
{
  _id: ObjectId,
  event_id: "evt_1234567890",
  organization_id: ObjectId,  // ← From JWT
  data_source_id: ObjectId,
  agent_id: ObjectId,
  tenant_id: "6976ee903bd20e1f00bc5dd6",
  type: "agent-event",
  payload: {
    timestamp: "2026-02-24T10:30:00Z",
    cpu_usage: 45.2,
    memory_usage: 62.8,
    ...
  },
  ingested_at: Date,
  created_at: Date
}
```

### 6. Web UI Data Access

**Frontend:** Any page (Agents, Data Sources, Data Models, Live Monitor, etc.)

- All API requests include `Authorization: Bearer <jwt_token>` header
- JWT token stored in `localStorage` after login

**Backend:** All protected routes

- `authMiddleware` validates JWT
- Extracts `organization_id` from JWT payload
- Controllers filter data by `organization_id`

**Example - Agents List:**

```typescript
// Frontend
const agents = await agentsService.getAgents();

// Backend Controller
async getAll(req: AuthRequest, res: Response) {
  const organizationId = req.user?.organization_id;
  const agents = await agentsService.getAll(organizationId);
  // Returns only agents belonging to this organization
}

// Service
async getAll(organizationId: string): Promise<Agent[]> {
  const collection = await getCollection(Collections.AGENTS);
  const agents = await collection.find({
    organization_id: new ObjectId(organizationId)
  }).toArray();
  return agents;
}
```

## Security Guarantees

### 1. API Key Isolation

- Each API key is tied to exactly one organization
- API key validation always returns the associated organization
- Cannot use another organization's API key

### 2. JWT Token Isolation

- JWT tokens contain `organization_id` in payload
- Tokens are signed and cannot be tampered with
- All backend operations use `organization_id` from token

### 3. Data Access Control

- All database queries filter by `organization_id`
- Controllers verify ownership before update/delete operations
- Cross-organization access returns 403 Forbidden

### 4. Resource Creation

- All new resources automatically get `organization_id` from JWT
- No way to create resources for other organizations
- Frontend never sends `organization_id` (derived server-side)

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Registration                        │
│  Frontend → Backend → MongoDB (organizations, users)             │
│  Returns: JWT with organization_id                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        API Key Creation                          │
│  Frontend → Backend (authMiddleware) → MongoDB (api_keys)        │
│  organization_id from JWT → stored in API key                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Download                            │
│  Frontend → Backend → Agent Binary (with agentTypeId)            │
│  User provides API key                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Registration                          │
│  Agent → Ingestion (X-API-Key) → Validate API Key               │
│  → Get organization_id from API key                              │
│  → Create: agent, data_source, data_model (with org_id)         │
│  → Return JWT with agent_id, org_id, data_source_id             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Event Ingestion                            │
│  Agent → Ingestion (JWT) → Validate JWT                          │
│  → Get organization_id from JWT                                  │
│  → Store events with organization_id                             │
│  → Publish to Kafka for processing                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Web UI Access                             │
│  Frontend → Backend (JWT) → authMiddleware                       │
│  → Get organization_id from JWT                                  │
│  → Filter all queries by organization_id                         │
│  → Return only organization's data                               │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

### Backend (Web App)

- `apps/webapp/backend/src/middleware/auth.ts` - JWT validation
- `apps/webapp/backend/src/controllers/apiKeysController.ts` - API key management
- `apps/webapp/backend/src/services/authService.ts` - User registration/login
- All controllers - Filter by organization_id

### Ingestion Service

- `services/ingestion/pkg/middleware/auth.go` - API key & JWT middleware
- `services/ingestion/pkg/auth/apikey.go` - API key validation
- `services/ingestion/pkg/mongo/store.go` - Database operations
- `services/ingestion/cmd/ingestion/main.go` - Registration & ingestion handlers

### Frontend

- `apps/webapp/frontend/src/contexts/AuthContext.tsx` - Auth state management
- `apps/webapp/frontend/src/lib/api.ts` - Automatic JWT header injection
- `apps/webapp/frontend/src/pages/APIKeys.tsx` - API key management UI
- `apps/webapp/frontend/src/components/agents/AgentDownloadModal.tsx` - Agent download

## Data Source & Data Model Isolation Examples

### Example 1: Two Organizations, Same Agent Type

**Scenario:** Both "Acme Corp" and "TechCo" want to use the Linux Resource Monitor agent.

```
Organization: Acme Corp (ID: 111)
├── API Key: dna_acme_key_123
├── Agent Type: linux-resource-monitor
├── Data Source: "Linux Resource Monitor"
│   ├── organization_id: 111
│   ├── agent_type: "linux-resource-monitor"
│   └── agent_count: 3
├── Data Model: "Linux Resource Monitor - Root Model"
│   ├── organization_id: 111
│   └── elk.index_name: "org_111__linux-resource-monitor__v1"
└── Agents:
    ├── server-prod-01 (Agent ID: a1)
    ├── server-prod-02 (Agent ID: a2)
    └── server-staging-01 (Agent ID: a3)

Organization: TechCo (ID: 222)
├── API Key: dna_techco_key_456
├── Agent Type: linux-resource-monitor (same agent type!)
├── Data Source: "Linux Resource Monitor"
│   ├── organization_id: 222  ← Different organization
│   ├── agent_type: "linux-resource-monitor"
│   └── agent_count: 2
├── Data Model: "Linux Resource Monitor - Root Model"
│   ├── organization_id: 222  ← Different organization
│   └── elk.index_name: "org_222__linux-resource-monitor__v1"  ← Different index
└── Agents:
    ├── web-server-01 (Agent ID: a4)
    └── web-server-02 (Agent ID: a5)
```

**Result:**

- ✅ Each organization has its own data source
- ✅ Each organization has its own data model
- ✅ Each organization has its own Elasticsearch index
- ✅ Acme Corp cannot see TechCo's data and vice versa

### Example 2: Same Organization, Multiple Agents of Same Type

**Scenario:** Acme Corp registers 3 Linux Resource Monitor agents sequentially.

```
Step 1: First agent registers (server-prod-01)
  → Data source created: { organization_id: 111, agent_type: "linux-resource-monitor" }
  → Data model created: { organization_id: 111, data_index: "linux-resource-monitor" }
  → Agent created: { agent_id: a1, data_source_id: ds1 }

Step 2: Second agent registers (server-prod-02)
  → Data source found: ds1 (reused, not created)
  → Data model exists (not created again)
  → Agent created: { agent_id: a2, data_source_id: ds1 }  ← Same data source
  → Data source agent_count incremented: 1 → 2

Step 3: Third agent registers (server-staging-01)
  → Data source found: ds1 (reused, not created)
  → Data model exists (not created again)
  → Agent created: { agent_id: a3, data_source_id: ds1 }  ← Same data source
  → Data source agent_count incremented: 2 → 3
```

**Result:**

- ✅ Only 1 data source for this organization + agent type combination
- ✅ Only 1 data model for this organization + agent type combination
- ✅ All 3 agents share the same data source
- ✅ All events from these 3 agents go to the same Elasticsearch index

### Example 3: Same Organization, Different Agent Types

**Scenario:** Acme Corp uses multiple agent types.

```
Organization: Acme Corp (ID: 111)
├── Agent Type: linux-resource-monitor
│   ├── Data Source: "Linux Resource Monitor" (org: 111, type: linux-resource-monitor)
│   ├── Data Model: "Linux Resource Monitor - Root Model"
│   └── Agents: server-prod-01, server-prod-02
│
├── Agent Type: windows-event-log
│   ├── Data Source: "Windows Event Log" (org: 111, type: windows-event-log)
│   ├── Data Model: "Windows Event Log - Root Model"
│   └── Agents: win-server-01, win-server-02
│
└── Agent Type: syslog
    ├── Data Source: "Syslog" (org: 111, type: syslog)
    ├── Data Model: "Syslog - Root Model"
    └── Agents: firewall-01
```

**Result:**

- ✅ Each agent type gets its own data source (even within the same organization)
- ✅ Each agent type gets its own data model
- ✅ Each agent type gets its own Elasticsearch index

## Testing the Flow

1. **Register a new account:**

   ```
   POST /api/auth/register
   {
     "fullName": "John Doe",
     "companyName": "Acme Corp",
     "email": "john@acme.com",
     "password": "SecurePass123!"
   }
   ```

2. **Login and get JWT:**

   ```
   POST /api/auth/login
   {
     "email": "john@acme.com",
     "password": "SecurePass123!"
   }
   ```

3. **Create API key:**

   ```
   POST /api/api-keys
   Authorization: Bearer <jwt_token>
   {
     "name": "Production Key"
   }
   ```

4. **Download agent:**

   ```
   GET /downloads/linux-resource-monitor-linux-amd64?format=zip&agentTypeId=<id>
   ```

5. **Register agent:**

   ```
   POST /api/v1/register
   X-API-Key: dna_...
   {
     "agent_name": "server-01",
     "agent_type": "linux-resource-monitor",
     "agent_type_id": "<id>",
     "version": "1.0.0",
     "platform": "linux"
   }
   ```

6. **Send events:**

   ```
   POST /api/v1/pulse
   Authorization: Bearer <agent_jwt>
   {
     "events": [...]
   }
   ```

7. **View data in UI:**
   - All pages automatically filter by organization_id from JWT
   - Users only see their organization's data

## Conclusion

The platform implements a complete organization-based isolation model where:

- **API keys** carry organization identity from web UI to agent registration
- **JWT tokens** carry organization identity from agent to ingestion service
- **All data** (agents, data sources, data models, events) is tagged with organization_id
- **All queries** filter by organization_id to ensure data isolation
- **No cross-organization access** is possible at any layer
