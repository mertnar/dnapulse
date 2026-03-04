export type AgentPlatform = 'windows' | 'macos' | 'linux' | 'docker';
export type AgentStatus = 'online' | 'offline' | 'error';

export interface DataCollectionConfig {
  systemMetrics: {
    enabled: boolean;
    frequency: number;
    attributes: string[];
  };
  processActivity: {
    enabled: boolean;
    frequency: number;
    attributes: string[];
  };
  fileSystemEvents: {
    enabled: boolean;
    frequency: number;
    attributes: string[];
  };
  networkActivity: {
    enabled: boolean;
    frequency: number;
    attributes: string[];
  };
  applicationLogs: {
    enabled: boolean;
    frequency: number;
    attributes: string[];
  };
  customAttributes: {
    enabled: boolean;
    attributes: Record<string, string>;
  };
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  platform: AgentPlatform;
  status: AgentStatus;
  version: string;
  configHash: string;
  dataSourceId: string;
  dataModelId?: string;
  throughput: number;
  lastHeartbeat: string;
  createdAt: string;
  config: DataCollectionConfig;
  authToken: string;
  ingestionEndpoint: string;
}

export interface AgentLog {
  id: string;
  agentId: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface AgentEvent {
  id: string;
  agentId: string;
  timestamp: string;
  eventType: string;
  data: Record<string, any>;
}

let agents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Production Web Server',
    description: 'Monitors web-server-01 for security and performance events',
    platform: 'linux',
    status: 'online',
    version: '2.4.1',
    configHash: 'a1b2c3d4',
    dataSourceId: 'ds-1',
    dataModelId: 'dm-1',
    throughput: 245,
    lastHeartbeat: new Date().toISOString(),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    config: {
      systemMetrics: {
        enabled: true,
        frequency: 60,
        attributes: ['cpu_usage', 'memory_usage', 'disk_usage'],
      },
      processActivity: {
        enabled: true,
        frequency: 30,
        attributes: ['process_name', 'pid', 'user', 'command_line'],
      },
      fileSystemEvents: {
        enabled: true,
        frequency: 10,
        attributes: ['file_path', 'operation', 'user'],
      },
      networkActivity: {
        enabled: true,
        frequency: 20,
        attributes: ['source_ip', 'dest_ip', 'port', 'protocol'],
      },
      applicationLogs: {
        enabled: true,
        frequency: 5,
        attributes: ['log_level', 'message', 'source'],
      },
      customAttributes: {
        enabled: true,
        attributes: {
          environment: 'production',
          datacenter: 'us-east-1',
        },
      },
    },
    authToken: 'dnap_1a2b3c4d5e6f7g8h9i0j',
    ingestionEndpoint: 'http://localhost:19071/api/v1/pulse',
  },
  {
    id: 'agent-2',
    name: 'Database Server Monitor',
    description: 'Tracks database performance and query patterns',
    platform: 'linux',
    status: 'online',
    version: '2.4.1',
    configHash: 'e5f6g7h8',
    dataSourceId: 'ds-2',
    throughput: 512,
    lastHeartbeat: new Date(Date.now() - 30000).toISOString(),
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    config: {
      systemMetrics: {
        enabled: true,
        frequency: 30,
        attributes: ['cpu_usage', 'memory_usage', 'disk_io'],
      },
      processActivity: {
        enabled: false,
        frequency: 60,
        attributes: [],
      },
      fileSystemEvents: {
        enabled: false,
        frequency: 60,
        attributes: [],
      },
      networkActivity: {
        enabled: true,
        frequency: 15,
        attributes: ['source_ip', 'dest_ip', 'port'],
      },
      applicationLogs: {
        enabled: true,
        frequency: 5,
        attributes: ['log_level', 'message', 'query_time'],
      },
      customAttributes: {
        enabled: true,
        attributes: {
          environment: 'production',
          database_type: 'postgresql',
        },
      },
    },
    authToken: 'dnap_2b3c4d5e6f7g8h9i0j1k',
    ingestionEndpoint: 'http://localhost:19071/api/v1/pulse',
  },
  {
    id: 'agent-3',
    name: 'Windows Desktop Fleet',
    description: 'Endpoint monitoring for office workstations',
    platform: 'windows',
    status: 'online',
    version: '2.3.8',
    configHash: 'i9j0k1l2',
    dataSourceId: 'ds-3',
    dataModelId: 'dm-2',
    throughput: 89,
    lastHeartbeat: new Date(Date.now() - 60000).toISOString(),
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    config: {
      systemMetrics: {
        enabled: true,
        frequency: 300,
        attributes: ['cpu_usage', 'memory_usage'],
      },
      processActivity: {
        enabled: true,
        frequency: 60,
        attributes: ['process_name', 'user'],
      },
      fileSystemEvents: {
        enabled: true,
        frequency: 30,
        attributes: ['file_path', 'operation'],
      },
      networkActivity: {
        enabled: false,
        frequency: 60,
        attributes: [],
      },
      applicationLogs: {
        enabled: true,
        frequency: 60,
        attributes: ['log_level', 'message', 'application'],
      },
      customAttributes: {
        enabled: true,
        attributes: {
          environment: 'corporate',
          department: 'engineering',
        },
      },
    },
    authToken: 'dnap_3c4d5e6f7g8h9i0j1k2l',
    ingestionEndpoint: 'http://localhost:19071/api/v1/pulse',
  },
  {
    id: 'agent-4',
    name: 'Docker Container Monitor',
    description: 'Kubernetes cluster monitoring',
    platform: 'docker',
    status: 'offline',
    version: '2.4.1',
    configHash: 'm3n4o5p6',
    dataSourceId: 'ds-4',
    throughput: 0,
    lastHeartbeat: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    config: {
      systemMetrics: {
        enabled: true,
        frequency: 30,
        attributes: ['container_cpu', 'container_memory', 'container_status'],
      },
      processActivity: {
        enabled: false,
        frequency: 60,
        attributes: [],
      },
      fileSystemEvents: {
        enabled: false,
        frequency: 60,
        attributes: [],
      },
      networkActivity: {
        enabled: true,
        frequency: 30,
        attributes: ['pod_ip', 'service_name', 'port'],
      },
      applicationLogs: {
        enabled: true,
        frequency: 5,
        attributes: ['log_level', 'message', 'pod_name', 'namespace'],
      },
      customAttributes: {
        enabled: true,
        attributes: {
          cluster: 'prod-k8s-01',
          namespace: 'default',
        },
      },
    },
    authToken: 'dnap_4d5e6f7g8h9i0j1k2l3m',
    ingestionEndpoint: 'http://localhost:19071/api/v1/pulse',
  },
  {
    id: 'agent-5',
    name: 'MacOS Developer Workstation',
    description: 'Development environment monitoring',
    platform: 'macos',
    status: 'error',
    version: '2.4.0',
    configHash: 'q7r8s9t0',
    dataSourceId: 'ds-5',
    throughput: 0,
    lastHeartbeat: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    config: {
      systemMetrics: {
        enabled: true,
        frequency: 120,
        attributes: ['cpu_usage', 'memory_usage', 'battery_level'],
      },
      processActivity: {
        enabled: true,
        frequency: 60,
        attributes: ['process_name', 'user'],
      },
      fileSystemEvents: {
        enabled: false,
        frequency: 60,
        attributes: [],
      },
      networkActivity: {
        enabled: true,
        frequency: 60,
        attributes: ['source_ip', 'dest_ip', 'port'],
      },
      applicationLogs: {
        enabled: true,
        frequency: 30,
        attributes: ['log_level', 'message', 'application'],
      },
      customAttributes: {
        enabled: true,
        attributes: {
          environment: 'development',
          team: 'backend',
        },
      },
    },
    authToken: 'dnap_5e6f7g8h9i0j1k2l3m4n',
    ingestionEndpoint: 'http://localhost:19071/api/v1/pulse',
  },
];

let logs: AgentLog[] = [
  {
    id: 'log-1',
    agentId: 'agent-1',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    level: 'info',
    message: 'Successfully sent 1,247 events to ingestion endpoint',
  },
  {
    id: 'log-2',
    agentId: 'agent-1',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    level: 'info',
    message: 'Heartbeat sent successfully',
  },
  {
    id: 'log-3',
    agentId: 'agent-5',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    level: 'error',
    message: 'Failed to connect to ingestion endpoint: connection timeout',
  },
  {
    id: 'log-4',
    agentId: 'agent-5',
    timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    level: 'warning',
    message: 'High memory usage detected: 87%',
  },
];

import { api } from '../lib/api.js';

export const agentsService = {
  async getAgents(): Promise<Agent[]> {
    return api.get<Agent[]>('/agents');
  },

  async getAgent(id: string): Promise<Agent | null> {
    try {
      return await api.get<Agent>(`/agents/${id}`);
    } catch (error) {
      return null;
    }
  },

  async createAgent(
    agent: Omit<
      Agent,
      | 'id'
      | 'createdAt'
      | 'status'
      | 'throughput'
      | 'lastHeartbeat'
      | 'version'
      | 'configHash'
      | 'authToken'
      | 'ingestionEndpoint'
    >
  ): Promise<Agent> {
    return api.post<Agent>('/agents', agent);
  },

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    return api.put<Agent>(`/agents/${id}`, updates);
  },

  async deleteAgent(id: string): Promise<void> {
    return api.delete<void>(`/agents/${id}`);
  },

  async regenerateToken(id: string): Promise<string> {
    const response = await api.post<{ token: string }>(`/agents/${id}/regenerate-token`);
    return response.token;
  },

  async getAgentLogs(agentId: string): Promise<AgentLog[]> {
    return api.get<AgentLog[]>(`/agents/${agentId}/logs`);
  },

  async getRecentEvents(agentId: string): Promise<AgentEvent[]> {
    return api.get<AgentEvent[]>(`/agents/${agentId}/events`);
  },
};
