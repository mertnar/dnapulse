import { api } from '../lib/api';

export type AgentCategory = 'system' | 'security' | 'application' | 'network';
export type AgentTypeStatus = 'active' | 'deprecated' | 'beta';

export interface AgentType {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  icon: string;
  category: AgentCategory;
  binaryURL: string;
  defaultConfig: Record<string, any>;
  configVersion: number;
  configUpdatedAt?: string;
  configUpdatedBy?: string;
  dataSourceId: string;
  status: AgentTypeStatus;
  instanceCount: number;
  onlineCount: number;
  offlineCount: number;
  errorCount: number;
  suspendedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentInstance {
  id: string;
  agentTypeId: string;
  agentTypeName?: string;
  dataSourceId: string;
  instanceName: string;
  hostname: string;
  ipAddress: string;
  platform: 'linux' | 'windows' | 'macos' | 'docker';
  version: string;
  status: 'online' | 'offline' | 'error' | 'suspended';
  lastHeartbeat: string;
  lastSeenAt: string;
  registeredAt: string;
  config: Record<string, any>;
  currentConfigVersion?: number;
  configLastSyncedAt?: string;
  metrics: Record<string, any>;
}

export const agentTypesService = {
  async getAgentTypes(): Promise<AgentType[]> {
    try {
      return await api.get<AgentType[]>('/agent-types');
    } catch (error) {
      console.error('Failed to fetch agent types:', error);
      return [];
    }
  },

  async getAgentType(id: string): Promise<AgentType | null> {
    try {
      return await api.get<AgentType>(`/agent-types/${id}`);
    } catch (error) {
      console.error('Failed to fetch agent type:', error);
      return null;
    }
  },

  async getInstances(agentTypeId: string): Promise<AgentInstance[]> {
    try {
      return await api.get<AgentInstance[]>(`/agent-types/${agentTypeId}/instances`);
    } catch (error) {
      console.error('Failed to fetch agent instances:', error);
      return [];
    }
  },

  async downloadAgent(agentTypeId: string, platform: string): Promise<Blob> {
    try {
      const response = await fetch(`/downloads/${agentTypeId}-${platform}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      return await response.blob();
    } catch (error) {
      console.error('Failed to download agent:', error);
      throw error;
    }
  },

  async updateConfig(
    agentTypeId: string,
    config: Record<string, any>,
    userId?: string
  ): Promise<AgentType> {
    try {
      return await api.put<AgentType>(`/agent-types/${agentTypeId}/config`, {
        config,
        userId,
      });
    } catch (error) {
      console.error('Failed to update agent type config:', error);
      throw error;
    }
  },
};
