# DNA Pulse - Docker Compose Setup

## Prerequisites

- Docker and Docker Compose installed
- MongoDB Atlas account with cluster access
- MongoDB Atlas password

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# MongoDB Atlas Connection
# Replace <db_password> with your actual MongoDB Atlas password
MONGO_PASSWORD=your_mongodb_atlas_password
MONGO_URL=mongodb+srv://mrtnarr:${MONGO_PASSWORD}@cluster0.l2uy4sr.mongodb.net/dna-pulse?appName=Cluster0

# JWT Secret (for production, use a strong random secret)
JWT_SECRET=your-secret-key-change-in-production

# Disable JWT validation for development
DISABLE_JWT_VALIDATION=true
```

**Important:** Replace `your_mongodb_atlas_password` with your actual MongoDB Atlas password.

## Starting Services

### Start all services:

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Start specific services:

```bash
# Infrastructure only (Kafka, Elasticsearch)
docker compose -f docker-compose.dev.yml up -d kafka elasticsearch

# Application services
docker compose -f docker-compose.dev.yml up -d ingestion backend frontend
```

## Services

| Service           | Port  | Description                 |
| ----------------- | ----- | --------------------------- |
| Kafka             | 9092  | Message broker (Redpanda)   |
| Elasticsearch     | 9200  | Search and analytics        |
| Kibana            | 5601  | Elasticsearch visualization |
| Ingestion Service | 19071 | Agent data ingestion API    |
| Backend API       | 3001  | Web application backend     |
| Frontend          | 5173  | Web application UI          |

## Accessing Services

- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Ingestion API**: http://localhost:19071
- **Kibana**: http://localhost:5601
- **Elasticsearch**: http://localhost:9200

## MongoDB Connection

All services use the same MongoDB Atlas cluster and database:

- **Connection String Format**: `mongodb+srv://mrtnarr:<db_password>@cluster0.l2uy4sr.mongodb.net/dna-pulse?appName=Cluster0`
- **Database Name**: `dna-pulse`
- **Username**: `mrtnarr`
- **Cluster**: `cluster0.l2uy4sr.mongodb.net`

**Important**: The connection string includes the database name (`/dna-pulse`) so all services automatically connect to the same database.

Make sure your MongoDB Atlas cluster:

1. Has network access configured (allow your IP or 0.0.0.0/0 for development)
2. Has a database user `mrtnarr` with appropriate permissions
3. Has the password set correctly in `.env` file

## Building Services

### Build all services:

```bash
docker compose -f docker-compose.dev.yml build
```

### Build specific service:

```bash
docker compose -f docker-compose.dev.yml build backend
docker compose -f docker-compose.dev.yml build frontend
docker compose -f docker-compose.dev.yml build ingestion
```

## Viewing Logs

### All services:

```bash
docker compose -f docker-compose.dev.yml logs -f
```

### Specific service:

```bash
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend
docker compose -f docker-compose.dev.yml logs -f ingestion
```

## Stopping Services

### Stop all services:

```bash
docker compose -f docker-compose.dev.yml down
```

### Stop and remove volumes:

```bash
docker compose -f docker-compose.dev.yml down -v
```

## Troubleshooting

### MongoDB Connection Issues

1. Check MongoDB Atlas network access settings
2. Verify password in `.env` file
3. Check MongoDB Atlas cluster status
4. View service logs: `docker compose -f docker-compose.dev.yml logs ingestion`

### Port Conflicts

If ports are already in use, you can modify them in `docker-compose.dev.yml`:

```yaml
ports:
  - '3002:3001' # Change host port if 3001 is in use
```

### Service Health Checks

Check service health:

```bash
# Backend
curl http://localhost:3001/health

# Ingestion
curl http://localhost:19071/health

# Elasticsearch
curl http://localhost:9200/_cluster/health
```

## Development Workflow

1. **Start infrastructure**: `docker compose -f docker-compose.dev.yml up -d kafka elasticsearch`
2. **Start application services**: `docker compose -f docker-compose.dev.yml up -d ingestion backend frontend`
3. **View logs**: `docker compose -f docker-compose.dev.yml logs -f`
4. **Make code changes**: Rebuild affected service: `docker compose -f docker-compose.dev.yml build <service>`
5. **Restart service**: `docker compose -f docker-compose.dev.yml restart <service>`

## Production Considerations

For production deployment:

1. Set strong `JWT_SECRET`
2. Set `DISABLE_JWT_VALIDATION=false`
3. Use proper MongoDB Atlas credentials with limited permissions
4. Configure proper network security
5. Use environment-specific configuration files
6. Enable proper logging and monitoring
7. Set up backup strategies for MongoDB
