# Agent Download & Installation Guide

## Overview

DNA Pulse agents can now be downloaded and installed directly from the web application. This guide explains the complete flow from agent selection to installation.

## Features Implemented

### 1. Agent Binary Download System

- ✅ **Multi-platform support**: Linux, Windows, macOS
- ✅ **Multi-architecture**: amd64, arm64
- ✅ **Direct download**: Binaries served from backend
- ✅ **Installation scripts**: Auto-generated for each platform
- ✅ **API key integration**: Secure agent registration

### 2. Backend API Endpoints

#### Get Agent Types

```bash
GET /api/agent-types
```

Returns list of all available agent types with metadata.

#### Get Agent Type Details

```bash
GET /api/agent-types/:id
```

Returns detailed information about a specific agent type.

#### Get Download Information

```bash
GET /api/agent-types/:id/download-info
```

Returns available platforms, architectures, and default configuration.

#### Download Binary

```bash
GET /downloads/:agentName-:platform-:arch
```

Downloads the agent binary for specified platform and architecture.

Examples:

- `GET /downloads/linux-resource-monitor-linux-amd64`
- `GET /downloads/linux-resource-monitor-darwin-arm64`
- `GET /downloads/linux-resource-monitor-windows-amd64`

### 3. Frontend UI Components

#### Agents Page (`/agents`)

- Lists all available agent types
- Shows instance counts and status
- "Download & Install" button for each agent type

#### Agent Download Modal

- Platform selection (Linux, Windows, macOS)
- Architecture selection (amd64, arm64)
- API key input
- One-click binary download
- Installation command generator
- Platform-specific instructions

### 4. Agent Binaries

All agent binaries are built and stored in:

```
apps/agents/dnapulse-agent/build/
```

Available binaries:

- `linux-resource-monitor-linux-amd64` (8.3 MB)
- `linux-resource-monitor-linux-arm64` (7.9 MB)
- `linux-resource-monitor-darwin-amd64` (8.2 MB)
- `linux-resource-monitor-darwin-arm64` (7.9 MB)
- `linux-resource-monitor-windows-amd64.exe` (8.4 MB)

## User Flow

### Step 1: Navigate to Agents Page

1. Open web application: `http://localhost:5173`
2. Click on "Agents" in the navigation menu
3. Browse available agent types

### Step 2: Select Agent Type

1. Click on an agent type (e.g., "Linux Resource Monitor")
2. Review agent information, configuration, and instances
3. Click "Download & Install" button

### Step 3: Configure Download

The download modal will open with the following options:

1. **Select Platform**

   - 🐧 Linux
   - 🪟 Windows
   - 🍎 macOS

2. **Select Architecture**

   - x86_64 (amd64)
   - ARM64

3. **Enter API Key**
   - Get your API key from Settings page
   - Format: `dna_...`

### Step 4: Download Binary

1. Click "Download Binary" button
2. Binary will be downloaded to your computer
3. Installation command is displayed with your API key

### Step 5: Install Agent

#### Linux/macOS Installation

```bash
# Download and install Linux Resource Monitor
curl -L -o /tmp/linux-resource-monitor http://localhost:3001/downloads/linux-resource-monitor-linux-amd64
chmod +x /tmp/linux-resource-monitor
sudo mv /tmp/linux-resource-monitor /usr/local/bin/dnapulse-agent

# Create config directory
sudo mkdir -p /etc/dnapulse-agent

# Register the agent (with API key inline, generates config automatically)
dnapulse-agent -register -api-key YOUR_API_KEY

# Start the agent
dnapulse-agent -start
```

#### Windows Installation

```powershell
# Download the binary from:
http://localhost:3001/downloads/linux-resource-monitor-windows-amd64

# Move it to a directory in your PATH (e.g., C:\Program Files\DNAPulse\)

# Run registration:
dnapulse-agent.exe -register -api-key YOUR_API_KEY
```

### Step 6: Verify Installation

1. Return to Agents page in web UI
2. Select the agent type
3. Click "Instances" tab
4. Your newly registered agent should appear in the list
5. Status should show as "online" (green)

### Step 7: Monitor Agent

1. View agent metrics in "Overview" tab
2. Check agent configuration in "Config" tab
3. Monitor live data in "Live Monitor" page
4. View agent logs and events

## Agent Configuration

The agent uses the default configuration from the agent type, which includes:

```yaml
agent:
  type: linux-resource-monitor
  version: 1.0.0
  platform: linux

ingestion:
  url: http://localhost:19071
  batch_size: 100
  flush_interval: 10s

collection:
  enabled: true
  interval: 30s
  sources:
    - type: system_metrics
      enabled: true
      metrics:
        - cpu
        - memory
        - disk
        - network
        - load_average
```

Configuration can be modified in two ways:

1. **Web UI**: Edit in "Config" tab and save (increments version)
2. **Agent Config File**: Edit `/etc/dnapulse-agent/agent.yaml` locally

## Building Agent Binaries

To build agent binaries for all platforms:

```bash
cd apps/agents/dnapulse-agent

# Build for all platforms
make build-linux-resource-monitor

# Or build individually
GOOS=linux GOARCH=amd64 go build -o build/linux-resource-monitor-linux-amd64 cmd/agent/main.go
GOOS=windows GOARCH=amd64 go build -o build/linux-resource-monitor-windows-amd64.exe cmd/agent/main.go
GOOS=darwin GOARCH=amd64 go build -o build/linux-resource-monitor-darwin-amd64 cmd/agent/main.go
```

## Docker Configuration

The backend container mounts the agent binaries directory:

```yaml
backend:
  volumes:
    - ./apps/agents/dnapulse-agent/build:/app/agent-binaries:ro
```

This allows the backend to serve binaries without including them in the Docker image.

## API Key Management

### Getting an API Key

1. Navigate to Settings page
2. Go to "API Keys" section
3. Click "Generate New Key"
4. Copy and save the key securely

### Using API Key

The API key is used for:

- Agent registration
- Authentication with ingestion service
- Config synchronization
- Health check reporting

## Troubleshooting

### Binary Download Fails

**Problem**: 404 Not Found when downloading binary

**Solution**:

1. Check that binaries are built: `ls apps/agents/dnapulse-agent/build/`
2. Verify Docker volume mount in `docker-compose.dev.yml`
3. Restart backend: `docker compose -f docker-compose.dev.yml restart backend`

### Agent Registration Fails

**Problem**: Agent shows "authentication failed" error

**Solution**:

1. Verify API key is correct
2. Check ingestion service is running: `docker compose ps ingestion`
3. Verify ingestion URL in agent config matches actual service URL
4. Check network connectivity from agent to ingestion service

### Agent Shows Offline

**Problem**: Agent registered but shows offline status

**Solution**:

1. Check agent is running: `ps aux | grep dnapulse-agent`
2. Review agent logs: `tail -f /var/log/dnapulse-agent/agent.log`
3. Verify health check interval in config (default 60s)
4. Check ingestion service logs for health check receipts

### Binary Not Executable

**Problem**: Permission denied when running agent

**Solution**:

```bash
chmod +x /path/to/dnapulse-agent
```

## System Requirements

### Server Requirements (Agent Host)

- **Linux**: Ubuntu 20.04+, CentOS 7+, RHEL 7+
- **Windows**: Windows Server 2016+, Windows 10+
- **macOS**: macOS 10.15+

- **CPU**: 1 core minimum, 2+ recommended
- **Memory**: 128 MB minimum, 256 MB recommended
- **Disk**: 50 MB for binary + logs
- **Network**: Outbound HTTPS access to ingestion service

### Client Requirements (Web UI)

- Modern web browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Internet connection to DNA Pulse platform

## Security Considerations

1. **API Keys**: Store securely, rotate regularly
2. **HTTPS**: Use TLS for production deployments
3. **Firewall**: Allow outbound connections from agent to ingestion service
4. **Permissions**: Run agent with minimal required privileges
5. **Config Files**: Protect config files (chmod 600)

## Next Steps

After successful agent installation:

1. **Monitor Data Flow**

   - Check Live Monitor page for incoming events
   - Verify metrics are being collected

2. **Set Up Alerts**

   - Configure alert rules for important metrics
   - Set up notification channels

3. **Create Dashboards**

   - Build custom dashboards for your agents
   - Visualize key performance indicators

4. **Scale Deployment**
   - Install agents on additional servers
   - Organize agents by tags and groups
   - Implement centralized configuration management

## Additional Resources

- Agent Configuration Guide: `apps/agents/dnapulse-agent/README.md`
- Quick Start Guide: `apps/agents/dnapulse-agent/QUICKSTART.md`
- API Documentation: Backend API routes in `apps/webapp/backend/src/routes/`
- Frontend Components: `apps/webapp/frontend/src/components/agents/`

## Support

For issues or questions:

1. Check logs: Backend, Frontend, Ingestion, Agent
2. Review documentation
3. Check GitHub issues
4. Contact support team
